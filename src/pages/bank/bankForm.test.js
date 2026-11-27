import test from "node:test";
import assert from "node:assert/strict";
import {
  toForm, toPatch, toCreateBody, translationHint, emptyForm, effectiveEditor, addTest, patchTest, removeTest, FormError,
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
