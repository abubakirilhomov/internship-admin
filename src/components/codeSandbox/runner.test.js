// node --test: сборка документа песочницы и защита циклов. Код — синтетический.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CSP, SANDBOX, buildRunDoc, canRun, escapeScript, protectHtmlScripts } from "./runner.js";
import { GUARD, protectLoops } from "./protectLoops.js";

test("sandbox: скрипты и формы, но без same-origin, окон, ухода вкладки и модалок", () => {
  assert.equal(SANDBOX, "allow-scripts allow-forms");
  assert.doesNotMatch(SANDBOX, /same-origin|top-navigation|popups|modals|downloads/);
  assert.match(CSP, /default-src 'none'/);
  assert.match(CSP, /connect-src 'none'/);
  assert.match(CSP, /form-action 'none'/);
  assert.doesNotMatch(CSP, /https?:|\*|blob:/);
});

test("CSP — первым в документе, до кода кандидата (и для web, и для js)", () => {
  for (const editor of ["web", "js"]) {
    const doc = buildRunDoc({ editor, code: '<meta http-equiv="Content-Security-Policy" content="default-src *">' });
    assert.ok(doc.startsWith(`<!doctype html>`), editor);
    const i = doc.indexOf("Content-Security-Policy");
    assert.equal(doc.slice(i - 18, i + 34), `<meta http-equiv="Content-Security-Policy" content="`, editor);
    assert.ok(i < doc.indexOf("default-src *"), editor);
  }
});

test("web: свой doctype кандидата заменяется (всегда стандартный режим), служебная шапка сразу за ним", () => {
  const doc = buildRunDoc({ editor: "web", code: "<!DOCTYPE html>\n<html lang='uz'><body><p>salom</p></body></html>" });
  assert.equal(doc.match(/<!doctype/gi).length, 1);
  assert.ok(doc.endsWith("\n<html lang='uz'><body><p>salom</p></body></html>"));
  const noDoctype = buildRunDoc({ editor: "web", code: "<p>x</p>" });
  assert.ok(noDoctype.startsWith("<!doctype html><meta http-equiv"));
});

test("js: «</script» в коде не закрывает тег", () => {
  const doc = buildRunDoc({ editor: "js", code: 'console.log("</script><img src=x>")' });
  assert.equal(doc.match(/<\/script>/g).length, 2); // prelude + конец кода
  assert.ok(doc.includes('console.log("<\\/script><img src=x>")'));
  assert.equal(escapeScript("a</SCRIPT b"), "a<\\/SCRIPT b");
});

test("конфиг prelude — JSON без «<»: метка прогона не закроет тег", () => {
  const doc = buildRunDoc({ editor: "js", code: "", runId: "</script><b>" });
  assert.ok(!doc.includes("</script><b>"));
  assert.ok(doc.includes("\\u003c/script>\\u003cb>"));
});

test("номер строки: смещение шапки считается для js и web", () => {
  const off = (doc) => Number(/"lineOffset":(\d+)/.exec(doc)[1]);
  const js = buildRunDoc({ editor: "js", code: "a\nb" });
  // строка 1 кода идёт сразу после шапки
  assert.equal(js.split("\n")[off(js)], "a");
  const web = buildRunDoc({ editor: "web", code: "<!doctype html>\n<p>1</p>\n<p>2</p>" });
  assert.equal(web.split("\n")[off(web) + 1], "<p>1</p>"); // строка 2 кандидата
  const web2 = buildRunDoc({ editor: "web", code: "<p>1</p>\n<p>2</p>" });
  assert.equal(web2.split("\n")[off(web2) + 1], "<p>2</p>");
});

test("язык служебных сообщений", () => {
  assert.match(buildRunDoc({ editor: "js", lang: "ru" }), /остановлен/);
  assert.match(buildRunDoc({ editor: "js", lang: "uz" }), /to'xtatildi/);
});

test("canRun: превью только для web и js", () => {
  assert.deepEqual(["web", "js", "jsx", "vue", "html", "node", undefined].map(canRun), [true, true, false, false, false, false, false]);
});

test("protectLoops: сторож в теле каждого цикла, строки не сдвигаются", () => {
  const g = (n) => `${GUARD}(${n});`;
  assert.equal(protectLoops("for(;;);"), `for(;;){${g(1)};}`);
  assert.equal(protectLoops("while(a){b()}"), `while(a){${g(1)}b()}`);
  assert.equal(protectLoops("do c(); while(d);"), `do {${g(1)}c();} while(d);`);
  assert.equal(protectLoops("for (const k of o) if (k) continue;"), `for (const k of o) {${g(1)}if (k) continue;}`);
  assert.equal(protectLoops("l: for(;;) { for(;;) break l; }"), `l: for(;;) {${g(1)} for(;;) {${g(2)}break l;} }`);
  const multi = "let i = 0\nwhile (i < 3)\n  i++\nconsole.log(i)";
  assert.equal(protectLoops(multi).split("\n").length, 4);
  // строки и комментарии со словами for/while — не циклы
  assert.equal(protectLoops("const s = 'for while' // while(true)"), "const s = 'for while' // while(true)");
  // синтаксическая ошибка — код не трогаем
  assert.equal(protectLoops("while("), "while(");
});

test("protectHtmlScripts: только встроенные JS-скрипты", () => {
  const html = `<script>while(1){}</script><script type="module">for(;;){}</script><script type="text/template">while(1){}</script>`;
  const out = protectHtmlScripts(html);
  assert.ok(out.startsWith(`<script>while(1){${GUARD}(1);}</script><script type="module">for(;;){${GUARD}(1);}</script>`));
  assert.ok(out.endsWith(`<script type="text/template">while(1){}</script>`));
});
