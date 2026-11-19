#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_ENV="$ROOT_DIR/backend/.env"
DOMAIN_ENV="$ROOT_DIR/.env.hostinger"

if [[ "${EUID}" -ne 0 ]] && ! command -v sudo >/dev/null 2>&1; then
  printf 'Execute como root ou instale sudo antes de continuar.\n' >&2
  exit 1
fi

run_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

if [[ ! -f "$BACKEND_ENV" ]]; then
  cp "$ROOT_DIR/backend/.env.example" "$BACKEND_ENV"
  chmod 600 "$BACKEND_ENV"
fi

read_env_value() {
  local name="$1"
  awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$BACKEND_ENV"
}

set_env_value() {
  local name="$1"
  local value="$2"
  sed -i "/^${name}=/d" "$BACKEND_ENV"
  printf '%s=%s\n' "$name" "$value" >>"$BACKEND_ENV"
}

GROQ_API_KEY="$(read_env_value GROQ_API_KEY)"
if [[ -z "$GROQ_API_KEY" || "$GROQ_API_KEY" == "your-groq-api-key" ]]; then
  printf 'Informe a chave da API Groq (a entrada ficará oculta): '
  IFS= read -r -s GROQ_API_KEY
  printf '\n'
  if [[ -z "$GROQ_API_KEY" ]]; then
    printf 'A chave GROQ_API_KEY é obrigatória para iniciar a aplicação.\n' >&2
    exit 1
  fi
  sed -i '/^GROQ_API_KEY=/d' "$BACKEND_ENV"
  printf 'GROQ_API_KEY=%s\n' "$GROQ_API_KEY" >>"$BACKEND_ENV"
fi

ELEVENLABS_API_KEY="$(read_env_value ELEVENLABS_API_KEY)"
if [[ -z "$ELEVENLABS_API_KEY" || "$ELEVENLABS_API_KEY" == "your-elevenlabs-api-key" ]]; then
  printf 'Informe a chave da API ElevenLabs para habilitar vozes (Enter para configurar depois): '
  IFS= read -r -s ELEVENLABS_API_KEY
  printf '\n'
  if [[ -n "$ELEVENLABS_API_KEY" ]]; then
    set_env_value ELEVENLABS_API_KEY "$ELEVENLABS_API_KEY"
  fi
fi

FLASK_SECRET_KEY="$(read_env_value FLASK_SECRET_KEY)"
if [[ -z "$FLASK_SECRET_KEY" || "$FLASK_SECRET_KEY" == "replace-with-a-long-random-secret" ]]; then
  FLASK_SECRET_KEY="$(openssl rand -hex 32)"
  set_env_value FLASK_SECRET_KEY "$FLASK_SECRET_KEY"
fi

ADMIN_API_KEY="$(read_env_value ADMIN_API_KEY)"
if [[ -z "$ADMIN_API_KEY" ]]; then
  ADMIN_API_KEY="$(openssl rand -hex 32)"
  set_env_value ADMIN_API_KEY "$ADMIN_API_KEY"
  printf 'Uma chave administrativa foi gerada e salva em backend/.env.\n'
fi

chmod 600 "$BACKEND_ENV"
unset GROQ_API_KEY ELEVENLABS_API_KEY FLASK_SECRET_KEY ADMIN_API_KEY

DOMAIN=""
if [[ -f "$DOMAIN_ENV" ]]; then
  DOMAIN="$(awk -F= '$1 == "DOMAIN" { sub(/^[^=]*=/, ""); print; exit }' "$DOMAIN_ENV")"
fi

if [[ -z "$DOMAIN" ]]; then
  printf 'Domínio apontado para o IP deste VPS (ex.: app.exemplo.com): '
  IFS= read -r DOMAIN
fi

if [[ ! "$DOMAIN" =~ ^([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$ ]]; then
  printf 'Domínio inválido. Informe um hostname como app.exemplo.com.\n' >&2
  exit 1
fi

printf 'DOMAIN=%s\n' "$DOMAIN" >"$DOMAIN_ENV"
chmod 600 "$DOMAIN_ENV"

INSTALL_DOCKER_PACKAGES=()
if ! command -v docker >/dev/null 2>&1; then
  INSTALL_DOCKER_PACKAGES=(
    docker-ce
    docker-ce-cli
    containerd.io
    docker-buildx-plugin
    docker-compose-plugin
  )
elif ! docker compose version >/dev/null 2>&1; then
  INSTALL_DOCKER_PACKAGES=(docker-compose-plugin)
fi

if [[ "${#INSTALL_DOCKER_PACKAGES[@]}" -gt 0 ]]; then
  if [[ ! -r /etc/os-release ]]; then
    printf 'Não foi possível identificar esta distribuição Linux.\n' >&2
    exit 1
  fi

  source /etc/os-release
  if [[ "${ID:-}" != "ubuntu" && "${ID:-}" != "debian" ]]; then
    printf 'Este instalador requer Ubuntu ou Debian no VPS Hostinger.\n' >&2
    exit 1
  fi

  CODENAME="${VERSION_CODENAME:-}"
  if [[ -z "$CODENAME" ]]; then
    printf 'Não foi possível identificar a versão do Ubuntu/Debian.\n' >&2
    exit 1
  fi

  run_root apt-get update
  run_root apt-get install -y ca-certificates curl
  run_root install -m 0755 -d /etc/apt/keyrings
  run_root curl -fsSL "https://download.docker.com/linux/${ID}/gpg" \
    -o /etc/apt/keyrings/docker.asc
  run_root chmod a+r /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' \
    "$(dpkg --print-architecture)" "$ID" "$CODENAME" |
    run_root tee /etc/apt/sources.list.d/docker.list >/dev/null
  run_root apt-get update
  run_root apt-get install -y "${INSTALL_DOCKER_PACKAGES[@]}"
fi

run_root systemctl enable --now docker
mkdir -p "$ROOT_DIR/instance"

cd "$ROOT_DIR"
run_root docker compose \
  --env-file "$DOMAIN_ENV" \
  -f compose.hostinger.yaml \
  up -d --build

printf '\nWorld-AI foi iniciado. Acesse https://%s\n' "$DOMAIN"
printf 'Confirme que o DNS A do domínio aponta para este VPS e que as portas 80 e 443 estão liberadas.\n'
printf 'Para consultar os serviços: sudo docker compose --env-file .env.hostinger -f compose.hostinger.yaml ps\n'
