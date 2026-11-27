import test from "node:test";
import assert from "node:assert/strict";
import {
  toForm, toPatch, toCreateBody, translationHint, emptyForm, effectiveEditor, addTest, patchTest, removeTest, FormError,
  isValidCode, pythonDefaults, EDITORS, TOPICS, TRACKS, tracksFor,
} from "./bankForm.js";

const q = {
  code: "J9", level: "orta", topic: "js", tracks: ["frontend-react", "frontend-vue"], isPractical: true, isMiniTask: false,
  answerKind: "code", conflictGroup: null, isActive: true, prompt: "uz matn", promptRu: "ru текст", promptShort: "q",
  promptShortRu: "", expectedAnswer: "uz javob", expectedAnswerRu: "ru ответ",
  tests: [{ name: "a", nameRu: "а", code: "assert.ok(1)" }], demo: { html: "<p>x</p>", css: "" },
};

test("toForm → toPatch без правок пуст (JSON сцены сравнивается как текст)", () => {
  const f = toForm(q);
  assert.deepEqual(toPatch(f, toForm(q)), {});
});

test("toPatch: только изменённое; editor '' → null; tracks, tests и сцена", () => {
  const o = toForm(q);
  const f = { ...o, level: "qiyin", prompt: "yangi", editor: "web", tracks: ["frontend-vue"], isMiniTask: true };
  f.tests = [{ ...f.tests[0], code: "assert.ok(2)" }];
  f.demoJson = JSON.stringify({ html: "<b>y</b>" });
  assert.deepEqual(toPatch(f, o), {
    level: "qiyin", prompt: "yangi", editor: "web", tracks: ["frontend-vue"], isMiniTask: true,
    tests: [{ name: "a", nameRu: "а", code: "assert.ok(2)" }], demo: { html: "<b>y</b>" },
  });
  assert.deepEqual(toPatch({ ...toForm({ ...q, editor: "web" }), editor: "" }, toForm({ ...q, editor: "web" })), { editor: null });
  assert.deepEqual(toPatch({ ...o, demoJson: "  " }, o), { demo: null }); // пусто → сцену убрать
});

test("плохой JSON сцены → FormError с подписью поля", () => {
  const o = toForm(q);
  assert.throws(() => toPatch({ ...o, demoFixJson: "{oops" }, o), (e) => e instanceof FormError && /Исправленная сцена: некорректный JSON/.test(e.message));
  assert.throws(() => toPatch({ ...o, demoJson: "[1]" }, o), /ожидается объект/);
});

test("translationHint: правили uz без ru → подсказка; правили оба или только метаданные → нет", () => {
  const o = toForm(q);
  assert.equal(translationHint({ ...o, prompt: "boshqa" }, o), "uz-changed");
  assert.equal(translationHint({ ...o, expectedAnswer: "boshqa" }, o), "uz-changed");
  assert.equal(translationHint({ ...o, prompt: "boshqa", promptRu: "другой" }, o), null);
  assert.equal(translationHint({ ...o, level: "qiyin" }, o), null);
  assert.equal(translationHint({ ...o, prompt: "x" }, toForm({ ...q, promptRu: "" })), null); // перевода и не было
});

test("toCreateBody: код в верхнем регистре, пустое не отправляется", () => {
  const f = { ...emptyForm(" j26 "), prompt: "savol", level: "oson" };
  assert.deepEqual(toCreateBody(f), {
    code: "J26", level: "oson", topic: "js", tracks: ["frontend-react", "frontend-vue"], isPractical: false, isMiniTask: false,
    answerKind: "text", prompt: "savol", promptRu: "", promptShort: "", promptShortRu: "", expectedAnswer: "", expectedAnswerRu: "",
  });
  const g = { ...f, editor: "js", conflictGroup: " g1 ", tests: [{ name: "t", nameRu: "", code: "assert.ok(1)" }], demoJson: '{"html":"<p/>"}' };
  const body = toCreateBody(g);
  assert.equal(body.editor, "js");
  assert.equal(body.conflictGroup, "g1");
  assert.deepEqual(body.demo, { html: "<p/>" });
  assert.equal(body.tests.length, 1);
});

test("effectiveEditor и правка списка тестов", () => {
  assert.equal(effectiveEditor({ code: "J1", editor: "" }), "js");
  assert.equal(effectiveEditor({ code: "R2", editor: "" }), "jsx");
  assert.equal(effectiveEditor({ code: "R2", editor: "web" }), "web");
  let f = emptyForm("J1");
  f = addTest(addTest(f));
  f = patchTest(f, 1, { name: "b" });
  assert.deepEqual(f.tests.map((t) => t.name), ["", "b"]);
  assert.deepEqual(removeTest(f, 0).tests.map((t) => t.name), ["b"]);
});

test("код вопроса: J26 и модуль-номер Python M3-05; прочее — FormError при создании", () => {
  for (const c of ["J26", "h1", "A999", "M3-05", "m10-12", " M4-26 "]) assert.equal(isValidCode(c), true, c);
  for (const c of ["", "J", "X12", "J1234", "M3-5", "M100-01", "M3-005", "M3_05", "PY-01"]) assert.equal(isValidCode(c), false, c);
  assert.throws(() => toCreateBody({ ...emptyForm("X1"), prompt: "p" }), (e) => e instanceof FormError && /M4-26/.test(e.message));
  assert.equal(toCreateBody({ ...emptyForm("m3-05"), prompt: "p" }).code, "M3-05");
});

test("Python: код M7-03 → тема py-m7 и трек Python; редактор по коду — python, у M7 — sql", () => {
  assert.deepEqual(pythonDefaults("M7-03"), { topic: "py-m7", tracks: ["backend-python"] });
  assert.equal(pythonDefaults("J1"), null);
  assert.equal(effectiveEditor({ code: "M3-01", editor: "" }), "python");
  assert.equal(effectiveEditor({ code: "M7-02", editor: "" }), "sql");
  assert.equal(effectiveEditor({ code: "M7-02", editor: "python" }), "python");
  assert.ok(EDITORS.some((e) => e.value === "python" && /только подсветка/.test(e.label)));
  assert.ok(EDITORS.some((e) => e.value === "sql" && /только подсветка/.test(e.label)));
  assert.ok(TOPICS.some((t) => t.value === "py-m11"));
});

test("направления вопроса: три активных; backend-nodejs — только если вопрос к нему привязан", () => {
  assert.deepEqual(TRACKS.map((t) => t.value), ["frontend-react", "frontend-vue", "backend-python"]);
  assert.deepEqual(tracksFor(["frontend-react"]).map((t) => t.value), ["frontend-react", "frontend-vue", "backend-python"]);
  assert.ok(tracksFor(["backend-nodejs"]).some((t) => t.value === "backend-nodejs"));
});

test("subtopic: правка → строка или null, создание — только непустое", () => {
  const o = toForm({ ...q, subtopic: "auth" });
  assert.equal(o.subtopic, "auth");
  assert.deepEqual(toPatch({ ...o, subtopic: " orm " }, o), { subtopic: "orm" });
  assert.deepEqual(toPatch({ ...o, subtopic: "" }, o), { subtopic: null });
  assert.equal(toCreateBody({ ...emptyForm("M10-01"), prompt: "p", subtopic: " auth " }).subtopic, "auth");
});
