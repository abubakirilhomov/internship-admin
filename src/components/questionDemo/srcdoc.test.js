// node --test: сборка srcdoc и варианты сцены. Данные синтетические.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CSP, SANDBOX, buildSrcdoc, clampWidth, fitScale, localizedCaption, resolveVariant, safeJson } from "./srcdoc.js";

test("CSP без сети стоит первым в head, до любого авторского HTML/CSS", () => {
  const doc = buildSrcdoc({ html: '<meta http-equiv="Content-Security-Policy" content="default-src *"><p>x</p>', css: "p{}" });
  const head = doc.slice(doc.indexOf("<head>") + 6);
  assert.ok(head.startsWith(`<meta http-equiv="Content-Security-Policy" content="${CSP}">`));
  assert.match(CSP, /default-src 'none'/);
  assert.match(CSP, /connect-src 'none'/);
  assert.doesNotMatch(CSP, /https?:|\*/);
});

test("sandbox без allow-same-origin", () => {
  assert.equal(SANDBOX, "allow-scripts");
  assert.doesNotMatch(SANDBOX, /same-origin|top-navigation|popups|forms/);
});

test("строка шага не закрывает <script>, CSS не закрывает <style>", () => {
  const doc = buildSrcdoc({ html: "", css: "a{}</style><script>alert(1)</script>",
    steps: [{ type: "click", target: "</script><script>alert(2)</script>" }] });
  const body = doc.slice(doc.indexOf("<body>"));
  assert.equal((body.match(/<\/script>/g) || []).length, 2); // конфиг + рантайм
  assert.equal((doc.match(/<\/style>/gi) || []).length, 2); // базовый + авторский, автор свой не закрыл
  assert.doesNotMatch(doc, /<\/style><script>alert\(1\)/);
  assert.equal(JSON.parse(safeJson({ a: "</script>\u2028" })).a, "</script>\u2028");
});

test("конфиг: шаги и autoplay", () => {
  const doc = buildSrcdoc({ html: "<b>x</b>", steps: [{ type: "wait", ms: 10 }], autoplay: true });
  const json = doc.match(/id="__demo_cfg">(.*?)<\/script>/)[1];
  assert.deepEqual(JSON.parse(json), { steps: [{ type: "wait", ms: 10 }], autoplay: true });
});

test("вариант «исправлено»: css дописывается, html и шаги заменяются, подпись своя", () => {
  const demo = { html: "<p>a</p>", css: ".a{top:0}", steps: [{ type: "wait" }], caption: "uz", captionRu: "ru" };
  assert.deepEqual(resolveVariant(demo, null, true).css, ".a{top:0}");
  const fixed = resolveVariant(demo, { css: ".a{top:1px}", captionRu: "исправлено" }, true);
  assert.equal(fixed.html, "<p>a</p>");
  assert.ok(fixed.css.indexOf(".a{top:0}") < fixed.css.indexOf(".a{top:1px}"));
  assert.deepEqual(fixed.steps, demo.steps);
  assert.equal(localizedCaption(fixed, "ru"), "исправлено");
  assert.equal(localizedCaption(fixed, "uz"), "uz");
  assert.equal(resolveVariant(demo, { html: "<i>b</i>", steps: [] }, true).html, "<i>b</i>");
  assert.deepEqual(resolveVariant(demo, { html: "<i>b</i>", steps: [] }, true).steps, []);
  assert.equal(resolveVariant(demo, { css: "x" }, false).css, ".a{top:0}");
});

test("масштаб и ширина", () => {
  assert.equal(fitScale(1440, 720), 0.5);
  assert.equal(fitScale(375, 900), 1);
  assert.equal(clampWidth(100), 375);
  assert.equal(clampWidth(5000), 1440);
  assert.equal(clampWidth("800.4"), 800);
});
