// node --test: сборка документа автотестов — чистые функции (поведение в браузере — tests.browser.test.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTestDoc, declaredNames, canTest, MAX_TESTS } from "./tests.js";

const tests = [{ name: "a", code: "assert.equal(f(1), 1);" }, { name: "b", code: "assert.ok(true);" }];

test("declaredNames: const/let/var/function/class, без зарезервированных и повторов", () => {
  const names = declaredNames("const summary = {}; let n = 1; var x; function toQuery() {} class A {} const summary2 = 1; function toQuery() {}");
  assert.deepEqual(names, ["summary", "n", "x", "toQuery", "A", "summary2"]);
  assert.deepEqual(declaredNames("const window = 1; let top; var ok;"), ["ok"]);
  assert.deepEqual(declaredNames(""), []);
});

test("js-документ: prelude → пред-скрипт → код → vars → тесты → runner; нет eval", () => {
  const doc = buildTestDoc({ editor: "js", code: "function f(x) { return x; }", tests, runId: "r1", nonce: "abc123" });
  const order = ["Content-Security-Policy", "function f(x)", '"].vars = function', "add(0, async function", "add(1, async function"]
    .map((s) => doc.indexOf(s));
  assert.ok(order.every((i) => i >= 0), JSON.stringify(order));
  assert.ok(order.every((v, i) => i === 0 || v > order[i - 1]), "порядок: " + JSON.stringify(order));
  assert.ok(!/\beval\(|new Function/.test(doc.slice(doc.indexOf("function f(x)"))), "тесты не через eval/Function: CSP без unsafe-eval");
  assert.match(doc, /script-src 'unsafe-inline'/);
  assert.ok(!doc.includes("unsafe-eval"));
});

test("ключ отчёта лежит только в runner-скрипте, не в пред-скрипте и не в prelude", () => {
  const doc = buildTestDoc({ editor: "js", code: "", tests, runId: "r1", nonce: "SECRETNONCE9" });
  const scripts = [...doc.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const withNonce = scripts.filter((s) => s.includes("SECRETNONCE9"));
  assert.equal(withNonce.length, 1);
  assert.match(withNonce[0], /document\.currentScript/); // и это скрипт, удаляющий себя
  assert.ok(withNonce[0].includes("report"));
});

test("</script> в тесте и в коде кандидата не закрывает тег; тесты ограничены MAX_TESTS", () => {
  const evil = [{ name: "x", code: 'const s = "</script><script>alert(1)</script>";' }];
  const doc = buildTestDoc({ editor: "js", code: 'const t = "</script>";', tests: evil, runId: "r", nonce: "n" });
  assert.ok(!doc.includes("</script><script>alert(1)"));
  assert.ok(doc.includes('"<\\/script><script>alert(1)<\\/script>"'));
  assert.ok(doc.includes('const t = "<\\/script>";'));
  const many = Array.from({ length: MAX_TESTS + 5 }, (_, i) => ({ name: `t${i}`, code: "" }));
  const d2 = buildTestDoc({ editor: "js", code: "", tests: many, runId: "r", nonce: "n" });
  assert.equal((d2.match(/\.add\(\d+, async function/g) || []).length, MAX_TESTS);
});

test("web-документ: HTML кандидата сохранён, тесты в конце; canTest только js и web", () => {
  const html = "<!doctype html><html><body><h1>Salom</h1></body></html>";
  const doc = buildTestDoc({ editor: "web", code: html, tests, runId: "r", nonce: "n" });
  assert.ok(doc.indexOf("<h1>Salom</h1>") < doc.indexOf("add(0, async function"));
  assert.ok(doc.startsWith("<!doctype html>"));
  assert.deepEqual(["js", "web", "jsx", "vue", "tailwind", "html", "node"].filter(canTest), ["js", "web"]);
});
