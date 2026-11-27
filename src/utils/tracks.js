// Направления найма и темы банка — единый источник подписей админки (чистые функции, node --test).
//
// Модель найма (27.11): на собеседования берём только full-stack учеников после PRO, стеки JS и Python.
// В выборе — ровно три направления; backend-nodejs — архив (старые заявки и собеседования не трогаем).
// Порядок и подписи совпадают с int-server (config/questionBankTopics.js → TRACK_DEFS).

export const ACTIVE_TRACKS = [
  { value: "frontend-react", label: "JS · React" },
  { value: "frontend-vue", label: "JS · Vue" },
  { value: "backend-python", label: "Python" },
];
export const ARCHIVED_TRACKS = [
  { value: "backend-nodejs", label: "Backend (Node.js) — архив" },
];
const ACTIVE_VALUES = ACTIVE_TRACKS.map((t) => t.value);

// Подписи всех сфер заявок / треков собеседований, включая старые (только история).
export const SPHERE_LABELS = {
  ...Object.fromEntries([...ACTIVE_TRACKS, ...ARCHIVED_TRACKS].map((t) => [t.value, t.label])),
  "mern-stack": "React + Python",
  "full-stack": "React + Node",
};

export const trackLabel = (value) => SPHERE_LABELS[value] || value || "—";

// Сфера заявки → трек собеседования (как sphereToTrack в int-server). Старые mern-stack / full-stack → JS · React.
export function sphereToTrack(sphere) {
  if (ACTIVE_VALUES.includes(sphere) || sphere === "backend-nodejs") return sphere;
  return "frontend-react";
}

// Варианты для выбора: три активных + архивные, только если они уже выбраны (старые данные).
export function trackOptions(current = []) {
  const cur = Array.isArray(current) ? current : [current];
  return [...ACTIVE_TRACKS, ...ARCHIVED_TRACKS.filter((t) => cur.includes(t.value))];
}

// ─── Темы банка ──────────────────────────────────────────────────────────────

// JS-банк (буква кода = тема). Порядок — как в банке.
export const JS_TOPIC_LABELS = {
  html: "HTML", css: "CSS", js: "JavaScript", react: "React", vue: "Vue", tailwind: "Tailwind CSS",
  node: "Node.js", express: "Express", database: "Базы данных", api: "API и HTTP",
};
const JS_TOPIC_ORDER = Object.keys(JS_TOPIC_LABELS);

// Python-банк: тема = модуль курса (py-m3 … py-m11). Подписи приходят с бэка (stats.topicLabels),
// эта карта — запасная.
export const PY_TOPIC_LABELS = {
  "py-m3": "M3 · Python asoslari",
  "py-m4": "M4 · Python: chuqurlashtirish",
  "py-m5": "M5 · OOP",
  "py-m6": "M6 · Telegram-botlar",
  "py-m7": "M7 · SQL va PostgreSQL",
  "py-m8": "M8 · Mahsulot darajasidagi botlar",
  "py-m9": "M9 · Django asoslari",
  "py-m10": "M10 · Django: o'rta daraja",
  "py-m11": "M11 · Django: professional daraja",
};
export const TOPIC_LABELS = { ...JS_TOPIC_LABELS, ...PY_TOPIC_LABELS };

export const pyModule = (topic) => {
  const m = /^py-m(\d{1,2})$/.exec(String(topic || ""));
  return m ? Number(m[1]) : null;
};

// Неактивный вопрос «ждёт включения» (notCovered): у модулей Python — модуль ещё не пройден,
// у остальных тем (банк Node.js до решения владельца) — вопрос просто ещё не включён.
export const pendingLabel = (topic) => (pyModule(topic) != null
  ? { badge: "ещё не пройдено", action: "Включить (модуль пройден)", ask: "Модуль пройден — вопрос попадёт в новые наборы." }
  : { badge: "не включён", action: "Включить", ask: "Вопрос попадёт в генератор и новые наборы." });

// Подпись темы. serverLabels — stats.topicLabels / rules.topics ({topic: {uz, ru}}): берётся для тем
// вне JS-карты (модули Python и будущие); JS-темы остаются с привычными русскими подписями.
export function topicLabel(topic, serverLabels) {
  if (JS_TOPIC_LABELS[topic]) return JS_TOPIC_LABELS[topic];
  const s = serverLabels?.[topic];
  if (typeof s === "string" && s) return s;
  return s?.uz || s?.ru || PY_TOPIC_LABELS[topic] || topic;
}

// Порядок тем как в банке: JS-темы, затем модули Python по номеру (py-m10 после py-m9), прочее — по алфавиту.
function topicRank(topic) {
  const js = JS_TOPIC_ORDER.indexOf(topic);
  if (js >= 0) return [0, js, ""];
  const m = pyModule(topic);
  if (m != null) return [1, m, ""];
  return [2, 0, String(topic)];
}
export function compareTopics(a, b) {
  const x = topicRank(a);
  const y = topicRank(b);
  return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2]);
}
export const sortTopics = (topics = []) => [...topics].sort(compareTopics);
