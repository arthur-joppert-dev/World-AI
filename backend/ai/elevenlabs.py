import json
import os
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


class ElevenLabsError(RuntimeError):
    def __init__(self, message, status_code=502):
        super().__init__(message)
        self.status_code = status_code


_VOICE_CACHE_TTL_SECONDS = 300
_MAX_RESPONSE_BYTES = 15 * 1024 * 1024
_voice_cache = []
_voice_cache_expires_at = 0
_voice_cache_lock = threading.Lock()


def _raise_api_error(exc):
    try:
        payload = json.loads(exc.read(64 * 1024))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        payload = {}

    detail = payload.get("detail", {}) if isinstance(payload, dict) else {}
    if isinstance(detail, dict):
        error_code = str(detail.get("status", "")).lower()
        error_message = str(detail.get("message", "")).lower()
    else:
        error_code = ""
        error_message = str(detail).lower()
    error_text = f"{error_code} {error_message}"

    if exc.code == 402 or any(
        marker in error_text
        for marker in (
            "quota_exceeded",
            "insufficient_credits",
            "not enough credits",
            "no credits remaining",
            "subscription_expired",
            "payment_required",
        )
    ):
        raise ElevenLabsError(
            "A conta ElevenLabs está sem créditos de geração ou a assinatura expirou. "
            "Confira Usage e Billing na sua conta.",
            402,
        ) from exc
    if "missing_permissions" in error_text or "permission" in error_text:
        raise ElevenLabsError(
            "A chave é reconhecida, mas não tem permissão para gerar voz. "
            "Confira as permissões de Text to Speech dessa chave.",
            403,
        ) from exc
    if exc.code == 401 or "invalid_api_key" in error_text:
        raise ElevenLabsError(
            "A ElevenLabs rejeitou a chave da API. Confira se backend/.env contém "
            "a chave correta e recrie o container do backend.",
            502,
        ) from exc
    if exc.code == 403:
        raise ElevenLabsError(
            "A ElevenLabs negou o acesso à geração de voz. Confira os créditos, "
            "o plano e as permissões de Text to Speech da chave.",
            403,
        ) from exc
    if exc.code == 429:
        raise ElevenLabsError(
            "O limite de requisições da ElevenLabs foi atingido. Aguarde e tente novamente.",
            429,
        ) from exc
    if exc.code >= 500:
        raise ElevenLabsError(
            "O serviço de voz do ElevenLabs está temporariamente indisponível.",
            503,
        ) from exc
    raise ElevenLabsError(
        "O ElevenLabs não aceitou a solicitação de voz. Confira o modelo, a voz e o plano da conta.",
        502,
    ) from exc


def _api_key():
    key = (os.getenv("ELEVENLABS_API_KEY") or "").strip()
    if not key:
        raise ElevenLabsError(
            "Configure ELEVENLABS_API_KEY em backend/.env para habilitar as vozes.",
            503,
        )
    return key


def _request(path, method="GET", body=None):
    headers = {"xi-api-key": _api_key()}
    payload = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        payload = json.dumps(body).encode("utf-8")

    req = Request(
        f"https://api.elevenlabs.io{path}",
        data=payload,
        headers=headers,
        method=method,
    )
    try:
        with urlopen(req, timeout=45) as response:
            payload = response.read(_MAX_RESPONSE_BYTES + 1)
            if len(payload) > _MAX_RESPONSE_BYTES:
                raise ElevenLabsError("A resposta do ElevenLabs excedeu o limite permitido.")
            return payload
    except HTTPError as exc:
        _raise_api_error(exc)
    except (TimeoutError, URLError) as exc:
        raise ElevenLabsError(
            "Não foi possível conectar ao serviço de voz do ElevenLabs.",
            503,
        ) from exc


def _fetch_voices():
    voices = []
    next_page_token = None
    for _ in range(10):
        params = {
            "page_size": 100,
            "include_total_count": "false",
            "voice_type": "default",
        }
        if next_page_token:
            params["next_page_token"] = next_page_token
        payload = _request(f"/v2/voices?{urlencode(params)}")
        try:
            result = json.loads(payload)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ElevenLabsError(
                "O ElevenLabs retornou uma lista de vozes inválida."
            ) from exc

        page = result.get("voices")
        if not isinstance(page, list):
            raise ElevenLabsError("O ElevenLabs retornou uma lista de vozes inválida.")
        voices.extend(
            {
                "voice_id": voice["voice_id"],
                "name": voice.get("name") or "Voz sem nome",
                "category": voice.get("category") or "",
                "labels": voice.get("labels") or {},
            }
            for voice in page
            if isinstance(voice, dict)
            and isinstance(voice.get("voice_id"), str)
            and voice["voice_id"]
        )
        if not result.get("has_more"):
            break
        next_page_token = result.get("next_page_token")
        if not isinstance(next_page_token, str) or not next_page_token:
            break
    return sorted(voices, key=lambda voice: voice["name"].casefold())


def get_voices():
    global _voice_cache, _voice_cache_expires_at

    with _voice_cache_lock:
        if time.monotonic() >= _voice_cache_expires_at:
            _voice_cache = _fetch_voices()
            _voice_cache_expires_at = time.monotonic() + _VOICE_CACHE_TTL_SECONDS
        return [voice.copy() for voice in _voice_cache]


def stream_speech(text, voice_id, speed=0.95):
    voices = get_voices()
    if not any(voice["voice_id"] == voice_id for voice in voices):
        raise ElevenLabsError("Selecione uma voz disponível na sua conta.", 400)

    path = (
        f"/v1/text-to-speech/{quote(voice_id, safe='')}/stream"
        f"?{urlencode({'output_format': 'mp3_44100_64', 'optimize_streaming_latency': 2})}"
    )
    req = Request(
        f"https://api.elevenlabs.io{path}",
        data=json.dumps(
            {
                "text": text,
                "model_id": "eleven_flash_v2_5",
                "voice_settings": {
                    "stability": 0.4,
                    "similarity_boost": 0.8,
                    "style": 0.25,
                    "use_speaker_boost": True,
                    "speed": speed,
                },
            }
        ).encode("utf-8"),
        headers={
            "xi-api-key": _api_key(),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        response = urlopen(req, timeout=45)
    except HTTPError as exc:
        _raise_api_error(exc)
    except (TimeoutError, URLError) as exc:
        raise ElevenLabsError(
            "Não foi possível conectar ao serviço de voz do ElevenLabs.",
            503,
        ) from exc

    def read_chunks():
        try:
            while chunk := response.read(16 * 1024):
                yield chunk
        finally:
            response.close()

    return read_chunks()
