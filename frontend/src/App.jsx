import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import CurriculumAdmin from "./CurriculumAdmin";
import GameHub from "./GameHub";
import StudentPortal from "./StudentPortal";

const LANGUAGES = [
  { label: "English", flag: "🇬🇧" },
  { label: "Español", flag: "🇪🇸" },
  { label: "Français", flag: "🇫🇷" },
  { label: "Deutsch", flag: "🇩🇪" },
  { label: "Italiano", flag: "🇮🇹" },
  { label: "Português", flag: "🇧🇷" },
  { label: "日本語", flag: "🇯🇵" },
];

const LEVELS = [
  { code: "A1", label: "Iniciante", description: "Estou começando" },
  { code: "A2", label: "Básico", description: "Consigo me virar" },
  {
    code: "B1",
    label: "Intermediário",
    description: "Converso sobre vários temas",
  },
  {
    code: "B2",
    label: "Intermediário avançado",
    description: "Me comunico com confiança",
  },
  { code: "C1", label: "Avançado", description: "Uso o idioma com fluidez" },
  { code: "C2", label: "Proficiente", description: "Domínio quase nativo" },
];

const SUGGESTIONS = [
  {
    icon: "✦",
    label: "Vamos nos apresentar",
    prompt: "Vamos nos apresentar. Faça perguntas para me conhecer.",
  },
  {
    icon: "☕",
    label: "Pedir em um café",
    prompt: "Vamos praticar como pedir comida e bebida em um café.",
  },
  {
    icon: "⌁",
    label: "Falar sobre viagens",
    prompt: "Quero conversar sobre viagens e conhecer lugares novos.",
  },
];

const makeWelcome = (language) => ({
  id: "welcome",
  role: "assistant",
  content: `Olá! Eu sou seu parceiro de conversação. Vamos praticar ${language} juntos?\n\nConverse comigo naturalmente — vou ajudar com correções gentis e dicas úteis ao longo do caminho.`,
});

function getStorageValue(key, fallback = "") {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function setStorageValue(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures, such as browser privacy restrictions.
  }
}

