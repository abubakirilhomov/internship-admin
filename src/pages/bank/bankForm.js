// Форма редактора банка: вопрос ↔ черновик формы ↔ PATCH-тело. Чистые функции (node --test).
// Отправляется только то, что изменилось: так правка одного поля не затирает остальное
// (и не мешает правке другого админа) и сервер видит, что именно поменялось (перевод uz/ru).
import { ACTIVE_TRACKS, PY_TOPIC_LABELS, trackOptions } from "../../utils/tracks.js";

export const LEVELS = [
  { value: "oson", label: "лёгкий (oson)" },
  { value: "orta", label: "средний (o'rta)" },
  { value: "qiyin", label: "сложный (qiyin)" },
];
export const TOPICS = [
  { value: "html", label: "HTML" }, { value: "css", label: "CSS" }, { value: "js", label: "JavaScript" },
  { value: "react", label: "React" }, { value: "vue", label: "Vue" }, { value: "tailwind", label: "Tailwind" },
  { value: "node", label: "Node.js" }, { value: "express", label: "Express" },
  { value: "database", label: "Базы данных" }, { value: "api", label: "API и HTTP" },
  ...Object.entries(PY_TOPIC_LABELS).map(([value, label]) => ({ value, label })),
];
// Направления вопроса: три активных; архивный backend-nodejs — только если вопрос уже к нему привязан.
export const TRACKS = ACTIVE_TRACKS;
export const tracksFor = (current = []) => trackOptions(current);
export const ANSWER_KINDS = [
  { value: "text", label: "текст" }, { value: "code", label: "код (amaliy)" },
  { value: "sandbox", label: "песочница" }, { value: "choice", label: "выбор варианта" },
];
// "" — по префиксу кода (как раньше); остальное — явный выбор.
export const EDITORS = [
  { value: "", label: "по умолчанию (по теме)" }, { value: "js", label: "JavaScript (с автотестами)" },
  { value: "web", label: "HTML/CSS/JS-документ (с автотестами)" }, { value: "jsx", label: "React (Sandpack)" },
  { value: "vue", label: "Vue (Sandpack)" }, { value: "tailwind", label: "Vue + Tailwind (Sandpack)" },
  { value: "html", label: "только подсветка HTML" }, { value: "node", label: "только подсветка Node" },
  { value: "python", label: "Python — только подсветка" }, { value: "sql", label: "SQL — только подсветка" },
];
// Автотесты работают в редакторах, у которых есть наша песочница (см. codeSandbox/testable.js).
export const TESTABLE_EDITORS = ["js", "web"];
export const PREFIX_EDITOR = { H: "web", C: "web", J: "js", R: "jsx", V: "vue", T: "tailwind", N: "node", E: "node", D: "node", A: "node" };


// Код вопроса: буква темы + номер (J26) или модуль-номер Python (M4-26).
export const CODE_RE = /^[HCJRVTNEDA]\d{1,3}$|^M\d{1,2}-\d{2}$/;
export const isValidCode = (code) => CODE_RE.test(String(code || "").trim().toUpperCase());
const pyCodeModule = (code) => {
  const m = /^M(\d{1,2})-\d{2}$/.exec(String(code || "").trim().toUpperCase());
  return m ? Number(m[1]) : null;
};
// Новый вопрос с кодом Python (M7-03): тема-модуль и трек Python. null — код не Python.
export function pythonDefaults(code) {
  const m = pyCodeModule(code);
  return m == null ? null : { topic: `py-m${m}`, tracks: ["backend-python"] };
}

export const effectiveEditor = (form) => {
  if (form.editor) return form.editor;
  const m = pyCodeModule(form.code);
  if (m != null) return m === 7 ? "sql" : "python";
  return PREFIX_EDITOR[String(form.code || "").charAt(0)] || "js";
};

const json = (v) => (v ? JSON.stringify(v, null, 2) : "");
const emptyTest = () => ({ name: "", nameRu: "", code: "" });

export function emptyForm(code = "") {
  return {
    code, level: "orta", topic: "js", tracks: ["frontend-react", "frontend-vue"], isPractical: false, isMiniTask: false,
    answerKind: "text", editor: "", conflictGroup: "", subtopic: "", isActive: true,
    prompt: "", promptRu: "", promptShort: "", promptShortRu: "", expectedAnswer: "", expectedAnswerRu: "",
    tests: [], demoJson: "", demoFixJson: "",
  };
}

