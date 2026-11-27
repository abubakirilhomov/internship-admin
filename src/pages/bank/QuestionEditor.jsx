import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../utils/api";
import {
  ANSWER_KINDS, EDITORS, LEVELS, RU_STATUS, TESTABLE_EDITORS, TOPICS, FormError,
  addTest, effectiveEditor, emptyForm, isValidCode, patchTest, pythonDefaults, removeTest, toCreateBody, toForm, toPatch,
  tracksFor, translationHint,
} from "./bankForm";

// Редактор вопроса банка (только админ): создание, правка, архивирование. Правка не меняет
// прошедшие и идущие собеседования — в сессиях лежит снимок вопроса на момент старта.
const field = "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400";
const mono = `${field} font-mono text-xs`;

function Label({ children, hint }) {
  return (
    <span className="block text-xs font-medium text-slate-600 mb-1">
      {children}{hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
    </span>
  );
}

export default function QuestionEditor({ question, onClose, onSaved }) {
  const isNew = !question;
  const original = useMemo(() => (question ? toForm(question) : null), [question]);
  const [form, setForm] = useState(() => (question ? toForm(question) : emptyForm()));
  const [lang, setLang] = useState("uz");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [blockedBy, setBlockedBy] = useState([]);
  const set = (p) => setForm((f) => ({ ...f, ...p }));

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const hint = translationHint(form, original);
  const patch = useMemo(() => {
    if (isNew) return null;
    try { return toPatch(form, original); } catch { return {}; }
  }, [form, original, isNew]);
  const dirty = isNew || Object.keys(patch).length > 0;
  const editor = effectiveEditor(form);
  const canTest = TESTABLE_EDITORS.includes(editor) && (form.answerKind === "code" || form.answerKind === "sandbox");
  const ruStatus = question?.ruStatus && RU_STATUS[question.ruStatus];
  const notCovered = !isNew && question.isActive === false && !!question.notCovered;
  const trackChoices = tracksFor([...(question?.tracks || []), ...form.tracks]);
  const badCode = isNew && form.code.trim() !== "" && !isValidCode(form.code);
  // Новый вопрос с кодом Python (M4-26): тема-модуль и трек Python подставляются сами.
  const setCode = (code) => setForm((f) => ({ ...f, code, ...(pythonDefaults(code) || {}) }));

  const save = async (extra = {}) => {
    setError(""); setBlockedBy([]);
    let body;
    try {
      body = isNew ? toCreateBody(form) : { ...toPatch(form, original), ...extra };
    } catch (e) {
      setError(e instanceof FormError ? e.message : "Не удалось разобрать форму");
      return;
    }
    if (!isNew && !Object.keys(body).length) { onClose(); return; }
    setBusy(true);
    try {
      const r = isNew ? await api.questionBank.createQuestion(body) : await api.questionBank.updateQuestion(question.code, body);
      onSaved(r.question);
    } catch (e) {
      setError(e.message);
      setBlockedBy(e.details?.sets || []);
    } finally {
      setBusy(false);
    }
  };

  const archive = () => {
    const to = !(question.isActive !== false);
    const ask = notCovered ? `Включить ${question.code}? Модуль пройден — вопрос попадёт в новые наборы.`
      : to ? `Вернуть ${question.code} из архива?` : `Архивировать ${question.code}? В новые наборы он не попадёт.`;
    if (!window.confirm(ask)) return;
    save({ isActive: to });
  };

  const text = lang === "ru"
    ? { prompt: "promptRu", short: "promptShortRu", answer: "expectedAnswerRu" }
    : { prompt: "prompt", short: "promptShort", answer: "expectedAnswer" };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-full overflow-auto" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={isNew ? "Новый вопрос" : `Вопрос ${question.code}`} data-testid="question-editor">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3 flex flex-wrap items-center gap-2 z-10">
          <h2 className="text-base font-semibold text-slate-900">{isNew ? "Новый вопрос" : `Вопрос ${question.code}`}</h2>
          {notCovered && <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">ещё не пройдено</span>}
          {!isNew && question.isActive === false && !notCovered && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-white">в архиве</span>}
          {ruStatus && <span className={`px-2 py-0.5 rounded-full text-xs ${ruStatus.cls}`} data-testid="ru-status">{ruStatus.label}</span>}
          <button type="button" onClick={onClose} className="ml-auto px-3 py-1 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Закрыть ✕</button>
        </div>

        <div className="p-5 space-y-5">
          {!isNew && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              Правка действует на <b>новые</b> собеседования. Идущие и прошедшие хранят снимок вопроса на момент старта и не меняются.
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <label><Label>Код</Label>
              <input className={`${field} font-mono ${badCode ? "border-red-300" : ""}`} value={form.code} disabled={!isNew} placeholder="J26 / M4-26"
                onChange={(e) => setCode(e.target.value)} data-testid="f-code" />
              {badCode && <span className="block mt-1 text-[11px] text-red-600">буква темы + номер (J26) или модуль-номер (M4-26)</span>}</label>
            <label><Label>Уровень</Label>
              <select className={field} value={form.level} onChange={(e) => set({ level: e.target.value })} data-testid="f-level">
                {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select></label>
            <label><Label>Тема</Label>
              <select className={field} value={form.topic} onChange={(e) => set({ topic: e.target.value })}>
                {TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></label>
            <label><Label hint="не пересекаются в одном наборе">Группа конфликтов</Label>
              <input className={field} value={form.conflictGroup} onChange={(e) => set({ conflictGroup: e.target.value })} /></label>
            <label><Label hint="напр. auth, orm">Подтема</Label>
              <input className={field} value={form.subtopic} maxLength={40} onChange={(e) => set({ subtopic: e.target.value })} data-testid="f-subtopic" /></label>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div><Label>Направления</Label>
              <div className="flex flex-col gap-1">
                {trackChoices.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={form.tracks.includes(t.value)}
                      onChange={(e) => set({ tracks: e.target.checked ? [...form.tracks, t.value] : form.tracks.filter((x) => x !== t.value) })} />
                    {t.label}
                  </label>
                ))}
              </div></div>
            <div className="space-y-2">
              <label><Label>Тип ответа</Label>
                <select className={field} value={form.answerKind} onChange={(e) => set({ answerKind: e.target.value })}>
                  {ANSWER_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select></label>
              <label><Label>Редактор кода</Label>
                <select className={field} value={form.editor} onChange={(e) => set({ editor: e.target.value })} data-testid="f-editor">
                  {EDITORS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select></label>
            </div>
            <div className="flex flex-col gap-2 pt-5 text-sm text-slate-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.isPractical} onChange={(e) => set({ isPractical: e.target.checked })} /> amaliy (с кодом)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.isMiniTask} onChange={(e) => set({ isMiniTask: e.target.checked })} /> мини-задание</label>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                {["uz", "ru"].map((l) => (
                  <button key={l} type="button" onClick={() => setLang(l)} data-testid={`lang-${l}`}
                    className={`px-3 py-1.5 text-xs font-medium ${lang === l ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}>
                    {l === "uz" ? "O'zbekcha" : "Русский"}
                  </button>
                ))}
              </div>
              {hint && lang === "uz" && (
                <button type="button" onClick={() => setLang("ru")}
                  className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1" data-testid="ru-hint">
                  Узбекский текст изменён — русский перевод станет устаревшим. Обновить на вкладке «Русский» →
                </button>
              )}
              {lang === "ru" && question?.ruStatus === "stale" && (
                <span className="text-xs text-orange-700">Перевод сделан с прежнего узбекского текста — сверьте и обновите.</span>
              )}
            </div>
            <div className="space-y-3">
              <label><Label hint="(markdown, код в ``` блоках)">Вопрос</Label>
                <textarea rows={6} className={field} value={form[text.prompt]} onChange={(e) => set({ [text.prompt]: e.target.value })} data-testid="f-prompt" /></label>
              <label><Label>Короткая формулировка</Label>
                <input className={field} value={form[text.short]} onChange={(e) => set({ [text.short]: e.target.value })} /></label>
              <label><Label>Ответ для интервьюера</Label>
                <textarea rows={6} className={field} value={form[text.answer]} onChange={(e) => set({ [text.answer]: e.target.value })} /></label>
            </div>
          </div>

          <section className="border border-slate-200 rounded-xl p-4 space-y-3" data-testid="tests-editor">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Автотесты мини-задания</h3>
              <button type="button" onClick={() => set(addTest(form))} className="ml-auto px-3 py-1 rounded-lg text-xs bg-slate-100 hover:bg-slate-200 text-slate-700">+ проверка</button>
            </div>
            {!canTest && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                Автотесты запускаются только для редакторов «JavaScript» и «HTML/CSS/JS-документ» с типом ответа «код». Сейчас: {editor}.
              </p>
            )}
            <p className="text-xs text-slate-500">
              Тело асинхронной функции с параметрами <code className="font-mono">assert, sleep, logs, vars</code>. Функции кандидата доступны по имени.
              <code className="font-mono"> assert.equal(sum(1, 2), 3)</code> · <code className="font-mono">assert.deepEqual</code> · <code className="font-mono">assert.ok</code> ·{" "}
              <code className="font-mono">assert.throws(fn)</code> · <code className="font-mono">await assert.rejects(p)</code> · <code className="font-mono">await sleep(50)</code> ·{" "}
              <code className="font-mono">logs</code> — вывод console.log кандидата · <code className="font-mono">vars().имя</code> — его верхнеуровневые переменные.
              Кандидат видит только названия, код тестов в его сессию не попадает.
            </p>
            {form.tests.map((t, i) => (
              <div key={i} className="rounded-lg bg-slate-50 p-3 space-y-2" data-testid="test-row">
                <div className="grid grid-cols-2 gap-2">
                  <input className={field} placeholder="Название (uz)" value={t.name} onChange={(e) => set(patchTest(form, i, { name: e.target.value }))} />
                  <input className={field} placeholder="Название (ru)" value={t.nameRu} onChange={(e) => set(patchTest(form, i, { nameRu: e.target.value }))} />
                </div>
                <textarea rows={4} className={mono} placeholder="assert.equal(f(1), 1);" value={t.code}
                  onChange={(e) => set(patchTest(form, i, { code: e.target.value }))} spellCheck={false} />
                <button type="button" onClick={() => set(removeTest(form, i))} className="text-xs text-red-600 hover:underline">убрать проверку</button>
              </div>
            ))}
            {!form.tests.length && <p className="text-xs text-slate-400">Тестов нет.</p>}
          </section>

          <details className="border border-slate-200 rounded-xl p-4" open={!!(form.demoJson || form.demoFixJson)}>
            <summary className="text-sm font-semibold text-slate-800 cursor-pointer">Живая сцена (JSON)</summary>
            <div className="mt-3 space-y-3">
              <label><Label hint="html, css, steps, caption, captionRu, height, width, slider, layers3d, audience; пусто — без сцены">Сцена</Label>
                <textarea rows={6} className={mono} value={form.demoJson} onChange={(e) => set({ demoJson: e.target.value })} spellCheck={false} /></label>
              <label><Label hint="html, css, steps, caption — только интервьюер">Исправленная сцена</Label>
                <textarea rows={4} className={mono} value={form.demoFixJson} onChange={(e) => set({ demoFixJson: e.target.value })} spellCheck={false} /></label>
            </div>
          </details>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm space-y-1" role="alert" data-testid="editor-error">
              <p>{error}</p>
              {blockedBy.length > 0 && (
                <ul className="list-disc pl-5 text-xs">
                  {blockedBy.map((s) => <li key={s._id}>набор {s.track} №{s.number}: {s.reason}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex items-center gap-2">
          {!isNew && (
            <button type="button" onClick={archive} disabled={busy} data-testid="archive-question"
              className={`px-3 py-2 rounded-lg text-sm ${notCovered ? "text-green-700 hover:bg-green-50" : "text-red-600 hover:bg-red-50"}`}>
              {notCovered ? "Включить (модуль пройден)" : question.isActive === false ? "Вернуть из архива" : "В архив"}
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400">{isNew ? "" : dirty ? `изменено полей: ${Object.keys(patch).length}` : "без изменений"}</span>
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Отмена</button>
          <button type="button" onClick={() => save()} disabled={busy || !dirty} data-testid="save-question"
            className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Сохраняю…" : isNew ? "Создать" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