function readSavedConversation() {
  try {
    const saved = JSON.parse(getStorageValue("lingua-conversation", "[]"));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function getSpeechLanguageCode(language) {
  const map = {
    English: "en-US",
    Español: "es-ES",
    Français: "fr-FR",
    Deutsch: "de-DE",
    Italiano: "it-IT",
    Português: "pt-BR",
    日本語: "ja-JP",
  };
  return map[language] || "en-US";
}

function getSpeechPreviewText(language) {
  const previews = {
    English: "Hello, this is a voice preview.",
    Español: "Hola, esta es una prueba de voz.",
    Français: "Bonjour, ceci est un aperçu vocal.",
    Deutsch: "Hallo, dies ist eine Sprachprobe.",
    Italiano: "Ciao, questa è un'anteprima vocale.",
    Português: "Olá, esta é uma prévia de voz.",
    日本語: "こんにちは、音声のプレビューです。",
  };
  return previews[language] || previews.English;
}

function isSecureOrigin() {
  if (typeof window === "undefined") {
    return true;
  }

  const hostname = window.location.hostname;
  return (
    window.isSecureContext ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "0.0.0.0"
  );
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(
    () => getStorageValue("world-theme", "light") === "dark",
  );
  const [language, setLanguage] = useState(
    () => getStorageValue("lingua-language", "English") || "English",
  );
  const [level, setLevel] = useState(
    () => getStorageValue("lingua-level", "A2") || "A2",
  );
  const [messages, setMessages] = useState(readSavedConversation);
  const [translations, setTranslations] = useState({});
  const [translationLoadingId, setTranslationLoadingId] = useState(null);
  const [messageFeedback, setMessageFeedback] = useState({});
  const [feedbackLoadingId, setFeedbackLoadingId] = useState(null);
  const [isTranslatorOpen, setIsTranslatorOpen] = useState(false);
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [isCurriculumAdminOpen, setIsCurriculumAdminOpen] = useState(false);
  const [isStudentPortalOpen, setIsStudentPortalOpen] = useState(false);
  const [translatorDirection, setTranslatorDirection] =
    useState("pt-to-language");
  const [translatorText, setTranslatorText] = useState("");
  const [translatorResult, setTranslatorResult] = useState("");
  const [translatorTarget, setTranslatorTarget] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatorError, setTranslatorError] = useState("");
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const [voiceSessionActive, setVoiceSessionActive] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const [agents, setAgents] = useState([]);
  const [personalities, setPersonalities] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(() =>
    getStorageValue("world-chat-agent", "tutor"),
  );
  const [selectedPersonality, setSelectedPersonality] = useState(() =>
    getStorageValue("world-chat-personality", "supportive"),
  );
  const [elevenLabsVoices, setElevenLabsVoices] = useState([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState(() =>
    getStorageValue("world-elevenlabs-voice", ""),
  );
  const [voiceCatalogLoading, setVoiceCatalogLoading] = useState(true);
  const [voiceError, setVoiceError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [voiceSpeed, setVoiceSpeed] = useState(() => {
    const savedSpeed = Number(getStorageValue("world-voice-speed", "0.95"));
    return Number.isFinite(savedSpeed) && savedSpeed >= 0.7 && savedSpeed <= 1.2
      ? savedSpeed
      : 0.95;
  });
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const voiceSessionActiveRef = useRef(false);
  const voiceAwaitingResponseRef = useRef(false);
  const voiceTurnTranscriptRef = useRef("");
  const recognitionSegmentRef = useRef("");
  const recognitionActiveRef = useRef(false);
  const recognitionStartingRef = useRef(false);
  const recognitionRestartTimerRef = useRef(null);
  const voiceSilenceTimerRef = useRef(null);
  const startRecognitionRef = useRef(null);
  const finishVoiceTurnRef = useRef(null);
  const sendMessageRef = useRef(null);
  const speechAudioRef = useRef(null);
  const fallbackVoiceCaptureRef = useRef({
    stream: null,
    recorder: null,
    audioContext: null,
    analyser: null,
    source: null,
    animationFrame: null,
    chunks: [],
    stopReason: null,
    speechDetected: false,
    lastSpeechAt: 0,
    speechStartedAt: 0,
    noiseFloor: 0,
  });
  const finishFallbackVoiceRef = useRef(null);
  const stopFallbackVoiceRef = useRef(null);
  const transcriptionAbortRef = useRef(null);

  const currentLanguage =
    LANGUAGES.find((item) => item.label === language) || LANGUAGES[0];
  const currentLevel = LEVELS.find((item) => item.code === level) || LEVELS[1];
  const visibleMessages = messages.length ? messages : [makeWelcome(language)];
  const translationSource =
    translatorDirection === "pt-to-language"
      ? "português brasileiro"
      : language;
  const translationDestination =
    translatorDirection === "pt-to-language"
      ? language
      : "português brasileiro";
  const translationDirectionLabel =
    translatorDirection === "pt-to-language"
      ? `Português → ${language}`
      : `${language} → Português`;

  useEffect(() => {
    setStorageValue("lingua-language", language);
  }, [language]);

  useEffect(() => {
    setStorageValue("lingua-level", level);
  }, [level]);

  useEffect(() => {
    setStorageValue("world-voice-speed", String(voiceSpeed));
  }, [voiceSpeed]);

  useEffect(() => {
    setStorageValue("world-chat-agent", selectedAgent);
  }, [selectedAgent]);

  useEffect(() => {
    setStorageValue("world-chat-personality", selectedPersonality);
  }, [selectedPersonality]);

  useEffect(() => {
    setStorageValue("world-elevenlabs-voice", selectedVoiceId);
  }, [selectedVoiceId]);

  useEffect(() => {
    const controller = new AbortController();
    const apiBase = import.meta.env.VITE_API_URL || "/api";

    async function loadOptions() {
      try {
        const response = await fetch(
          `${apiBase.replace(/\/$/, "")}/chat/options`,
          { signal: controller.signal },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Não foi possível carregar os agentes.");
        }
        const availableAgents = Array.isArray(payload.agents)
          ? payload.agents
          : [];
        const availablePersonalities = Array.isArray(payload.personalities)
          ? payload.personalities
          : [];
        setAgents(availableAgents);
        setPersonalities(availablePersonalities);
        setSelectedAgent((current) =>
          availableAgents.some((agent) => agent.id === current)
            ? current
            : (availableAgents[0]?.id ?? ""),
        );
        setSelectedPersonality((current) =>
          availablePersonalities.some(
            (personality) => personality.id === current,
          )
            ? current
            : (availablePersonalities[0]?.id ?? ""),
        );
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setOptionsError(requestError.message);
        }
      }

      try {
        const response = await fetch(
          `${apiBase.replace(/\/$/, "")}/voice/voices`,
          { signal: controller.signal },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Não foi possível carregar as vozes.");
        }
        const availableVoices = Array.isArray(payload.voices)
          ? payload.voices
          : [];
        setElevenLabsVoices(availableVoices);
        setSelectedVoiceId((current) =>
          availableVoices.some((voice) => voice.voice_id === current)
            ? current
            : (availableVoices[0]?.voice_id ?? ""),
        );
        if (!availableVoices.length) {
          setVoiceError("Sua conta ElevenLabs não tem vozes disponíveis.");
        } else {
          setVoiceError("");
        }
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setVoiceError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setVoiceCatalogLoading(false);
        }
      }
    }

    loadOptions();
    return () => controller.abort();
  }, []);

  useEffect(
    () => () => {
      const current = speechAudioRef.current;
      if (current) {
        current.controller.abort();
        if (current.audio && !current.audio.ended) {
          current.audio.pause();
        }
        if (current.url) URL.revokeObjectURL(current.url);
      }
    },
    [],
  );

  useEffect(() => {
    const theme = isDarkMode ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    setStorageValue("world-theme", theme);
  }, [isDarkMode]);

  useEffect(() => {
    setStorageValue("lingua-conversation", JSON.stringify(messages));
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isSending]);

  const hasSpeechRecognition =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const hasMediaRecorder =
    typeof window !== "undefined" &&
    Boolean(
      window.navigator?.mediaDevices?.getUserMedia &&
        window.MediaRecorder &&
        (window.AudioContext || window.webkitAudioContext),
    );
  const voiceSupported =
    isSecureOrigin() && (hasSpeechRecognition || hasMediaRecorder);
  const speakAssistantText = useCallback(
    async (text, onDone = () => {}, preview = false) => {
      if (!voiceMode && !preview) {
        onDone();
        return;
      }

      const cleanText = String(text)
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/(?<!\*)\*(?!\s)(.*?)(?<!\s)\*(?!\*)/g, "$1")
        .replace(/[_`~]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!cleanText || !selectedVoiceId) {
        onDone();
        return;
      }
      if (cleanText.length > 4000) {
        setError("O texto é longo demais para gerar o áudio de uma só vez.");
        onDone();
        return;
      }

      const previous = speechAudioRef.current;
      if (previous) {
        previous.controller.abort();
        if (previous.audio) {
          previous.audio.onended = null;
          previous.audio.onerror = null;
          if (!previous.audio.ended) previous.audio.pause();
        }
        if (previous.url) URL.revokeObjectURL(previous.url);
      }

      let completed = false;
      let audio;
      let audioUrl;
      const controller = new AbortController();
      const playback = { audio: null, url: null, controller };
      speechAudioRef.current = playback;
      const finish = (errorMessage = "", releaseAudio = false) => {
        if (completed) return;
        completed = true;
        if (audio) {
          audio.onended = null;
          audio.onerror = null;
        }
        if (releaseAudio && audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        if (releaseAudio && speechAudioRef.current === playback) {
          speechAudioRef.current = null;
        }
        if (errorMessage) setError(errorMessage);
        onDone();
      };

      try {
        const apiBase = import.meta.env.VITE_API_URL || "/api";
        const response = await fetch(
          `${apiBase.replace(/\/$/, "")}/voice/speech`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              text: cleanText,
              voice_id: selectedVoiceId,
              speed: voiceSpeed,
            }),
          },
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            payload.error || `Falha ao gerar a voz (${response.status}).`,
          );
        }

        if (controller.signal.aborted) return;
        const supportsStreamingAudio =
          response.body &&
          window.MediaSource &&
          window.MediaSource.isTypeSupported("audio/mpeg");
        if (supportsStreamingAudio) {
          const mediaSource = new MediaSource();
          audio = new Audio();
          audioUrl = URL.createObjectURL(mediaSource);
          audio.src = audioUrl;
          playback.audio = audio;
          playback.url = audioUrl;
          audio.onended = () => finish("", true);
          audio.onerror = () => {
            finish(
              "Não foi possível reproduzir o áudio recebido do ElevenLabs.",
              true,
            );
          };
          await new Promise((resolve, reject) => {
            if (mediaSource.readyState === "open") {
              resolve();
              return;
            }
            mediaSource.addEventListener("sourceopen", resolve, { once: true });
            mediaSource.addEventListener(
              "sourceclose",
              () => reject(new Error("O fluxo de áudio foi encerrado.")),
              { once: true },
            );
            controller.signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          });
          if (controller.signal.aborted) return;

          const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
          const reader = response.body.getReader();
          const pendingChunks = [];
          let streamEnded = false;
          let firstChunkAppended = false;
          let playbackStarted = false;
          let resolveFirstChunk;
          const firstChunkReady = new Promise((resolve) => {
            resolveFirstChunk = resolve;
          });
          const appendPendingChunks = () => {
            if (sourceBuffer.updating) return;
            if (pendingChunks.length) {
              sourceBuffer.appendBuffer(pendingChunks.shift());
            } else if (
              streamEnded &&
              mediaSource.readyState === "open"
            ) {
              mediaSource.endOfStream();
            }
          };
          sourceBuffer.addEventListener("updateend", () => {
            if (!firstChunkAppended) {
              firstChunkAppended = true;
              resolveFirstChunk();
            }
            appendPendingChunks();
          });

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              streamEnded = true;
              appendPendingChunks();
              break;
            }
            pendingChunks.push(value);
            appendPendingChunks();
            if (!playbackStarted) {
              await firstChunkReady;
              if (controller.signal.aborted) return;
              playbackStarted = true;
              await audio.play();
            }
          }
        } else {
          audioUrl = URL.createObjectURL(await response.blob());
          if (controller.signal.aborted) {
            URL.revokeObjectURL(audioUrl);
            return;
          }
          audio = new Audio(audioUrl);
          playback.audio = audio;
          playback.url = audioUrl;
          audio.onended = () => finish("", true);
          audio.onerror = () => {
            finish(
              "Não foi possível reproduzir o áudio recebido do ElevenLabs.",
              true,
            );
          };
          await audio.play();
        }
      } catch (requestError) {
        if (!controller.signal.aborted) finish(requestError.message, true);
      }
    },
    [selectedVoiceId, voiceMode, voiceSpeed],
  );

  const sendMessage = useCallback(
    async (text = draft, fromVoice = false) => {
      const content = text.trim();
      if (!content || isSending) return;

      if (fromVoice) {
        voiceSessionActiveRef.current = false;
        voiceAwaitingResponseRef.current = false;
        setVoiceSessionActive(false);
        isListeningRef.current = false;
        setIsListening(false);
        setIsTranscribingVoice(false);
        if (recognitionRestartTimerRef.current) {
          window.clearTimeout(recognitionRestartTimerRef.current);
          recognitionRestartTimerRef.current = null;
        }
        stopFallbackVoiceRef.current?.();
      }

      const userMessage = { id: crypto.randomUUID(), role: "user", content };
      const history = [...messages, userMessage]
        .filter((item) => item.id !== "welcome")
        .slice(-14);
      setMessages((previous) => [...previous, userMessage]);
      setDraft("");
      setError("");
      setIsSending(true);

      const conversation = history
        .map(
          (message) =>
            `${message.role === "user" ? "Aluno" : "Tutor"}: ${message.content}`,
        )
        .join("\n");
      const cmd = [
        "Histórico recente da conversa:",
        conversation,
        "Responda à última mensagem do aluno.",
      ].join("\n\n");

      try {
        const apiBase = import.meta.env.VITE_API_URL || "/api";
        const response = await fetch(`${apiBase.replace(/\/$/, "")}/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cmd,
            ido: language,
            agent: selectedAgent,
            personality: selectedPersonality,
            level,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 429 || response.status === 503) {
            throw new Error(
              "A IA está temporariamente sobrecarregada. Aguarde alguns segundos e tente novamente.",
            );
          }
          throw new Error(
            payload.error ||
              `O servidor respondeu com erro (${response.status}).`,
          );
        }
        if (typeof payload.resp !== "string" || !payload.resp.trim()) {
          throw new Error("A IA retornou uma resposta vazia. Tente novamente.");
        }
        const assistantReply = payload.resp.trim();
        setMessages((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: assistantReply,
          },
        ]);
        speakAssistantText(assistantReply, () => {
          if (!fromVoice && voiceSessionActiveRef.current) {
            voiceAwaitingResponseRef.current = false;
            startRecognitionRef.current?.();
          }
        });
      } catch (requestError) {
        const isConnectionError =
          requestError instanceof TypeError ||
          /failed to fetch|networkerror|fetch/i.test(requestError.message);
        setError(
          isConnectionError
            ? "Não foi possível conectar ao servidor. Verifique se o backend está rodando na porta 3000 e se este dispositivo está na mesma rede."
            : requestError.message,
        );
        if (!fromVoice && voiceSessionActiveRef.current) {
          voiceAwaitingResponseRef.current = false;
          startRecognitionRef.current?.();
        }
      } finally {
        setIsSending(false);
        inputRef.current?.focus();
      }
    },
    [
      draft,
      isSending,
      language,
      level,
      messages,
      selectedAgent,
      selectedPersonality,
      speakAssistantText,
      stopFallbackVoiceRef,
    ],
  );

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  async function translatePortugueseText(event) {
    event.preventDefault();
    const text = translatorText.trim();
    if (!text || isTranslating) return;

    setIsTranslating(true);
    setTranslatorError("");
    setTranslatorResult("");

    try {
      const apiBase = import.meta.env.VITE_API_URL || "/api";
      const response = await fetch(`${apiBase.replace(/\/$/, "")}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cmd: `Traduza do ${translationSource} para ${translationDestination} o texto abaixo. Retorne somente a tradução, sem introdução, explicações ou aspas. Preserve o sentido, o tom e a formatação.\n\n${text}`,
          ido: translationDestination,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.error || `Falha ao traduzir (${response.status}).`,
        );
      }
      if (typeof payload.resp !== "string" || !payload.resp.trim()) {
        throw new Error("A tradução retornou vazia. Tente novamente.");
      }
      setTranslatorResult(payload.resp.trim());
      setTranslatorTarget(translationDirectionLabel);
    } catch (requestError) {
      setTranslatorError(requestError.message);
    } finally {
      setIsTranslating(false);
    }
  }

  async function toggleTranslation(message) {
    const existing = translations[message.id];
    if (existing) {
      setTranslations((previous) => ({
        ...previous,
        [message.id]: { ...previous[message.id], visible: !existing.visible },
      }));
      return;
    }

    const targetLanguage =
      message.role === "assistant" ? "Português brasileiro" : language;
    setTranslationLoadingId(message.id);
    setError("");

    try {
      const apiBase = import.meta.env.VITE_API_URL || "/api";
      const response = await fetch(`${apiBase.replace(/\/$/, "")}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cmd: `Traduza o texto a seguir para ${targetLanguage}. Detecte o idioma de origem automaticamente. Retorne somente a tradução, sem explicações, comentários ou aspas. Preserve o sentido e a formatação.\n\n${message.content}`,
          ido: targetLanguage,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.error || `Falha ao traduzir (${response.status}).`,
        );
      }
      if (typeof payload.resp !== "string" || !payload.resp.trim()) {
        throw new Error("A tradução retornou vazia. Tente novamente.");
      }
      setTranslations((previous) => ({
        ...previous,
        [message.id]: {
          text: payload.resp.trim(),
          targetLanguage,
          visible: true,
        },
      }));
    } catch (translationError) {
      setError(translationError.message);
    } finally {
      setTranslationLoadingId(null);
    }
  }

  async function toggleMessageFeedback(message) {
    const existing = messageFeedback[message.id];
    if (existing) {
      setMessageFeedback((previous) => ({
        ...previous,
        [message.id]: { ...previous[message.id], visible: !existing.visible },
      }));
      return;
    }

    setFeedbackLoadingId(message.id);
    setError("");

    try {
      const apiBase = import.meta.env.VITE_API_URL || "/api";
      const response = await fetch(`${apiBase.replace(/\/$/, "")}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cmd: [
            `Analise a frase do aluno no contexto de prática de ${language}, nível ${level} (${currentLevel.label}).`,
            `Frase do aluno: "${message.content}"`,
            "Dê feedback linguístico em português brasileiro, com no máximo 3 itens curtos: (1) se houver erro relevante, mostre uma versão corrigida e natural; (2) explique brevemente o principal erro e como evitá-lo; (3) se a frase estiver correta, diga isso e ofereça uma alternativa natural opcional. Não invente erros nem reescreva o sentido da frase.",
          ].join("\n\n"),
          ido: "Português brasileiro",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.error || `Falha ao gerar feedback (${response.status}).`,
        );
      }
      if (typeof payload.resp !== "string" || !payload.resp.trim()) {
        throw new Error("O feedback retornou vazio. Tente novamente.");
      }
      setMessageFeedback((previous) => ({
        ...previous,
        [message.id]: { text: payload.resp.trim(), visible: true },
      }));
    } catch (feedbackError) {
      setError(feedbackError.message);
    } finally {
      setFeedbackLoadingId(null);
    }
  }

  const finishVoiceTurn = useCallback(() => {
    if (voiceSilenceTimerRef.current) {
      clearTimeout(voiceSilenceTimerRef.current);
      voiceSilenceTimerRef.current = null;
    }

    const content = [
      voiceTurnTranscriptRef.current,
      recognitionSegmentRef.current,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!content || voiceAwaitingResponseRef.current) return;

    voiceTurnTranscriptRef.current = "";
    recognitionSegmentRef.current = "";
    setDraft("");
    voiceAwaitingResponseRef.current = true;
    isListeningRef.current = false;
    setIsListening(false);

    try {
      recognitionRef.current?.stop();
    } catch (stopError) {
      if (stopError.name !== "InvalidStateError") {
        setError("O navegador não conseguiu encerrar a captura de voz.");
      }
    }

    sendMessageRef.current?.(content, true);
  }, []);

  useEffect(() => {
    finishVoiceTurnRef.current = finishVoiceTurn;
  }, [finishVoiceTurn]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return undefined;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getSpeechLanguageCode(language);

    const startRecognition = () => {
      if (
        !voiceSessionActiveRef.current ||
        voiceAwaitingResponseRef.current ||
        recognitionActiveRef.current ||
        recognitionStartingRef.current
      ) {
        return;
      }

      recognitionStartingRef.current = true;
      try {
        recognition.start();
      } catch (startError) {
        recognitionStartingRef.current = false;
        if (startError.name !== "InvalidStateError") {
          voiceSessionActiveRef.current = false;
          setVoiceSessionActive(false);
          setError("O navegador não conseguiu iniciar a captura do microfone.");
        }
      }
    };
    startRecognitionRef.current = startRecognition;

    recognition.onstart = () => {
      recognitionStartingRef.current = false;
      if (!voiceSessionActiveRef.current || voiceAwaitingResponseRef.current) {
        try {
          recognition.stop();
        } catch (stopError) {
          if (stopError.name !== "InvalidStateError") {
            setError("O navegador não conseguiu encerrar a captura de voz.");
          }
        }
        return;
      }
      recognitionActiveRef.current = true;
      isListeningRef.current = true;
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      recognitionSegmentRef.current = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();

      const completeDraft = [
        voiceTurnTranscriptRef.current,
        recognitionSegmentRef.current,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (completeDraft) setDraft(completeDraft);

      if (voiceSilenceTimerRef.current) {
        clearTimeout(voiceSilenceTimerRef.current);
      }
      voiceSilenceTimerRef.current = setTimeout(() => {
        finishVoiceTurnRef.current?.();
      }, 2200);
    };

    recognition.onend = () => {
      recognitionStartingRef.current = false;
      recognitionActiveRef.current = false;
      isListeningRef.current = false;
      setIsListening(false);

      if (
        recognitionSegmentRef.current &&
        voiceSessionActiveRef.current &&
        !voiceAwaitingResponseRef.current
      ) {
        voiceTurnTranscriptRef.current = [
          voiceTurnTranscriptRef.current,
          recognitionSegmentRef.current,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
        recognitionSegmentRef.current = "";
        setDraft(voiceTurnTranscriptRef.current);
      }

      if (voiceSessionActiveRef.current && !voiceAwaitingResponseRef.current) {
        if (recognitionRestartTimerRef.current) {
          window.clearTimeout(recognitionRestartTimerRef.current);
        }
        recognitionRestartTimerRef.current = window.setTimeout(() => {
          recognitionRestartTimerRef.current = null;
          startRecognition();
        }, 250);
        return;
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }

      voiceSessionActiveRef.current = false;
      voiceAwaitingResponseRef.current = false;
      recognitionActiveRef.current = false;
      recognitionStartingRef.current = false;
      setVoiceSessionActive(false);
      isListeningRef.current = false;
      setIsListening(false);
      if (recognitionRestartTimerRef.current) {
        window.clearTimeout(recognitionRestartTimerRef.current);
        recognitionRestartTimerRef.current = null;
      }
      if (voiceSilenceTimerRef.current) {
        clearTimeout(voiceSilenceTimerRef.current);
        voiceSilenceTimerRef.current = null;
      }
      const partialTranscript = [
        voiceTurnTranscriptRef.current,
        recognitionSegmentRef.current,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (partialTranscript) setDraft(partialTranscript);
      const recognitionErrors = {
        "audio-capture":
          "O navegador não encontrou um microfone. Verifique a conexão e as permissões do dispositivo.",
        "language-not-supported":
          "O reconhecimento de voz não oferece suporte ao idioma selecionado.",
        "not-allowed":
          "O acesso ao microfone ou ao reconhecimento de voz foi bloqueado. Permita o acesso nas configurações do navegador.",
        "service-not-allowed":
          "O navegador bloqueou o serviço de reconhecimento de voz.",
        network:
          "O reconhecimento de voz não conseguiu se conectar ao serviço do navegador. Verifique a internet e tente novamente.",
      };
      setError(
        recognitionErrors[event.error] ||
          `Falha no reconhecimento de voz (${event.error}). Verifique o microfone e tente novamente.`,
      );
    };

    recognitionRef.current = recognition;

    return () => {
      if (voiceSilenceTimerRef.current) {
        clearTimeout(voiceSilenceTimerRef.current);
      }
      if (recognitionRestartTimerRef.current) {
        clearTimeout(recognitionRestartTimerRef.current);
        recognitionRestartTimerRef.current = null;
      }
      voiceSessionActiveRef.current = false;
      voiceAwaitingResponseRef.current = false;
      isListeningRef.current = false;
      setVoiceSessionActive(false);
      setIsListening(false);
      recognitionStartingRef.current = false;
      voiceTurnTranscriptRef.current = "";
      recognitionSegmentRef.current = "";
      const shouldAbort = recognitionActiveRef.current;
      recognitionActiveRef.current = false;
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      startRecognitionRef.current = null;
      recognitionRef.current = null;
      if (shouldAbort) {
        try {
          recognition.abort();
        } catch (abortError) {
          if (abortError.name !== "InvalidStateError") {
            throw abortError;
          }
        }
      }
    };
  }, [language]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      !hasMediaRecorder
    ) {
      return undefined;
    }

    const capture = fallbackVoiceCaptureRef.current;
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    const stopCapture = () => {
      if (capture.animationFrame !== null) {
        window.cancelAnimationFrame(capture.animationFrame);
        capture.animationFrame = null;
      }
      if (voiceSilenceTimerRef.current) {
        window.clearTimeout(voiceSilenceTimerRef.current);
        voiceSilenceTimerRef.current = null;
      }
      transcriptionAbortRef.current?.abort();
      transcriptionAbortRef.current = null;
      if (capture.recorder?.state === "recording") {
        capture.recorder.stopReason = "cancel";
        capture.recorder.stop();
      }
      capture.recorder = null;
      capture.stream?.getTracks().forEach((track) => track.stop());
      capture.stream = null;
      capture.source?.disconnect();
      capture.source = null;
      capture.analyser = null;
      if (capture.audioContext && capture.audioContext.state !== "closed") {
        void capture.audioContext.close();
      }
      capture.audioContext = null;
      capture.chunks = [];
      capture.speechDetected = false;
    };

    const restartAfterTranscriptionError = () => {
      voiceAwaitingResponseRef.current = false;
      setIsTranscribingVoice(false);
      isListeningRef.current = false;
      setIsListening(false);
      if (voiceSessionActiveRef.current) {
        startRecognitionRef.current?.();
      }
    };

    const transcribeRecordedAudio = async (blob) => {
      if (blob.size < 512) {
        setError("Não consegui entender a fala. Tente falar um pouco mais perto do microfone.");
        restartAfterTranscriptionError();
        return;
      }

      const controller = new AbortController();
      transcriptionAbortRef.current = controller;
      const formData = new FormData();
      const extension = blob.type.includes("ogg")
        ? "ogg"
        : blob.type.includes("mp4")
          ? "mp4"
          : "webm";
      formData.append("audio", blob, `voice.${extension}`);
      formData.append("language", language);

      try {
        const apiBase = import.meta.env.VITE_API_URL || "/api";
        const response = await fetch(
          `${apiBase.replace(/\/$/, "")}/voice/transcribe`,
          {
            method: "POST",
            body: formData,
            signal: controller.signal,
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            payload.error ||
              `Falha ao reconhecer a fala (${response.status}).`,
          );
        }
        if (typeof payload.text !== "string" || !payload.text.trim()) {
          throw new Error("Não consegui entender a fala. Tente novamente.");
        }
        if (voiceSessionActiveRef.current) {
          setIsTranscribingVoice(false);
          sendMessageRef.current?.(payload.text.trim(), true);
        }
      } catch (transcriptionError) {
        if (transcriptionError.name !== "AbortError") {
          setError(transcriptionError.message);
          restartAfterTranscriptionError();
        }
      } finally {
        if (transcriptionAbortRef.current === controller) {
          transcriptionAbortRef.current = null;
        }
      }
    };

    const startCapture = async () => {
      if (
        !voiceSessionActiveRef.current ||
        voiceAwaitingResponseRef.current ||
        capture.recorder?.state === "recording"
      ) {
        return;
      }

      try {
        if (!capture.audioContext) {
          capture.audioContext = new AudioContext();
          await capture.audioContext.resume();
          if (!voiceSessionActiveRef.current) {
            stopCapture();
            return;
          }
        }
        if (!capture.stream) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              autoGainControl: true,
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          if (!voiceSessionActiveRef.current) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          capture.stream = stream;
          capture.analyser = capture.audioContext.createAnalyser();
          capture.analyser.fftSize = 1024;
          capture.source = capture.audioContext.createMediaStreamSource(stream);
          capture.source.connect(capture.analyser);
        }

        const supportedMimeType = [
          "audio/webm;codecs=opus",
          "audio/ogg;codecs=opus",
          "audio/mp4",
        ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
        const recorder = supportedMimeType
          ? new MediaRecorder(capture.stream, { mimeType: supportedMimeType })
          : new MediaRecorder(capture.stream);
        capture.recorder = recorder;
        capture.chunks = [];
        recorder.stopReason = null;
        capture.speechDetected = false;
        capture.speechStartedAt = 0;
        capture.noiseFloor = 0;
        recorder.ondataavailable = (event) => {
          if (event.data.size) capture.chunks.push(event.data);
        };
        recorder.onstop = () => {
          const stopReason = recorder.stopReason;
          const blob = new Blob(capture.chunks, {
            type: recorder.mimeType || "audio/webm",
          });
          capture.chunks = [];
          if (capture.recorder === recorder) capture.recorder = null;
          if (stopReason === "transcribe") {
            void transcribeRecordedAudio(blob);
          }
        };
        recorder.onerror = () => {
          voiceSessionActiveRef.current = false;
          voiceAwaitingResponseRef.current = false;
          setVoiceSessionActive(false);
          isListeningRef.current = false;
          setIsListening(false);
          stopCapture();
          setError("O Firefox não conseguiu gravar o áudio do microfone.");
        };
        recorder.start(250);
        setError("");
        isListeningRef.current = true;
        setIsListening(true);

        const samples = new Float32Array(capture.analyser.fftSize);
        let lastMeterUpdate = 0;
        const monitorAudioLevel = (timestamp) => {
          if (
            !voiceSessionActiveRef.current ||
            voiceAwaitingResponseRef.current ||
            capture.recorder !== recorder ||
            recorder.state !== "recording"
          ) {
            return;
          }

          if (timestamp - lastMeterUpdate >= 100) {
            lastMeterUpdate = timestamp;
            capture.analyser.getFloatTimeDomainData(samples);
            const volume = Math.sqrt(
              samples.reduce((total, sample) => total + sample * sample, 0) /
                samples.length,
            );
            const speechThreshold = Math.max(0.006, capture.noiseFloor * 3);
            if (volume >= speechThreshold) {
              if (!capture.speechDetected) {
                capture.speechStartedAt = timestamp;
              }
              capture.speechDetected = true;
              capture.lastSpeechAt = timestamp;
            } else {
              if (!capture.speechDetected) {
                capture.noiseFloor =
                  capture.noiseFloor === 0
                    ? volume
                    : capture.noiseFloor * 0.95 + volume * 0.05;
              } else if (timestamp - capture.speechStartedAt < 250) {
                capture.speechDetected = false;
              }
              if (
                capture.speechDetected &&
                timestamp - capture.speechStartedAt >= 250 &&
                timestamp - capture.lastSpeechAt >= 1000
              ) {
                voiceAwaitingResponseRef.current = true;
                setIsListening(false);
                setIsTranscribingVoice(true);
                isListeningRef.current = false;
                recorder.stopReason = "transcribe";
                capture.animationFrame = null;
                recorder.stop();
                return;
              }
            }
          }

          capture.animationFrame =
            window.requestAnimationFrame(monitorAudioLevel);
        };
        capture.animationFrame =
          window.requestAnimationFrame(monitorAudioLevel);
      } catch (captureError) {
        if (!voiceSessionActiveRef.current) {
          stopCapture();
          return;
        }
        voiceSessionActiveRef.current = false;
        voiceAwaitingResponseRef.current = false;
        setVoiceSessionActive(false);
        isListeningRef.current = false;
        setIsListening(false);
        stopCapture();
        const captureErrors = {
          NotAllowedError:
            "Permita o acesso ao microfone nas configurações do Firefox e tente novamente.",
          NotFoundError:
            "O Firefox não encontrou um microfone conectado ao dispositivo.",
          NotReadableError:
            "O microfone está sendo usado por outro aplicativo ou não pode ser acessado.",
        };
        setError(
          captureErrors[captureError.name] ||
            "Não foi possível iniciar o microfone. Verifique as permissões e tente novamente.",
        );
      }
    };

    const finishCaptureTurn = () => {
      const recorder = capture.recorder;
      if (!recorder || recorder.state !== "recording") return false;
      if (!capture.speechDetected && capture.chunks.length === 0) {
        setError("Não recebi áudio. Fale e toque em Concluir fala para enviar.");
        return false;
      }

      voiceAwaitingResponseRef.current = true;
      isListeningRef.current = false;
      setIsListening(false);
      setIsTranscribingVoice(true);
      recorder.stopReason = "transcribe";
      if (capture.animationFrame !== null) {
        window.cancelAnimationFrame(capture.animationFrame);
        capture.animationFrame = null;
      }
      recorder.stop();
      return true;
    };

    startRecognitionRef.current = startCapture;
    finishFallbackVoiceRef.current = finishCaptureTurn;
    stopFallbackVoiceRef.current = stopCapture;

    return () => {
      voiceSessionActiveRef.current = false;
      voiceAwaitingResponseRef.current = false;
      setVoiceSessionActive(false);
      setIsListening(false);
      setIsTranscribingVoice(false);
      stopCapture();
      if (startRecognitionRef.current === startCapture) {
        startRecognitionRef.current = null;
      }
      finishFallbackVoiceRef.current = null;
      stopFallbackVoiceRef.current = null;
    };
  }, [hasMediaRecorder, language]);

  function startNewChat() {
    setMessages([]);
    setError("");
    setDraft("");
    inputRef.current?.focus();
  }

  async function toggleVoiceMode() {
    if (!voiceSupported) {
      setError(
        isSecureOrigin()
          ? "Este navegador não oferece suporte à captura de voz necessária."
          : "O acesso ao microfone exige http://localhost ou uma conexão HTTPS.",
      );
      return;
    }

    if (voiceSessionActiveRef.current) {
      if (!recognitionRef.current && isListeningRef.current) {
        finishFallbackVoiceRef.current?.();
        return;
      }

      voiceSessionActiveRef.current = false;
      voiceAwaitingResponseRef.current = false;
      setVoiceSessionActive(false);
      isListeningRef.current = false;
      setIsListening(false);
      setIsTranscribingVoice(false);
      if (recognitionRef.current) {
        const pendingTranscript = [
          voiceTurnTranscriptRef.current,
          recognitionSegmentRef.current,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (pendingTranscript) {
          finishVoiceTurnRef.current?.();
        } else {
          try {
            recognitionRef.current.stop();
          } catch (stopError) {
            if (stopError.name !== "InvalidStateError") {
              setError("O navegador não conseguiu encerrar a captura de voz.");
            }
          }
        }
      } else {
        stopFallbackVoiceRef.current?.();
      }
      return;
    }

    try {
      voiceTurnTranscriptRef.current = "";
      recognitionSegmentRef.current = "";
      voiceAwaitingResponseRef.current = false;
      setDraft("");
      setIsTranscribingVoice(false);
      if (recognitionRef.current) {
        recognitionRef.current.lang = getSpeechLanguageCode(language);
      }
      voiceSessionActiveRef.current = true;
      setVoiceSessionActive(true);
      await startRecognitionRef.current?.();
    } catch (startError) {
      voiceSessionActiveRef.current = false;
      setVoiceSessionActive(false);
      isListeningRef.current = false;
      setIsListening(false);
      setError(
        startError.message ||
          "Seu microfone já está em uso ou não foi permitido.",
      );
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="World, início">
          <img
            className="brand-logo"
            src="/logo.png"
            alt=""
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
          <span>
            World<span className="brand-period">.</span>
          </span>
        </a>

        <button
          className="new-chat-button"
          onClick={startNewChat}
          type="button"
        >
          <span className="plus-icon">＋</span> Nova conversa
          <span className="shortcut">⌘ K</span>
        </button>

        <div className="sidebar-section-label">SUA PRÁTICA</div>
        <div className="session-card">
          <span className="session-icon">◉</span>
          <span>
            <strong>Conversa livre</strong>
            <small>Pratique no seu ritmo</small>
          </span>
          <span className="active-dot" />
        </div>

        <div className="sidebar-spacer" />
        <div className="sidebar-tip">
          <span className="tip-sparkle">✦</span>
          <p>
            <strong>Pequenos passos, grandes conversas.</strong>
            <br />
            Praticar um pouco todo dia faz diferença.
          </p>
        </div>
        <div className="profile-card">
          <div className="profile-avatar">A</div>
          <div className="profile-copy">
            <strong>Meu espaço</strong>
            <span>Aprendiz de idiomas</span>
          </div>
          <span className="profile-menu">···</span>
        </div>
      </aside>

      <section className="workspace" id="top">
        <header className="topbar">
          <div className="mobile-brand">
            <img
              className="brand-logo"
              src="/logo.png"
              alt=""
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />{" "}
            World<span className="brand-period">.</span>
          </div>
          <div className="session-title">
            <span className="live-indicator" /> Prática de conversação
          </div>
          <div className="topbar-right">
            <span className="streak-icon">✧</span>
            <span>Seu espaço de prática</span>
          </div>
          <button
            className="student-portal-open-button"
            type="button"
            onClick={() => setIsStudentPortalOpen(true)}
            aria-label="Abrir área do aluno"
            title="Área do aluno"
          >
            <span aria-hidden="true">👤</span>
            <span className="student-portal-open-label">Área do aluno</span>
          </button>
          <button
            className="admin-open-button"
            type="button"
            onClick={() => setIsCurriculumAdminOpen(true)}
            aria-label="Abrir área do administrador para criar lições"
            title="Criar lições e exercícios"
          >
            <span aria-hidden="true">✎</span>
            <span className="admin-open-label">Conteúdo</span>
          </button>
          <button
            className="theme-toggle-button"
            type="button"
            onClick={() => setIsDarkMode((current) => !current)}
            aria-label={isDarkMode ? "Ativar modo claro" : "Ativar modo escuro"}
            aria-pressed={isDarkMode}
            title={isDarkMode ? "Ativar modo claro" : "Ativar modo escuro"}
          >
            <span aria-hidden="true">{isDarkMode ? "☀" : "☾"}</span>
          </button>
          <button
            className="game-open-button"
            type="button"
            onClick={() => setIsGameOpen(true)}
            aria-label="Abrir jogo ao vivo"
            title="Jogo ao vivo"
          >
            <span aria-hidden="true">✦</span>
            <span className="game-open-label">Jogo ao vivo</span>
          </button>
          <button
            className="translator-open-button"
            type="button"
            onClick={() => setIsTranslatorOpen(true)}
            aria-label={`Traduzir do português para ${language}`}
            title={`Traduzir do português para ${language}`}
          >
            <span aria-hidden="true">文</span>
            <span className="translator-open-label">
              Português → {language}
            </span>
          </button>
        </header>

        {isGameOpen && (
          <GameHub
            onClose={() => setIsGameOpen(false)}
            language={language}
            level={level}
          />
        )}

        {isCurriculumAdminOpen && (
          <CurriculumAdmin onClose={() => setIsCurriculumAdminOpen(false)} />
        )}

        {isStudentPortalOpen && (
          <StudentPortal onClose={() => setIsStudentPortalOpen(false)} />
        )}

        {isTranslatorOpen && (
          <div
            className="translator-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsTranslatorOpen(false);
              }
            }}
          >
            <section
              className="translator-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="translator-title"
            >
              <div className="translator-dialog-header">
                <div>
                  <span className="eyebrow">TRADUÇÃO RÁPIDA</span>
                  <h2 id="translator-title">{translationDirectionLabel}</h2>
                </div>
                <button
                  className="translator-close-button"
                  type="button"
                  onClick={() => setIsTranslatorOpen(false)}
                  aria-label="Fechar tradutor"
                >
                  ×
                </button>
              </div>
              <form onSubmit={translatePortugueseText}>
                <label htmlFor="translator-direction">
                  Direção da tradução
                </label>
                <select
                  className="translator-direction-select"
                  id="translator-direction"
                  value={translatorDirection}
                  onChange={(event) => {
                    setTranslatorDirection(event.target.value);
                    setTranslatorResult("");
                    setTranslatorError("");
                  }}
                >
                  <option value="pt-to-language">Português → {language}</option>
                  <option value="language-to-pt">{language} → Português</option>
                </select>
                <label htmlFor="translator-input">
                  {translatorDirection === "pt-to-language"
                    ? "Escreva o texto em português"
                    : `Escreva o texto em ${language}`}
                </label>
                <textarea
                  id="translator-input"
                  value={translatorText}
                  onChange={(event) => {
                    setTranslatorText(event.target.value);
                    setTranslatorResult("");
                    setTranslatorError("");
                  }}
                  placeholder={
                    translatorDirection === "pt-to-language"
                      ? "Digite uma palavra, frase ou texto em português..."
                      : `Digite uma palavra, frase ou texto em ${language}...`
                  }
                  rows={5}
                  maxLength={3000}
                  autoFocus
                />
                {translatorError && (
                  <p className="translator-error" role="alert">
                    {translatorError}
                  </p>
                )}
                <button
                  className="translator-submit-button"
                  type="submit"
                  disabled={!translatorText.trim() || isTranslating}
                >
                  {isTranslating
                    ? "Traduzindo…"
                    : `Traduzir · ${translationDirectionLabel}`}
                </button>
              </form>
              {translatorResult && (
                <div className="translator-result" aria-live="polite">
                  <span>TRADUÇÃO · {translatorTarget}</span>
                  <p>{translatorResult}</p>
                </div>
              )}
            </section>
          </div>
        )}

        <div className="chat-layout">
          <section
            className="conversation-panel"
            aria-label="Conversa com o tutor"
          >
            <div className="conversation-heading">
              <div>
                <div className="eyebrow">SEU TUTOR DE IDIOMAS</div>
                <h1>
                  Vamos conversar<span className="heading-dot">.</span>
                </h1>
                <p>Um espaço leve para praticar, errar e evoluir.</p>
              </div>
              <div className="conversation-status">
                <span className="status-dot" /> Tutor disponível
              </div>
            </div>

            <div
              className="messages"
              ref={listRef}
              aria-live="polite"
              aria-label="Mensagens"
            >
              {visibleMessages.map((message, index) => (
                <article
                  className={`message-row ${message.role}`}
                  key={message.id}
                >
                  {message.role === "assistant" && (
                    <div className="assistant-avatar" aria-hidden="true">
                      l<span>·</span>
                    </div>
                  )}
                  <div className="message-content-wrap">
                    {message.role === "assistant" && (
                      <div className="message-author">
                        Lia <span>· tutora</span>
                      </div>
                    )}
                    <div className="message-bubble">
                      {message.content
                        .split("\n")
                        .map((paragraph, paragraphIndex) =>
                          paragraph ? (
                            <p key={`${message.id}-${paragraphIndex}`}>
                              {paragraph}
                            </p>
                          ) : (
                            <div
                              className="paragraph-space"
                              key={`${message.id}-${paragraphIndex}`}
                            />
                          ),
                        )}
                    </div>
                    {translations[message.id]?.visible && (
                      <div className="translation-box">
                        <span>
                          Tradução · {translations[message.id].targetLanguage}
                        </span>
                        <p>{translations[message.id].text}</p>
                      </div>
                    )}
                    {messageFeedback[message.id]?.visible && (
                      <div className="message-feedback-box">
                        <span>Feedback da frase</span>
                        <p>{messageFeedback[message.id].text}</p>
                      </div>
                    )}
                    {message.role === "user" && (
                      <div className="message-tools user-message-tools">
                        <span>Você · agora</span>
                        <button
                          type="button"
                          onClick={() => toggleMessageFeedback(message)}
                          disabled={feedbackLoadingId === message.id}
                        >
                          {feedbackLoadingId === message.id
                            ? "Analisando..."
                            : messageFeedback[message.id]?.visible
                              ? "Ocultar feedback"
                              : "Feedback da frase"}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleTranslation(message)}
                          disabled={translationLoadingId === message.id}
                        >
                          {translationLoadingId === message.id
                            ? "Traduzindo..."
                            : translations[message.id]?.visible
                              ? "Ocultar tradução"
                              : "Traduzir para " + language}
                        </button>
                      </div>
                    )}
                    {message.role === "assistant" && index > 0 && (
                      <div className="message-tools">
                        <span>✦ Resposta do tutor</span>
                        <button
                          type="button"
                          onClick={() => toggleTranslation(message)}
                          disabled={translationLoadingId === message.id}
                        >
                          {translationLoadingId === message.id
                            ? "Traduzindo..."
                            : translations[message.id]?.visible
                              ? "Ocultar tradução"
                              : "Traduzir para português"}
                        </button>
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="user-avatar" aria-hidden="true">
                      A
                    </div>
                  )}
                </article>
              ))}
              {isSending && (
                <div
                  className="message-row assistant"
                  role="status"
                  aria-label="Lia está pensando"
                >
                  <div className="assistant-avatar">
                    l<span>·</span>
                  </div>
                  <div className="message-content-wrap">
                    <div className="message-author">
                      Lia <span>· tutora</span>
                    </div>
                    <div className="typing-bubble">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="error-banner" role="alert">
                <span>!</span>
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setError("")}
                  aria-label="Fechar erro"
                >
                  ×
                </button>
              </div>
            )}

            {!messages.length && (
              <div className="suggestions" aria-label="Sugestões para começar">
                <span className="suggestions-label">POR ONDE COMEÇAR?</span>
                <div className="suggestion-list">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      className="suggestion-chip"
                      key={suggestion.label}
                      type="button"
                      onClick={() => sendMessage(suggestion.prompt)}
                      disabled={isSending}
                    >
                      <span>{suggestion.icon}</span>
                      {suggestion.label}
                      <b>↗</b>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form className="composer" onSubmit={handleSubmit}>
              <label className="sr-only" htmlFor="message-input">
                Escreva sua mensagem
              </label>
              <textarea
                id="message-input"
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Escreva em ${language}...`}
                rows="1"
                maxLength="2000"
                disabled={isSending}
              />
              <div className="composer-footer">
                <span className="composer-hint">
                  <span>↵</span> enviar <span className="hint-divider">·</span>{" "}
                  shift + ↵ para nova linha
                </span>
                <div className="composer-actions">
                  <span className="character-count">{draft.length}/2000</span>
                  <div className="voice-toolbar">
                    <button
                      className={`voice-button ${isListening ? "active" : ""}`}
                      type="button"
                      onClick={toggleVoiceMode}
                      disabled={!voiceSupported}
                      aria-pressed={voiceSessionActive}
                      aria-label={
                        voiceSessionActive &&
                        !hasSpeechRecognition &&
                        isListening
                          ? "Concluir fala e transcrever"
                          : voiceSessionActive
                          ? "Encerrar conversa por voz"
                          : "Iniciar conversa por voz"
                      }
                    >
                      {voiceSessionActive
                        ? isListening
                          ? hasSpeechRecognition
                          ? "● Ouvindo · encerrar"
                          : "● Ouvindo · concluir fala"
                          : isTranscribingVoice
                          ? "Transcrevendo · encerrar"
                          : isSending
                            ? "Lia respondendo"
                            : "Conversa por voz ativa"
                        : "🎙 Conversar por voz"}
                    </button>
                    <button
                      className={`voice-toggle ${voiceMode ? "on" : ""}`}
                      type="button"
                      onClick={() => setVoiceMode((current) => !current)}
                      aria-label={
                        voiceMode
                          ? "Desativar resposta em voz"
                          : "Ativar resposta em voz"
                      }
                    >
                      {voiceMode ? "Voz ativa" : "Voz pausada"}
                    </button>
                    <label className="voice-speed" htmlFor="voice-speed">
                      <span>Velocidade</span>
                      <input
                        id="voice-speed"
                        type="range"
                        min="0.7"
                        max="1.2"
                        step="0.1"
                        value={voiceSpeed}
                        onChange={(event) =>
                          setVoiceSpeed(Number(event.target.value))
                        }
                        aria-label="Velocidade da voz da IA"
                      />
                      <output>{voiceSpeed.toFixed(1)}x</output>
                    </label>
                  </div>
                  <button
                    className="send-button"
                    type="submit"
                    disabled={!draft.trim() || isSending}
                    aria-label="Enviar mensagem"
                  >
                    <span>Enviar</span>
                    <span className="send-arrow">↗</span>
                  </button>
                </div>
              </div>
            </form>
            <p className="privacy-note">
              <span>✦</span> Sua conversa fica salva neste dispositivo.
            </p>
          </section>

          <aside
            className="learning-panel"
            aria-label="Configurações da prática"
          >
            <div className="panel-header">
              <div>
                <span className="eyebrow">PERSONALIZE</span>
                <h2>Sua prática</h2>
              </div>
              <span className="panel-sparkle">✳</span>
            </div>

            <div className="setting-block">
              <label className="setting-label" htmlFor="language-select">
                <span className="setting-icon language-icon">文</span>Idioma
                para praticar
              </label>
              <div className="select-wrap">
                <span className="select-flag">{currentLanguage.flag}</span>
                <select
                  id="language-select"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  {LANGUAGES.map((item) => (
                    <option key={item.label} value={item.label}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <span className="select-chevron">⌄</span>
              </div>
            </div>

            <div className="setting-block level-setting">
              <div className="setting-label">
                <span className="setting-icon level-icon">↗</span>
                <span>Nível de proficiência</span>
                <span
                  className="info-dot"
                  title="Escolha o nível que melhor descreve sua prática atual"
                >
                  i
                </span>
              </div>
              <div
                className="level-list"
                role="radiogroup"
                aria-label="Nível de proficiência"
              >
                {LEVELS.map((item) => (
                  <button
                    className={`level-option ${level === item.code ? "selected" : ""}`}
                    key={item.code}
                    type="button"
                    role="radio"
                    aria-checked={level === item.code}
                    onClick={() => setLevel(item.code)}
                  >
                    <span className="level-code">{item.code}</span>
                    <span className="level-text">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <span className="radio-mark" />
                  </button>
                ))}
              </div>
            </div>

            <div className="assistant-settings">
              <div className="sidebar-section-label">SEU ASSISTENTE</div>
              <label htmlFor="chat-agent">Agente</label>
              <select
                id="chat-agent"
                value={selectedAgent}
                onChange={(event) => setSelectedAgent(event.target.value)}
                disabled={!agents.length}
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <label htmlFor="chat-personality">Personalidade</label>
              <select
                id="chat-personality"
                value={selectedPersonality}
                onChange={(event) => setSelectedPersonality(event.target.value)}
                disabled={!personalities.length}
              >
                {personalities.map((personality) => (
                  <option key={personality.id} value={personality.id}>
                    {personality.name}
                  </option>
                ))}
              </select>
              {optionsError && (
                <p className="assistant-settings-error" role="status">
                  {optionsError}
                </p>
              )}
              <label htmlFor="chat-voice">Voz ElevenLabs</label>
              <select
                id="chat-voice"
                value={selectedVoiceId}
                onChange={(event) => setSelectedVoiceId(event.target.value)}
                disabled={voiceCatalogLoading || !elevenLabsVoices.length}
              >
                {elevenLabsVoices.map((voice) => (
                  <option key={voice.voice_id} value={voice.voice_id}>
                    {voice.name}
                  </option>
                ))}
              </select>
              <button
                className="voice-preview"
                type="button"
                onClick={() =>
                  speakAssistantText(
                    getSpeechPreviewText(language),
                    undefined,
                    true,
                  )
                }
                disabled={voiceCatalogLoading || !selectedVoiceId}
              >
                Ouvir prévia
              </button>
              {voiceCatalogLoading && (
                <p className="assistant-settings-status">Carregando vozes...</p>
              )}
              {voiceError && (
                <p className="assistant-settings-error" role="status">
                  {voiceError}
                </p>
              )}
            </div>

            <div className="coach-card">
              <div className="coach-card-icon">✧</div>
              <div>
                <strong>Aprenda enquanto conversa</strong>
                <p>
                  Receba correções gentis e dicas práticas no fluxo do papo.
                </p>
              </div>
            </div>

            <div className="panel-footer">
              <span>FEITO PARA APRENDER</span>
              <span>
                com curiosidade <b>✳</b>
              </span>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default App;