export function toForm(q) {
  return {
    code: q.code, level: q.level, topic: q.topic, tracks: [...(q.tracks || [])], isPractical: !!q.isPractical,
    isMiniTask: !!q.isMiniTask, answerKind: q.answerKind || "text", editor: q.editor || "",
    conflictGroup: q.conflictGroup || "", subtopic: q.subtopic || "", isActive: q.isActive !== false,
    prompt: q.prompt || "", promptRu: q.promptRu || "", promptShort: q.promptShort || "", promptShortRu: q.promptShortRu || "",
    expectedAnswer: q.expectedAnswer || "", expectedAnswerRu: q.expectedAnswerRu || "",
    tests: (q.tests || []).map((t) => ({ name: t.name || "", nameRu: t.nameRu || "", code: t.code || "" })),
    demoJson: json(q.demo), demoFixJson: json(q.demoFix),
  };
}

export class FormError extends Error {}

function parseJson(text, label) {
  const s = String(text || "").trim();
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("ожидается объект");
    return v;
  } catch (e) {
    throw new FormError(`${label}: некорректный JSON (${e.message})`);
  }
}

const SIMPLE = ["level", "topic", "isPractical", "isMiniTask", "answerKind", "conflictGroup", "isActive",
  "prompt", "promptRu", "promptShort", "promptShortRu", "expectedAnswer", "expectedAnswerRu"];

// Что отправить: только изменённые поля. original — toForm(исходный вопрос). Бросает FormError.
export function toPatch(form, original) {
  const patch = {};
  for (const k of SIMPLE) if (form[k] !== original[k]) patch[k] = form[k];
  if (form.editor !== original.editor) patch.editor = form.editor || null;
  if (form.subtopic.trim() !== original.subtopic) patch.subtopic = form.subtopic.trim() || null;
  if ([...form.tracks].sort().join() !== [...original.tracks].sort().join()) patch.tracks = form.tracks;
  if (JSON.stringify(form.tests) !== JSON.stringify(original.tests)) patch.tests = form.tests;
  if (form.demoJson !== original.demoJson) patch.demo = parseJson(form.demoJson, "Живая сцена");
  if (form.demoFixJson !== original.demoFixJson) patch.demoFix = parseJson(form.demoFixJson, "Исправленная сцена");
  return patch;
}

// Новый вопрос: всё заполненное. Бросает FormError.
export function toCreateBody(form) {
  const code = String(form.code || "").trim().toUpperCase();
  if (!CODE_RE.test(code)) throw new FormError("Код: буква темы и номер (J26) или модуль-номер Python (M4-26)");
  const body = {
    code, level: form.level, topic: form.topic, tracks: form.tracks,
    isPractical: form.isPractical, isMiniTask: form.isMiniTask, answerKind: form.answerKind,
    prompt: form.prompt, promptRu: form.promptRu, promptShort: form.promptShort, promptShortRu: form.promptShortRu,
    expectedAnswer: form.expectedAnswer, expectedAnswerRu: form.expectedAnswerRu,
  };
  if (form.editor) body.editor = form.editor;
  if (form.conflictGroup.trim()) body.conflictGroup = form.conflictGroup.trim();
  if (form.subtopic.trim()) body.subtopic = form.subtopic.trim();
  if (form.tests.length) body.tests = form.tests;
  const demo = parseJson(form.demoJson, "Живая сцена");
  if (demo) body.demo = demo;
  const fix = parseJson(form.demoFixJson, "Исправленная сцена");
  if (fix) body.demoFix = fix;
  return body;
}

// Подсказка о переводе: правили узбекский текст и не трогали русский.
const UZ = ["prompt", "promptShort", "expectedAnswer"];
const RU = ["promptRu", "promptShortRu", "expectedAnswerRu"];
export function translationHint(form, original) {
  if (!original) return null;
  const uzChanged = UZ.some((k) => form[k] !== original[k]);
  const ruChanged = RU.some((k) => form[k] !== original[k]);
  if (uzChanged && !ruChanged && original.promptRu) return "uz-changed";
  return null;
}

export const addTest = (form) => ({ ...form, tests: [...form.tests, emptyTest()] });
export const patchTest = (form, i, p) => ({ ...form, tests: form.tests.map((t, j) => (j === i ? { ...t, ...p } : t)) });
export const removeTest = (form, i) => ({ ...form, tests: form.tests.filter((_, j) => j !== i) });

// Статус перевода для подписи.
export const RU_STATUS = {
  ok: { label: "перевод актуален", cls: "bg-green-100 text-green-700" },
  stale: { label: "ru устарел — обновите перевод", cls: "bg-orange-100 text-orange-700" },
  missing: { label: "ru не переведён", cls: "bg-slate-100 text-slate-600" },
};
