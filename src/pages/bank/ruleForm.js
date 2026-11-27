// Редактор правила набора на трек (страница «Наборы»): ответ GET /question-bank/rules/:track ↔ форма ↔ тело PUT.
// Чистые функции (node --test). Отправляются только изменённые поля — так нетронутое правило
// (например, общее, без квот у трека) не перезаписывается нулями.
import { compareTopics, topicLabel } from "../../utils/tracks.js";

export const RULE_SIZES = [15, 18, 20];
export const RULE_LEVELS = ["oson", "orta", "qiyin"];
const FALLBACK_18 = { oson: 4, orta: 9, qiyin: 5 }; // как в int-server (setLevels.js)

export const RULE_SOURCE = {
  global: "общее правило банка",
  import: "из файла банка (импорт)",
  admin: "правка админа",
};

const int = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const keyOf = (topics) => topics.join("+");

// Уровни для размера: явные из правила, иначе пропорционально правилу на 18 (как на сервере).
export function levelsFor(size, levels) {
  const explicit = levels?.[size];
  if (explicit) return { oson: int(explicit.oson), orta: int(explicit.orta), qiyin: int(explicit.qiyin) };
  const base = levels?.[18] || FALLBACK_18;
  const total = RULE_LEVELS.reduce((s, l) => s + int(base[l]), 0) || 1;
  const raw = RULE_LEVELS.map((l) => (int(base[l]) * size) / total);
  const out = raw.map(Math.floor);
  let rest = size - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => {
    if (rest > 0) { out[i] += 1; rest -= 1; }
  });
  return Object.fromEntries(RULE_LEVELS.map((l, i) => [l, out[i]]));
}

// Строки таблицы квот: группы тем из правила (могут объединять темы, напр. html+css) и
// одиночные темы трека, которых нет ни в одной группе (с нулями).
export function quotaRows(resp) {
  const rules = resp?.rules || {};
  const labels = Object.fromEntries((resp?.topics || []).map((t) => [t.topic, t.label]));
  const inBank = resp?.inBank || {};
  const rows = new Map();
  for (const size of RULE_SIZES) {
    for (const g of rules.quotas?.[size] || []) {
      const topics = (g.topics || []).map(String);
      if (!topics.length) continue;
      const key = keyOf(topics);
      if (!rows.has(key)) rows.set(key, { key, topics, counts: { 15: 0, 18: 0, 20: 0 } });
      rows.get(key).counts[size] += int(g.count);
    }
  }
  const covered = new Set([...rows.values()].flatMap((r) => r.topics));
  for (const t of resp?.topics || []) {
    if (!covered.has(t.topic)) rows.set(t.topic, { key: t.topic, topics: [t.topic], counts: { 15: 0, 18: 0, 20: 0 } });
  }
  return [...rows.values()]
    .map((r) => ({
      ...r,
      label: r.topics.map((t) => topicLabel(t, labels)).join(" + "),
      inBank: r.topics.reduce((acc, t) => ({
        active: acc.active + int(inBank[t]?.active), inactive: acc.inactive + int(inBank[t]?.inactive),
      }), { active: 0, inactive: 0 }),
    }))
    .sort((a, b) => compareTopics(a.topics[0], b.topics[0]));
}

export function toRuleForm(resp) {
  const rules = resp?.rules || {};
  const bySize = rules.minPracticalBySize || {};
  return {
    rows: quotaRows(resp),
    levels: Object.fromEntries(RULE_SIZES.map((s) => [s, levelsFor(s, rules.levels)])),
    minPractical: rules.minPractical ?? "",
    minPractical20: bySize[20] ?? "",
    requireMiniTask: rules.requireMiniTask === true,
    extras: rules.extras
      ? { codes: [...(rules.extras.codes || [])], max: rules.extras.max ?? 0, maxTotal: rules.extras.maxTotal ?? 20 }
      : null,
  };
}

export const quotaSums = (rows = []) =>
  Object.fromEntries(RULE_SIZES.map((s) => [s, rows.reduce((a, r) => a + int(r.counts[s]), 0)]));
export const levelSums = (levels = {}) =>
  Object.fromEntries(RULE_SIZES.map((s) => [s, RULE_LEVELS.reduce((a, l) => a + int(levels[s]?.[l]), 0)]));

export const setRowCount = (form, key, size, value) => ({
  ...form,
  rows: form.rows.map((r) => (r.key === key ? { ...r, counts: { ...r.counts, [size]: value } } : r)),
});
export const setLevel = (form, size, level, value) => ({
  ...form,
  levels: { ...form.levels, [size]: { ...form.levels[size], [level]: value } },
});

const quotasOf = (rows) =>
  Object.fromEntries(RULE_SIZES.map((s) => [s, rows.filter((r) => int(r.counts[s]) > 0).map((r) => ({ topics: r.topics, count: int(r.counts[s]) }))]));
const levelsOf = (levels) =>
  Object.fromEntries(RULE_SIZES.map((s) => [s, Object.fromEntries(RULE_LEVELS.map((l) => [l, int(levels[s]?.[l])]))]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Что отправить в PUT: только изменённые поля. original — toRuleForm(ответ GET), resp — сам ответ (exclude, прочие размеры).
export function toRuleBody(form, original, resp) {
  const body = {};
  if (!same(quotasOf(form.rows), quotasOf(original.rows))) body.quotas = quotasOf(form.rows);
  if (!same(levelsOf(form.levels), levelsOf(original.levels))) body.levels = levelsOf(form.levels);
  if (String(form.minPractical) !== String(original.minPractical) && String(form.minPractical).trim() !== "") {
    body.minPractical = int(form.minPractical);
  }
  if (String(form.minPractical20) !== String(original.minPractical20)) {
    const rest = { ...(resp?.rules?.minPracticalBySize || {}) };
    delete rest[20];
    body.minPracticalBySize = String(form.minPractical20).trim() === "" ? rest : { ...rest, 20: int(form.minPractical20) };
  }
  if (form.requireMiniTask !== original.requireMiniTask) body.requireMiniTask = form.requireMiniTask;
  if (form.extras && original.extras
    && (int(form.extras.max) !== int(original.extras.max) || int(form.extras.maxTotal) !== int(original.extras.maxTotal))) {
    body.extras = {
      codes: original.extras.codes, exclude: resp?.rules?.extras?.exclude || [],
      max: int(form.extras.max), maxTotal: int(form.extras.maxTotal),
    };
  }
  return body;
}

// Ошибки, видимые до сохранения: суммы квот и уровней должны равняться размеру набора.
// Квоты проверяются, только если их меняли или они уже заданы (у трека без квот — нули, это не ошибка).
export function ruleErrors(form, original) {
  const errors = [];
  const qs = quotaSums(form.rows);
  const hadQuotas = RULE_SIZES.some((s) => quotaSums(original.rows)[s] > 0);
  const quotasTouched = !same(quotasOf(form.rows), quotasOf(original.rows));
  if (hadQuotas || quotasTouched) {
    RULE_SIZES.forEach((s) => { if (qs[s] !== s) errors.push(`квоты на ${s}: сумма ${qs[s]} ≠ ${s}`); });
  }
  const ls = levelSums(form.levels);
  RULE_SIZES.forEach((s) => { if (ls[s] !== s) errors.push(`уровни на ${s}: сумма ${ls[s]} ≠ ${s}`); });
  return errors;
}
