import { useCallback, useEffect, useState } from "react";
import "./StudentPortal.css";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload.error || `Erro do servidor (${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }
  return payload;
}

function StudentPortal({ onClose }) {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [lessons, setLessons] = useState([]);
  const [xp, setXp] = useState(0);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [translationAnswer, setTranslationAnswer] = useState("");
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [error, setError] = useState("");

  const loadLessons = useCallback(async () => {
    const result = await request("/student/lessons");
    setLessons(result.licoes);
    setXp(result.xp);
    return result;
  }, []);

  useEffect(() => {
    let active = true;
    request("/student/me")
      .then(async (student) => {
        if (!active) return;
        setUser(student);
        const result = await request("/student/lessons");
        if (active) {
          setLessons(result.licoes);
          setXp(result.xp);
        }
      })
      .catch((requestError) => {
        if (active && requestError.status !== 401) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function login(event) {
    event.preventDefault();
    if (isSubmitting) return;

    setError("");
    setIsSubmitting(true);
    try {
      const result = await request("/student/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setUser(result.user);
      setPassword("");
      await loadLessons();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
    }
  }

  async function logout() {
    setError("");
    try {
      await request("/student/logout", { method: "POST" });
      setUser(null);
      setLessons([]);
      setSelectedLesson(null);
      setXp(0);
      setUsername("");
      setPassword("");
    } catch (logoutError) {
      setError(logoutError.message);
    }
  }

  async function openLesson(lesson) {
    if (lesson.concluida) {
      setSelectedLesson(lesson);
      setExerciseIndex(lesson.exercicios.length);
      setAnswerFeedback(null);
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const detail = await request(`/student/lessons/${lesson.id}`);
      setSelectedLesson(detail);
      const firstIncomplete = detail.exercicios.findIndex(
        (exercise) => !exercise.concluido,
      );
      setExerciseIndex(
        firstIncomplete === -1 ? detail.exercicios.length : firstIncomplete,
      );
      setSelectedOption(null);
      setTranslationAnswer("");
      setAnswerFeedback(null);
    } catch (lessonError) {
      setError(lessonError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitAnswer(event) {
    event.preventDefault();
    if (!selectedLesson || isAnswering) return;
    const exercise = selectedLesson.exercicios[exerciseIndex];
    if (!exercise) return;

    setError("");
    setIsAnswering(true);
    try {
      const result = await request(
        `/student/lessons/${selectedLesson.id}/answer`,
        {
          method: "POST",
          body: JSON.stringify({
            exercicio_id: exercise.id,
            ...(exercise.tipo === "multiple_choice"
              ? { indice_escolhido: selectedOption }
              : { resposta: translationAnswer }),
          }),
        },
      );
      setAnswerFeedback(result);

      if (result.correta) {
        const updatedExercises = selectedLesson.exercicios.map((item, index) =>
          index === exerciseIndex ? { ...item, concluido: true } : item,
        );
        setSelectedLesson((current) => ({
          ...current,
          exercicios: updatedExercises,
          exercicios_concluidos: result.exercicios_concluidos,
          total_exercicios: result.total_exercicios,
          concluida: result.licao_concluida,
        }));
        setLessons((current) =>
          current.map((lesson) =>
            lesson.id === selectedLesson.id
              ? {
                  ...lesson,
                  exercicios_concluidos: result.exercicios_concluidos,
                  concluida: result.licao_concluida,
                }
              : lesson,
          ),
        );
        setXp(result.xp);
      }
    } catch (answerError) {
      setError(answerError.message);
    } finally {
      setIsAnswering(false);
    }
  }

  function continueLesson() {
    if (!selectedLesson || !answerFeedback?.correta) return;
    const nextIndex = exerciseIndex + 1;
    if (nextIndex >= selectedLesson.exercicios.length) {
      setSelectedLesson(null);
      setAnswerFeedback(null);
      loadLessons().catch((loadError) => setError(loadError.message));
      return;
    }
    setExerciseIndex(nextIndex);
    setSelectedOption(null);
    setTranslationAnswer("");
    setAnswerFeedback(null);
  }

  const groupedLessons = LEVEL_ORDER.map((level) => ({
    level,
    lessons: lessons.filter((lesson) => lesson.nivel === level),
  })).filter((group) => group.lessons.length > 0);

  return (
    <div
      className="student-portal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="student-portal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Área do aluno"
      >
        <header className="student-portal-header">
          <a className="student-portal-brand" href="#top">
            <img src="/logo.png" alt="" />
            <span>World<span>.</span></span>
          </a>
          {user && (
            <div className="student-portal-profile">
              <span className="student-portal-xp">✦ {xp} XP</span>
              <span className="student-portal-username">{user.username}</span>
              <button type="button" onClick={logout}>
                Sair
              </button>
            </div>
          )}
          <button
            className="student-portal-close"
            type="button"
            onClick={onClose}
            aria-label="Fechar área do aluno"
          >
            ×
          </button>
        </header>

        {isLoading ? (
          <div className="student-portal-loading" role="status">
            Preparando sua trilha…
          </div>
        ) : !user ? (
          <div className="student-login-layout">
            <div className="student-login-intro">
              <span className="student-login-sparkle" aria-hidden="true">
                ✦
              </span>
              <p className="student-portal-eyebrow">SUA JORNADA COMEÇA AQUI</p>
              <h1 id="student-portal-title">
                Um pouquinho por dia. <span>Grandes conquistas.</span>
              </h1>
              <p>
                Entre para encontrar as lições da sua turma, praticar no seu
                ritmo e acompanhar seu progresso.
              </p>
              <div className="student-login-feature">
                <span>✓</span> Lições criadas especialmente para sua turma
              </div>
              <div className="student-login-feature">
                <span>✓</span> Seu progresso fica salvo automaticamente
              </div>
            </div>
            <form className="student-login-card" onSubmit={login}>
              <span className="student-portal-eyebrow">BEM-VINDO DE VOLTA</span>
              <h2>Entrar na minha conta</h2>
              <p>Use os dados de acesso fornecidos pelo administrador.</p>
              <label htmlFor="student-username">Usuário ou e-mail</label>
              <input
                id="student-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
                autoFocus
              />
              <label htmlFor="student-password">Senha</label>
              <input
                id="student-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              {error && (
                <p className="student-portal-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="student-portal-primary"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Entrando…" : "Entrar"}
                <span aria-hidden="true">→</span>
              </button>
              <small>
                Ainda não tem conta? Peça ao administrador para criar seu
                acesso.
              </small>
            </form>
          </div>
        ) : user.turma_id == null ? (
          <div className="student-portal-empty">
            <span aria-hidden="true">✧</span>
            <h1 id="student-portal-title">Sua conta ainda não tem uma turma</h1>
            <p>
              Peça ao administrador para vincular seu usuário a uma turma e
              depois entre novamente.
            </p>
            {error && (
              <p className="student-portal-error" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : selectedLesson ? (
          <div className="student-exercise-view">
            <button
              className="student-back-button"
              type="button"
              onClick={() => {
                setSelectedLesson(null);
                setAnswerFeedback(null);
              }}
            >
              <span aria-hidden="true">←</span> Minha trilha
            </button>
            <div className="student-exercise-progress">
              <div
                className="student-exercise-progress-fill"
                style={{
                  width: `${
                    (Math.min(
                      exerciseIndex + (answerFeedback?.correta ? 1 : 0),
                      selectedLesson.exercicios.length,
                    ) /
                      selectedLesson.exercicios.length) *
                    100
                  }%`,
                }}
              />
            </div>
            {exerciseIndex >= selectedLesson.exercicios.length ? (
              <div className="student-lesson-complete">
                <span className="student-completion-badge" aria-hidden="true">
                  ★
                </span>
                <p className="student-portal-eyebrow">MISSÃO CUMPRIDA</p>
                <h1 id="student-portal-title">
                  Lição concluída! <span>+{selectedLesson.total_exercicios * 10} XP</span>
                </h1>
                <p>
                  Mandou bem! Todo passo conta. Sua próxima lição já está
                  esperando na trilha.
                </p>
                <button
                  className="student-portal-primary"
                  type="button"
                  onClick={() => {
                    setSelectedLesson(null);
                    loadLessons().catch((loadError) =>
                      setError(loadError.message),
                    );
                  }}
                >
                  Voltar para a trilha <span aria-hidden="true">→</span>
                </button>
              </div>
            ) : (
              <>
                <div className="student-exercise-heading">
                  <span className="student-exercise-level">
                    {selectedLesson.nivel}
                  </span>
                  <span>
                    {selectedLesson.titulo} · Exercício {exerciseIndex + 1} de{" "}
                    {selectedLesson.exercicios.length}
                  </span>
                </div>
                <form
                  className="student-exercise-card"
                  onSubmit={submitAnswer}
                >
                  <p className="student-portal-eyebrow">
                    {selectedLesson.exercicios[exerciseIndex]?.tipo ===
                    "multiple_choice"
                      ? "ESCOLHA A RESPOSTA CERTA"
                      : "ESCREVA SUA TRADUÇÃO"}
                  </p>
                  <h1 id="student-portal-title">
                    {selectedLesson.exercicios[exerciseIndex]?.enunciado}
                  </h1>
                  {selectedLesson.exercicios[exerciseIndex]?.tipo ===
                  "multiple_choice" ? (
                    <div className="student-answer-options">
                      {selectedLesson.exercicios[exerciseIndex].opcoes.map(
                        (option, index) => (
                          <button
                            className={
                              selectedOption === index ? "selected" : ""
                            }
                            type="button"
                            key={`${selectedLesson.id}-${exerciseIndex}-${index}`}
                            onClick={() => setSelectedOption(index)}
                            disabled={Boolean(answerFeedback?.correta)}
                          >
                            <span className="student-answer-letter">
                              {String.fromCharCode(65 + index)}
                            </span>
                            {option}
                          </button>
                        ),
                      )}
                    </div>
                  ) : (
                    <label className="student-translation-answer">
                      Sua tradução
                      <textarea
                        value={translationAnswer}
                        onChange={(event) =>
                          setTranslationAnswer(event.target.value)
                        }
                        placeholder="Digite sua resposta aqui…"
                        rows={3}
                        maxLength={500}
                        disabled={Boolean(answerFeedback?.correta)}
                        autoFocus
                        required
                      />
                    </label>
                  )}
                  {error && (
                    <p className="student-portal-error" role="alert">
                      {error}
                    </p>
                  )}
                  {answerFeedback && (
                    <div
                      className={`student-answer-feedback ${
                        answerFeedback.correta ? "correct" : "incorrect"
                      }`}
                      role="status"
                    >
                      <strong>
                        {answerFeedback.correta ? "Muito bem!" : "Quase lá!"}
                      </strong>
                      {!answerFeedback.correta &&
                        selectedLesson.exercicios[exerciseIndex]?.tipo ===
                          "multiple_choice" && (
                          <span>
                            Resposta certa:{" "}
                            {
                              selectedLesson.exercicios[exerciseIndex].opcoes[
                                answerFeedback.indice_correto
                              ]
                            }
                          </span>
                        )}
                      {!answerFeedback.correta &&
                        answerFeedback.respostas_aceitas?.length > 0 && (
                          <span>
                            Resposta aceita:{" "}
                            {answerFeedback.respostas_aceitas.join(" · ")}
                          </span>
                        )}
                      {answerFeedback.correta && (
                        <span>Resposta correta! Você ganhou 10 XP.</span>
                      )}
                    </div>
                  )}
                  {answerFeedback?.correta ? (
                    <button
                      className="student-portal-primary"
                      type="button"
                      onClick={continueLesson}
                    >
                      {exerciseIndex + 1 >=
                      selectedLesson.exercicios.length
                        ? "Concluir lição"
                        : "Continuar"}
                      <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <button
                      className="student-portal-primary"
                      type="submit"
                      disabled={
                        isAnswering ||
                        (selectedLesson.exercicios[exerciseIndex]?.tipo ===
                        "multiple_choice"
                          ? selectedOption == null
                          : !translationAnswer.trim())
                      }
                    >
                      {isAnswering ? "Conferindo…" : "Conferir resposta"}
                      <span aria-hidden="true">→</span>
                    </button>
                  )}
                </form>
              </>
            )}
          </div>
        ) : (
          <div className="student-path-view">
            <div className="student-path-hero">
              <div>
                <p className="student-portal-eyebrow">SUA TRILHA DE APRENDIZADO</p>
                <h1 id="student-portal-title">
                  Olá, {user.username}! <span>Vamos avançar?</span>
                </h1>
                <p>
                  {user.turma?.idioma || "Idioma"} ·{" "}
                  {user.turma?.dia || "Sua turma"}
                  {user.turma?.horario ? ` · ${user.turma.horario}` : ""}
                </p>
              </div>
              <div className="student-path-xp">
                <span aria-hidden="true">✦</span>
                <strong>{xp}</strong>
                <small>pontos XP</small>
              </div>
            </div>

            {error && (
              <p className="student-portal-error" role="alert">
                {error}
              </p>
            )}

            {groupedLessons.length === 0 ? (
              <div className="student-portal-empty">
                <span aria-hidden="true">✧</span>
                <h2>Nenhuma lição foi publicada ainda</h2>
                <p>
                  Assim que o administrador adicionar exercícios para sua
                  turma, eles aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="student-level-path">
                {groupedLessons.map((group, groupIndex) => {
                  const completed = group.lessons.filter(
                    (lesson) => lesson.concluida,
                  ).length;
                  return (
                    <section
                      className="student-level-section"
                      key={group.level}
                    >
                      <div className="student-level-heading">
                        <div className="student-level-heading-icon">
                          {group.level}
                        </div>
                        <div>
                          <p className="student-portal-eyebrow">
                            ETAPA {groupIndex + 1}
                          </p>
                          <h2>Nível {group.level}</h2>
                          <span>
                            {completed} de {group.lessons.length} lições
                            concluídas
                          </span>
                        </div>
                        <div className="student-level-progress">
                          {Math.round(
                            (completed / group.lessons.length) * 100,
                          )}
                          %
                        </div>
                      </div>
                      <div className="student-lesson-path">
                        {group.lessons.map((lesson, index) => (
                          <button
                            className={`student-lesson-node ${
                              lesson.concluida ? "completed" : ""
                            }`}
                            key={lesson.id}
                            type="button"
                            onClick={() => openLesson(lesson)}
                            disabled={isLoading}
                            style={{
                              "--path-offset": `${index % 2 === 0 ? 0 : 38}px`,
                            }}
                          >
                            <span className="student-lesson-node-icon">
                              {lesson.concluida ? "✓" : "★"}
                            </span>
                            <span className="student-lesson-node-copy">
                              <strong>{lesson.titulo}</strong>
                              <small>
                                {lesson.exercicios_concluidos}/
                                {lesson.total_exercicios} exercícios
                              </small>
                            </span>
                            <span className="student-lesson-node-action">
                              {lesson.concluida ? "Rever" : "Começar"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default StudentPortal;
