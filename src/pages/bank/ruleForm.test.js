import test from "node:test";
import assert from "node:assert/strict";
import {
  levelsFor, quotaRows, toRuleForm, quotaSums, levelSums, setRowCount, setLevel, toRuleBody, ruleErrors,
} from "./ruleForm.js";

// Синтетический ответ GET /question-bank/rules/backend-python.
const pyResp = () => ({
  track: "backend-python",
  rules: {
    unit: "module",
    levels: { 15: { oson: 4, orta: 7, qiyin: 4 }, 18: { oson: 4, orta: 9, qiyin: 5 }, 20: { oson: 5, orta: 10, qiyin: 5 } },
    minPractical: 5, minPracticalBySize: { 20: 7 }, requireMiniTask: true,
    quotas: {
      15: [{ topics: ["py-m3"], count: 8 }, { topics: ["py-m4"], count: 7 }],
      18: [{ topics: ["py-m3"], count: 9 }, { topics: ["py-m4"], count: 9 }],
      20: [{ topics: ["py-m3"], count: 10 }, { topics: ["py-m4"], count: 10 }],
    },
    extras: { codes: ["H1", "C2"], exclude: ["C9"], max: 2, maxTotal: 20 },
    source: "import",
  },
  topics: [
    { topic: "py-m10", label: { uz: "M10 · Sintetik", ru: "M10" } },
    { topic: "py-m3", label: { uz: "M3 · A", ru: "M3" } },
    { topic: "py-m4", label: { uz: "M4 · B", ru: "M4" } },
  ],
  inBank: { "py-m3": { active: 12, inactive: 0 }, "py-m4": { active: 10, inactive: 3 }, "py-m10": { active: 0, inactive: 8 } },
});

test("строки квот: темы трека без квот — с нулями; порядок по модулю; счётчики банка", () => {
  const rows = quotaRows(pyResp());
  assert.deepEqual(rows.map((r) => r.key), ["py-m3", "py-m4", "py-m10"]);
  assert.deepEqual(rows[0].counts, { 15: 8, 18: 9, 20: 10 });
  assert.deepEqual(rows[2].counts, { 15: 0, 18: 0, 20: 0 });
  assert.equal(rows[0].label, "M3 · A");
  assert.deepEqual(rows[1].inBank, { active: 10, inactive: 3 });
});

test("группа тем (html+css) — одна строка, счётчики банка суммируются", () => {
  const rows = quotaRows({
    rules: { quotas: { 18: [{ topics: ["html", "css"], count: 3 }, { topics: ["js"], count: 15 }] } },
    topics: [{ topic: "html" }, { topic: "css" }, { topic: "js" }, { topic: "react" }],
    inBank: { html: { active: 2, inactive: 1 }, css: { active: 3, inactive: 0 } },
  });
  assert.deepEqual(rows.map((r) => r.key), ["html+css", "js", "react"]);
  assert.equal(rows[0].label, "HTML + CSS");
  assert.deepEqual(rows[0].inBank, { active: 5, inactive: 1 });
  assert.deepEqual(rows[0].counts, { 15: 0, 18: 3, 20: 0 });
});

test("суммы квот и уровней; ошибки, если сумма ≠ размер", () => {
  const resp = pyResp();
  const orig = toRuleForm(resp);
  assert.deepEqual(quotaSums(orig.rows), { 15: 15, 18: 18, 20: 20 });
  assert.deepEqual(levelSums(orig.levels), { 15: 15, 18: 18, 20: 20 });
  assert.deepEqual(ruleErrors(orig, orig), []);
  const f = setLevel(setRowCount(orig, "py-m10", 18, "2"), 20, "qiyin", "6");
  assert.deepEqual(quotaSums(f.rows), { 15: 15, 18: 20, 20: 20 });
  assert.deepEqual(ruleErrors(f, orig), ["квоты на 18: сумма 20 ≠ 18", "уровни на 20: сумма 21 ≠ 20"]);
});

test("трек без квот: нули не ошибка, пока квоты не трогали", () => {
  const resp = { rules: { quotas: null, levels: null }, topics: [{ topic: "html" }, { topic: "js" }], inBank: {} };
  const orig = toRuleForm(resp);
  assert.deepEqual(orig.levels[18], { oson: 4, orta: 9, qiyin: 5 }); // как на сервере
  assert.equal(levelSums(orig.levels)[15], 15);
  assert.deepEqual(ruleErrors(orig, orig), []);
  assert.deepEqual(toRuleBody(orig, orig, resp), {});
  const f = setRowCount(orig, "js", 15, 15);
  assert.deepEqual(ruleErrors(f, orig), ["квоты на 18: сумма 0 ≠ 18", "квоты на 20: сумма 0 ≠ 20"]);
});

test("levelsFor: явные уровни или пропорционально правилу на 18", () => {
  assert.deepEqual(levelsFor(15, { 15: { oson: 5, orta: 5, qiyin: 5 } }), { oson: 5, orta: 5, qiyin: 5 });
  const l20 = levelsFor(20, { 18: { oson: 4, orta: 9, qiyin: 5 } });
  assert.equal(l20.oson + l20.orta + l20.qiyin, 20);
});

test("тело PUT: только изменённое; extras сохраняет коды и exclude; пустой минимум для 20 убирает его", () => {
  const resp = pyResp();
  const orig = toRuleForm(resp);
  let f = setRowCount(setRowCount(orig, "py-m3", 18, "8"), "py-m10", 18, "1");
  f = { ...f, extras: { ...f.extras, max: "1" }, requireMiniTask: false, minPractical20: "" };
  const body = toRuleBody(f, orig, resp);
  assert.deepEqual(Object.keys(body).sort(), ["extras", "minPracticalBySize", "quotas", "requireMiniTask"]);
  assert.deepEqual(body.quotas[18], [{ topics: ["py-m3"], count: 8 }, { topics: ["py-m4"], count: 9 }, { topics: ["py-m10"], count: 1 }]);
  assert.deepEqual(body.quotas[15], [{ topics: ["py-m3"], count: 8 }, { topics: ["py-m4"], count: 7 }]);
  assert.deepEqual(body.extras, { codes: ["H1", "C2"], exclude: ["C9"], max: 1, maxTotal: 20 });
  assert.deepEqual(body.minPracticalBySize, {});
  assert.equal(body.requireMiniTask, false);
  assert.deepEqual(toRuleBody({ ...orig, minPractical: "6" }, orig, resp), { minPractical: 6 });
});
