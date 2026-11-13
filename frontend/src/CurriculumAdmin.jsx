import { useRef, useState } from "react";
import "./CurriculumAdmin.css";

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

const LEVELS = [
  { code: "A1", name: "Iniciante" },
  { code: "A2", name: "Básico" },
  { code: "B1", name: "Intermediário" },
  { code: "B2", name: "Intermediário avançado" },
  { code: "C1", name: "Avançado" },
  { code: "C2", name: "Proficiente" },
];

const LANGUAGES = [
  "English",
  "Español",
  "Français",
  "Deutsch",
  "Italiano",
  "Português",
  "日本語",
];

const WEEKDAYS = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];

function createExercise(type = "multiple_choice") {
  return {
    key: `${Date.now()}-${Math.random()}`,
    tipo: type,
    enunciado: "",
    opcoes: ["", "", "", ""],
    indice_correto: 0,
    resposta_correta: "",
    outras_respostas: "",
  };
}

async function request(path, adminKey, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      "X-Admin-Key": adminKey,
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Erro do servidor (${response.status}).`);
  }
  return payload;
}

function classLabel(item) {
  return [item.idioma, item.dia, item.horario].filter(Boolean).join(" · ");
}

function CurriculumAdmin({ onClose }) {
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [activeTab, setActiveTab] = useState("lessons");
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [level, setLevel] = useState("A1");
  const [language, setLanguage] = useState("English");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [exercises, setExercises] = useState([createExercise()]);
  const [studentUsername, setStudentUsername] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [isClassFormOpen, setIsClassFormOpen] = useState(false);
  const [classLanguage, setClassLanguage] = useState("English");
  const [classDay, setClassDay] = useState("");
  const [classTime, setClassTime] = useState("");
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lessonRequestIdRef = useRef(0);
  const studentRequestIdRef = useRef(0);

  async function loadStudents(classId, key = adminKey) {
    const requestId = ++studentRequestIdRef.current;
    if (!classId || !key) {
      setStudents([]);
      setIsLoadingStudents(false);
      return;
    }

    setError("");
    setIsLoadingStudents(true);
    try {
      const items = await request(
        `/admin/usuarios?turma_id=${encodeURIComponent(classId)}`,
        key,
      );
      if (requestId === studentRequestIdRef.current) setStudents(items);
    } catch (loadError) {
      if (requestId === studentRequestIdRef.current) {
        setError(loadError.message);
      }
    } finally {
      if (requestId === studentRequestIdRef.current) {
        setIsLoadingStudents(false);
      }
    }
  }

  async function loadLessons(classId, key = adminKey) {
    const requestId = ++lessonRequestIdRef.current;
    if (!classId || !key) {
      setLessons([]);
      setIsLoading(false);
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const items = await request(
        `/admin/curriculo/licoes?turma_id=${encodeURIComponent(classId)}`,
        key,
      );
      if (requestId === lessonRequestIdRef.current) setLessons(items);
    } catch (loadError) {
      if (requestId === lessonRequestIdRef.current) setError(loadError.message);
    } finally {
      if (requestId === lessonRequestIdRef.current) setIsLoading(false);
    }
  }

  async function createClass(event) {
    event.preventDefault();
    if (isCreatingClass) return;

    setError("");
    setNotice("");
    setIsCreatingClass(true);
    try {
      const createdClass = await request("/admin/turmas", adminKey, {
        method: "POST",
        body: JSON.stringify({
          idioma: classLanguage,
          dia: classDay,
          horario: classTime,
        }),
      });
      setClasses((current) => [...current, createdClass]);
      setSelectedClassId(String(createdClass.id));
      setLessons([]);
      setStudents([]);
      setIsClassFormOpen(false);
      setClassDay("");
      setClassTime("");
      setActiveTab("lessons");
      await loadLessons(String(createdClass.id));
      setNotice(`Turma de ${createdClass.idioma} criada com sucesso.`);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setIsCreatingClass(false);
    }
  }

  async function unlockAdminArea(event) {
    event.preventDefault();
    const key = adminKeyInput.trim();
    if (!key || isLoading) return;

    setError("");
    setIsLoading(true);
    try {
      const availableClasses = await request("/admin/turmas", key);
      setClasses(availableClasses);
      setAdminKey(key);
      const initialClassId = availableClasses[0]
        ? String(availableClasses[0].id)
        : "";
      setSelectedClassId(initialClassId);
      setIsAuthorized(true);
      if (initialClassId) {
        await loadLessons(initialClassId, key);
      }
    } catch (requestError) {
      setError(
        requestError.message.includes("not configured")
          ? "O acesso administrativo ainda não foi configurado no servidor."
          : requestError.message,
      );
    } finally {
      setIsLoading(false);
    }
  }

  function resetEditor() {
    setEditingLessonId(null);
    setLevel("A1");
    setLanguage("English");
    setTitle("");
    setDescription("");
    setExercises([createExercise()]);
    setError("");
    setNotice("");
  }

  function editLesson(lesson) {
    setEditingLessonId(lesson.id);
    setSelectedClassId(String(lesson.turma_id));
    setLevel(lesson.nivel);
    setLanguage(lesson.idioma);
    setTitle(lesson.titulo);
    setDescription(lesson.descricao || "");
    setExercises(
      lesson.exercicios.map((exercise) => {
        const acceptedAnswers =
          exercise.respostas_aceitas ||
          (exercise.resposta_correta ? [exercise.resposta_correta] : []);
        return {
          ...exercise,
          resposta_correta: acceptedAnswers[0] || "",
          outras_respostas: acceptedAnswers.slice(1).join("\n"),
          key: `${exercise.id}-${Date.now()}`,
        };
      }),
    );
    setError("");
    setNotice("");
    document
      .querySelector(".curriculum-admin-editor")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateExercise(index, patch) {
    setExercises((current) =>
      current.map((exercise, position) =>
        position === index ? { ...exercise, ...patch } : exercise,
      ),
    );
  }

  function updateOption(exerciseIndex, optionIndex, value) {
    setExercises((current) =>
      current.map((exercise, index) =>
        index === exerciseIndex
          ? {
              ...exercise,
              opcoes: exercise.opcoes.map((option, choiceIndex) =>
                choiceIndex === optionIndex ? value : option,
              ),
            }
          : exercise,
      ),
    );
  }

  async function saveLesson(event) {
    event.preventDefault();
    if (isSaving) return;

    setError("");
    setNotice("");
    setIsSaving(true);
    const payload = {
      turma_id: Number(selectedClassId),
      nivel: level,
      idioma: language,
      titulo: title,
      descricao: description,
      exercicios: exercises.map((exercise) => ({
        tipo: exercise.tipo,
        enunciado: exercise.enunciado,
        ...(exercise.tipo === "multiple_choice"
          ? {
              opcoes: exercise.opcoes,
              indice_correto: exercise.indice_correto,
            }
          : {
              respostas_aceitas: [
                exercise.resposta_correta,
                ...exercise.outras_respostas
                  .split(/\r?\n/)
                  .map((answer) => answer.trim())
                  .filter(Boolean),
              ],
            }),
      })),
    };

    try {
      const saved = await request(
        editingLessonId
          ? `/admin/curriculo/licoes/${editingLessonId}`
          : "/admin/curriculo/licoes",
        adminKey,
        {
          method: editingLessonId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      setLessons((current) =>
        editingLessonId
          ? current.map((lesson) => (lesson.id === saved.id ? saved : lesson))
          : [...current, saved],
      );
      const successMessage = editingLessonId
        ? "Lição atualizada."
        : "Lição criada.";
      resetEditor();
      setNotice(successMessage);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteLesson(lesson) {
    if (!window.confirm(`Excluir a lição “${lesson.titulo}”?`)) return;

    setError("");
    setNotice("");
    try {
      await request(`/admin/curriculo/licoes/${lesson.id}`, adminKey, {
        method: "DELETE",
      });
      setLessons((current) => current.filter((item) => item.id !== lesson.id));
      if (editingLessonId === lesson.id) resetEditor();
      setNotice("Lição excluída.");
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  async function createStudent(event) {
    event.preventDefault();
    if (!selectedClassId || isCreatingStudent) return;

    setError("");
    setNotice("");
    setIsCreatingStudent(true);
    try {
      const student = await request("/admin/usuarios", adminKey, {
        method: "POST",
        body: JSON.stringify({
          username: studentUsername,
          email: studentEmail,
          password: studentPassword,
          turma_id: Number(selectedClassId),
          idioma: language,
        }),
      });
      setStudents((current) =>
        [...current, student].sort((first, second) =>
          first.username.localeCompare(second.username),
        ),
      );
      setStudentUsername("");
      setStudentEmail("");
      setStudentPassword("");
      setNotice(`Conta de ${student.username} criada para esta turma.`);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setIsCreatingStudent(false);
    }
  }

  return (
    <div
      className="curriculum-admin-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="curriculum-admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="curriculum-admin-title"
      >
        <header className="curriculum-admin-header">
          <div>
            <span className="curriculum-admin-eyebrow">ESPAÇO DO ADMINISTRADOR</span>
            <h2 id="curriculum-admin-title">Trilhas e exercícios</h2>
            <p>Monte lições por turma e nível, sem precisar mexer em código.</p>
          </div>
          <button
            className="curriculum-admin-close"
            type="button"
            onClick={onClose}
            aria-label="Fechar área do administrador"
          >
            ×
          </button>
        </header>

        {!isAuthorized ? (
          <form
            className="curriculum-admin-access"
            onSubmit={unlockAdminArea}
          >
            <div className="curriculum-admin-welcome-icon" aria-hidden="true">
              ✦
            </div>
            <h3>Acesso de administrador</h3>
            <p>
              Digite a chave administrativa configurada no servidor para
              começar a organizar o conteúdo.
            </p>
            <label htmlFor="curriculum-admin-key">Chave administrativa</label>
            <input
              id="curriculum-admin-key"
              type="password"
              autoComplete="current-password"
              value={adminKeyInput}
              onChange={(event) => setAdminKeyInput(event.target.value)}
              required
              autoFocus
            />
            {error && (
              <p className="curriculum-admin-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="curriculum-admin-primary"
              type="submit"
              disabled={!adminKeyInput.trim() || isLoading}
            >
              {isLoading ? "Verificando…" : "Entrar no painel"}
            </button>
          </form>
        ) : (
          <div className="curriculum-admin-content">
            {error && (
              <p className="curriculum-admin-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="curriculum-admin-notice" role="status">
                {notice}
              </p>
            )}

            <div className="curriculum-admin-class-tools">
              {classes.length > 0 && (
                <div className="curriculum-admin-class-picker">
                  <label htmlFor="curriculum-class">Turma</label>
                  <select
                    id="curriculum-class"
                    value={selectedClassId}
                    onChange={(event) => {
                      const classId = event.target.value;
                      setSelectedClassId(classId);
                      setLessons([]);
                      setStudents([]);
                      if (editingLessonId) resetEditor();
                      loadLessons(classId);
                      if (activeTab === "students") loadStudents(classId);
                    }}
                  >
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {classLabel(item) || `Turma ${item.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                className="curriculum-admin-secondary"
                type="button"
                onClick={() => setIsClassFormOpen((isOpen) => !isOpen)}
                aria-expanded={isClassFormOpen}
              >
                {isClassFormOpen ? "Cancelar" : "+ Criar turma"}
              </button>
            </div>

            {isClassFormOpen && (
              <form
                className="curriculum-admin-class-form"
                onSubmit={createClass}
              >
                <div className="curriculum-admin-section-heading">
                  <span className="curriculum-admin-step">+</span>
                  <div>
                    <h3>Nova turma</h3>
                    <p>
                      Escolha o idioma e o horário para identificar a turma.
                    </p>
                  </div>
                </div>
                <div className="curriculum-admin-class-form-fields">
                  <label>
                    Idioma
                    <select
                      value={classLanguage}
                      onChange={(event) => setClassLanguage(event.target.value)}
                      required
                    >
                      {LANGUAGES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Dia da semana
                    <select
                      value={classDay}
                      onChange={(event) => setClassDay(event.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Selecione um dia
                      </option>
                      {WEEKDAYS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Horário
                    <input
                      type="time"
                      value={classTime}
                      onChange={(event) => setClassTime(event.target.value)}
                      required
                    />
                  </label>
                </div>
                <button
                  className="curriculum-admin-primary"
                  type="submit"
                  disabled={isCreatingClass}
                >
                  {isCreatingClass ? "Criando turma…" : "Criar turma"}
                </button>
              </form>
            )}

            {classes.length === 0 ? (
              <div className="curriculum-admin-empty">
                <span aria-hidden="true">✧</span>
                <h3>Nenhuma turma cadastrada ainda</h3>
                <p>
                  Crie sua primeira turma para organizar alunos e exercícios
                  por idioma e horário.
                </p>
                {!isClassFormOpen && (
                  <button
                    className="curriculum-admin-primary"
                    type="button"
                    onClick={() => setIsClassFormOpen(true)}
                  >
                    Criar primeira turma
                  </button>
                )}
              </div>
            ) : (
              <>
                <div
                  className="curriculum-admin-tabs"
                  role="tablist"
                  aria-label="Gerenciar conteúdo ou alunos"
                >
                  <button
                    className={activeTab === "lessons" ? "active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "lessons"}
                    onClick={() => setActiveTab("lessons")}
                  >
                    Lições e exercícios
                  </button>
                  <button
                    className={activeTab === "students" ? "active" : ""}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "students"}
                    onClick={() => {
                      setActiveTab("students");
                      loadStudents(selectedClassId);
                    }}
                  >
                    Contas dos alunos
                  </button>
                </div>

                {activeTab === "lessons" ? (
                <div className="curriculum-admin-columns">
                  <form
                    className="curriculum-admin-editor"
                    onSubmit={saveLesson}
                  >
                    <div className="curriculum-admin-section-heading">
                      <span className="curriculum-admin-step">1</span>
                      <div>
                        <h3>{editingLessonId ? "Editar lição" : "Nova lição"}</h3>
                        <p>Escolha o nível e dê um nome fácil de reconhecer.</p>
                      </div>
                    </div>

                    <div className="curriculum-admin-fields">
                      <label>
                        Nível
                        <select
                          value={level}
                          onChange={(event) => setLevel(event.target.value)}
                        >
                          {LEVELS.map((item) => (
                            <option key={item.code} value={item.code}>
                              {item.code} · {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Idioma
                        <select
                          value={language}
                          onChange={(event) => setLanguage(event.target.value)}
                        >
                          {LANGUAGES.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="curriculum-admin-field">
                      Nome da lição
                      <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Ex.: Cumprimentos do dia a dia"
                        maxLength={120}
                        required
                      />
                    </label>
                    <label className="curriculum-admin-field">
                      Instrução curta para o aluno (opcional)
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Ex.: Pratique formas comuns de dizer olá e se despedir."
                        rows={2}
                        maxLength={500}
                      />
                    </label>

                    <div className="curriculum-admin-exercises-heading">
                      <div className="curriculum-admin-section-heading">
                        <span className="curriculum-admin-step">2</span>
                        <div>
                          <h3>Exercícios</h3>
                          <p>
                            Escreva a pergunta e escolha a resposta certa.
                          </p>
                        </div>
                      </div>
                      <span>{exercises.length} adicionados</span>
                    </div>

                    <div className="curriculum-admin-exercises">
                      {exercises.map((exercise, index) => (
                        <fieldset
                          className="curriculum-admin-exercise"
                          key={exercise.key}
                        >
                          <legend>Exercício {index + 1}</legend>
                          <label>
                            Formato
                            <select
                              value={exercise.tipo}
                              onChange={(event) => {
                                const nextType = event.target.value;
                                updateExercise(index, {
                                  ...createExercise(nextType),
                                  key: exercise.key,
                                });
                              }}
                            >
                              <option value="multiple_choice">
                                Escolher a resposta correta
                              </option>
                              <option value="translation">
                                Traduzir uma frase
                              </option>
                            </select>
                          </label>
                          {exercise.tipo === "multiple_choice" ? (
                            <>
                              <label>
                                Pergunta ou instrução
                                <textarea
                                  value={exercise.enunciado}
                                  onChange={(event) =>
                                    updateExercise(index, {
                                      enunciado: event.target.value,
                                    })
                                  }
                                  placeholder="Ex.: Como se diz “bom dia” em inglês?"
                                  rows={2}
                                  maxLength={500}
                                  required
                                />
                              </label>
                              <div className="curriculum-admin-choice-heading">
                                <span>Opções</span>
                                <small>Marque o círculo da resposta certa.</small>
                              </div>
                              <div className="curriculum-admin-choices">
                                {exercise.opcoes.map((option, optionIndex) => (
                                  <div
                                    className="curriculum-admin-choice"
                                    key={`${exercise.key}-${optionIndex}`}
                                  >
                                    <input
                                      type="radio"
                                      name={`correct-${exercise.key}`}
                                      checked={
                                        exercise.indice_correto === optionIndex
                                      }
                                      onChange={() =>
                                        updateExercise(index, {
                                          indice_correto: optionIndex,
                                        })
                                      }
                                      aria-label={`Marcar opção ${optionIndex + 1} como correta`}
                                    />
                                    <input
                                      value={option}
                                      onChange={(event) =>
                                        updateOption(
                                          index,
                                          optionIndex,
                                          event.target.value,
                                        )
                                      }
                                      placeholder={`Resposta ${optionIndex + 1}`}
                                      maxLength={160}
                                      required
                                      aria-label={`Texto da opção ${optionIndex + 1}`}
                                    />
                                    {exercise.opcoes.length > 2 && (
                                      <button
                                        className="curriculum-admin-remove-choice"
                                        type="button"
                                        onClick={() =>
                                          updateExercise(index, {
                                            opcoes: exercise.opcoes.filter(
                                              (_, choiceIndex) =>
                                                choiceIndex !== optionIndex,
                                            ),
                                            indice_correto:
                                              exercise.indice_correto ===
                                              optionIndex
                                                ? 0
                                                : exercise.indice_correto >
                                                    optionIndex
                                                  ? exercise.indice_correto - 1
                                                  : exercise.indice_correto,
                                          })
                                        }
                                        aria-label={`Remover opção ${optionIndex + 1}`}
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {exercise.opcoes.length < 6 && (
                                <button
                                  className="curriculum-admin-text-button"
                                  type="button"
                                  onClick={() =>
                                    updateExercise(index, {
                                      opcoes: [...exercise.opcoes, ""],
                                    })
                                  }
                                >
                                  + Adicionar uma opção
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <label>
                                Frase que o aluno vai traduzir
                                <textarea
                                  value={exercise.enunciado}
                                  onChange={(event) =>
                                    updateExercise(index, {
                                      enunciado: event.target.value,
                                    })
                                  }
                                  placeholder={`Ex.: Escreva em ${language}: “Até amanhã!”`}
                                  rows={2}
                                  maxLength={500}
                                  required
                                />
                              </label>
                              <label>
                                Resposta principal
                                <input
                                  value={exercise.resposta_correta}
                                  onChange={(event) =>
                                    updateExercise(index, {
                                      resposta_correta: event.target.value,
                                    })
                                  }
                                  placeholder={`Digite a tradução em ${language}`}
                                  maxLength={500}
                                  required
                                />
                              </label>
                              <label>
                                Outras respostas aceitas (uma por linha)
                                <textarea
                                  value={exercise.outras_respostas}
                                  onChange={(event) =>
                                    updateExercise(index, {
                                      outras_respostas: event.target.value,
                                    })
                                  }
                                  placeholder={
                                    language === "日本語"
                                      ? "Ex.: konnichiwa\nこんにちは"
                                      : "Adicione traduções alternativas, se houver."
                                  }
                                  rows={3}
                                  maxLength={3500}
                                />
                                <small className="curriculum-admin-help">
                                  Na tradução japonesa, inclua aqui as formas
                                  que devem valer, como romaji, hiragana ou
                                  kanji. Maiúsculas, acentos e pontuação serão
                                  ignorados.
                                </small>
                              </label>
                            </>
                          )}
                          {exercises.length > 1 && (
                            <button
                              className="curriculum-admin-remove-exercise"
                              type="button"
                              onClick={() =>
                                setExercises((current) =>
                                  current.filter((_, position) => position !== index),
                                )
                              }
                            >
                              Remover exercício
                            </button>
                          )}
                        </fieldset>
                      ))}
                    </div>

                    <div className="curriculum-admin-add-buttons">
                      <button
                        className="curriculum-admin-secondary"
                        type="button"
                        onClick={() =>
                          setExercises((current) => [
                            ...current,
                            createExercise("multiple_choice"),
                          ])
                        }
                        disabled={exercises.length >= 50}
                      >
                        + Múltipla escolha
                      </button>
                      <button
                        className="curriculum-admin-secondary"
                        type="button"
                        onClick={() =>
                          setExercises((current) => [
                            ...current,
                            createExercise("translation"),
                          ])
                        }
                        disabled={exercises.length >= 50}
                      >
                        + Tradução
                      </button>
                    </div>

                    <div className="curriculum-admin-save-row">
                      {editingLessonId && (
                        <button
                          className="curriculum-admin-text-button"
                          type="button"
                          onClick={resetEditor}
                        >
                          Cancelar edição
                        </button>
                      )}
                      <button
                        className="curriculum-admin-primary"
                        type="submit"
                        disabled={isSaving || !selectedClassId}
                      >
                        {isSaving
                          ? "Salvando…"
                          : editingLessonId
                            ? "Salvar alterações"
                            : "Criar lição"}
                      </button>
                    </div>
                  </form>

                  <aside className="curriculum-admin-library">
                    <div className="curriculum-admin-section-heading">
                      <span className="curriculum-admin-step">✓</span>
                      <div>
                        <h3>Lições da turma</h3>
                        <p>O conteúdo já criado para esta turma.</p>
                      </div>
                    </div>
                    {isLoading ? (
                      <p className="curriculum-admin-muted" role="status">
                        Carregando lições…
                      </p>
                    ) : lessons.length === 0 ? (
                      <div className="curriculum-admin-empty-small">
                        <span aria-hidden="true">✧</span>
                        <p>
                          Ainda não há lições. Crie a primeira usando o
                          formulário ao lado.
                        </p>
                      </div>
                    ) : (
                      <div className="curriculum-admin-lesson-list">
                        {lessons.map((lesson) => (
                          <article
                            className="curriculum-admin-lesson-card"
                            key={lesson.id}
                          >
                            <div className="curriculum-admin-lesson-level">
                              {lesson.nivel}
                            </div>
                            <div className="curriculum-admin-lesson-copy">
                              <strong>{lesson.titulo}</strong>
                              <span>
                                {lesson.idioma} · {lesson.exercicios.length}{" "}
                                exercícios
                              </span>
                            </div>
                            <div className="curriculum-admin-lesson-actions">
                              <button
                                type="button"
                                onClick={() => editLesson(lesson)}
                                aria-label={`Editar ${lesson.titulo}`}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteLesson(lesson)}
                                aria-label={`Excluir ${lesson.titulo}`}
                              >
                                Excluir
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </aside>
                </div>
                ) : (
                  <div className="curriculum-admin-students">
                    <form
                      className="curriculum-admin-student-form"
                      onSubmit={createStudent}
                    >
                      <div className="curriculum-admin-section-heading">
                        <span className="curriculum-admin-step">+</span>
                        <div>
                          <h3>Criar conta de aluno</h3>
                          <p>
                            A conta será vinculada automaticamente à turma
                            selecionada.
                          </p>
                        </div>
                      </div>
                      <div className="curriculum-admin-fields">
                        <label>
                          Nome de usuário
                          <input
                            value={studentUsername}
                            onChange={(event) =>
                              setStudentUsername(event.target.value)
                            }
                            placeholder="Ex.: maria.silva"
                            maxLength={80}
                            autoComplete="off"
                            required
                          />
                        </label>
                        <label>
                          E-mail
                          <input
                            type="email"
                            value={studentEmail}
                            onChange={(event) =>
                              setStudentEmail(event.target.value)
                            }
                            placeholder="aluno@exemplo.com"
                            maxLength={120}
                            autoComplete="off"
                            required
                          />
                        </label>
                      </div>
                      <label className="curriculum-admin-field">
                        Senha inicial (mínimo 8 caracteres)
                        <input
                          type="password"
                          value={studentPassword}
                          onChange={(event) =>
                            setStudentPassword(event.target.value)
                          }
                          minLength={8}
                          autoComplete="new-password"
                          required
                        />
                      </label>
                      <button
                        className="curriculum-admin-primary"
                        type="submit"
                        disabled={isCreatingStudent}
                      >
                        {isCreatingStudent
                          ? "Criando conta…"
                          : "Criar conta do aluno"}
                      </button>
                    </form>

                    <section className="curriculum-admin-student-list">
                      <div className="curriculum-admin-section-heading">
                        <span className="curriculum-admin-step">
                          {students.length}
                        </span>
                        <div>
                          <h3>Alunos desta turma</h3>
                          <p>
                            Compartilhe com cada aluno o nome de usuário e a
                            senha inicial.
                          </p>
                        </div>
                      </div>
                      {isLoadingStudents ? (
                        <p className="curriculum-admin-muted" role="status">
                          Carregando alunos…
                        </p>
                      ) : students.length === 0 ? (
                        <div className="curriculum-admin-empty-small">
                          <span aria-hidden="true">✧</span>
                          <p>
                            Ainda não há contas de aluno nesta turma.
                          </p>
                        </div>
                      ) : (
                        <div className="curriculum-admin-lesson-list">
                          {students.map((student) => (
                            <article
                              className="curriculum-admin-lesson-card"
                              key={student.id}
                            >
                              <div className="curriculum-admin-lesson-level">
                                {student.username.slice(0, 1).toUpperCase()}
                              </div>
                              <div className="curriculum-admin-lesson-copy">
                                <strong>{student.username}</strong>
                                <span>{student.email}</span>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default CurriculumAdmin;
