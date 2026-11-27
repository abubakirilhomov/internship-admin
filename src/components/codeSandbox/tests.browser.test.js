// node --test: автотесты мини-заданий в настоящем Chromium. Родитель — страница с CSP из vercel.json
// и «токеном» в storage/cookie; runTests берётся из РЕАЛЬНОГО tests.js (собирается esbuild).
// Код и тесты — синтетические. Нужен playwright-core: PLAYWRIGHT_CORE=/путь (без него — пропуск).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

let chromium = null;
let esbuild = null;
try {
  const require = createRequire(import.meta.url);
  ({ chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core"));
  esbuild = require("esbuild");
} catch { /* нет playwright/esbuild — пропуск */ }
const skip = chromium && esbuild ? false : "нет playwright-core (PLAYWRIGHT_CORE) или esbuild";

const vercel = JSON.parse(fs.readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8"));
const APP_CSP = vercel.headers[0].headers.find((h) => h.key === "Content-Security-Policy").value;
const TOKEN = "SECRET-TOKEN-9c1d";

let browser;
let server;
let base;
let bundle = "";
let hits = [];

before(async () => {
  if (skip) return;
  const entry = fileURLToPath(new URL("./tests.js", import.meta.url));
  bundle = esbuild.buildSync({ entryPoints: [entry], bundle: true, format: "iife", globalName: "T", write: false, target: "es2020" }).outputFiles[0].text;
  server = http.createServer((req, res) => {
    if (req.url === "/app") {
      res.writeHead(200, { "content-type": "text/html", "content-security-policy": APP_CSP });
      return res.end('<!doctype html><html><head><title>app</title></head><body><script src="/t.js"></script><script src="/app.js"></script></body></html>');
    }
    if (req.url === "/t.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(bundle); }
    if (req.url === "/app.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      return res.end(`localStorage.setItem("k", ${JSON.stringify(TOKEN)}); sessionStorage.setItem("k", ${JSON.stringify(TOKEN)}); document.cookie = "sid=${TOKEN}; path=/";`);
    }
    if (req.url === "/favicon.ico") return res.end();
    hits.push(req.url);
    res.writeHead(200, { "access-control-allow-origin": "*", "content-type": "text/plain" });
    res.end("leak");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

async function go(args) {
  hits = [];
  const context = await browser.newContext();
  const popups = [];
  context.on("page", (p) => popups.push(p));
  const page = await context.newPage();
  page.on("pageerror", () => {});
  await page.goto(`${base}/app`);
  popups.length = 0;
  const t0 = Date.now();
  const result = await page.evaluate((a) => window.T.runTests(a), args);
  const frames = await page.evaluate(() => document.querySelectorAll("iframe").length);
  return { result, ms: Date.now() - t0, page, context, popups, frames };
}

const SUM_TESTS = [
  { name: "sum(1, 2) = 3", code: "assert.equal(sum(1, 2), 3);" },
  { name: "sum() = 0", code: "assert.equal(sum(), 0);" },
  { name: "massivlar", code: "assert.deepEqual(pair(1, 2), { a: 1, b: [2] }); assert.deepEqual(new Set([1, 2]), new Set([2, 1]));" },
];
const GOOD = "function sum(...n) { return n.reduce((a, b) => a + b, 0); }\nconst pair = (a, b) => ({ a, b: [b] });";

test("js: верное решение — все проверки пройдены, iframe убран, сеть и окна не тронуты", { skip }, async () => {
  const { result, frames, popups, context } = await go({ tests: SUM_TESTS, editor: "js", code: GOOD, lang: "ru" });
  assert.equal(result.passed, 3);
  assert.equal(result.total, 3);
  assert.deepEqual(result.results.map((r) => r.ok), [true, true, true]);
  assert.deepEqual(result.results.map((r) => r.name), SUM_TESTS.map((t) => t.name));
  assert.equal(result.error, "");
  assert.equal(frames, 0);
  assert.equal(popups.length, 0);
  assert.deepEqual(hits, []);
  await context.close();
});

test("js: неверное решение — упавшие проверки с «ожидалось/получено» на языке кандидата", { skip }, async () => {
  const bad = "function sum(a, b) { return a * b; }\nconst pair = (a, b) => ({ a, b });";
  const ru = await go({ tests: SUM_TESTS, editor: "js", code: bad, lang: "ru" });
  assert.equal(ru.result.passed, 0);
  assert.equal(ru.result.results[0].message, "ожидалось: 3, получено: 2");
  assert.match(ru.result.results[1].message, /ожидалось: 0, получено: NaN/);
  assert.match(ru.result.results[2].message, /ожидалось: {"a":1,"b":\[2\]}, получено: {"a":1,"b":2}/);
  await ru.context.close();
  const uz = await go({ tests: SUM_TESTS.slice(0, 1), editor: "js", code: bad, lang: "uz" });
  assert.equal(uz.result.results[0].message, "kutilgan: 3, olingan: 2");
  await uz.context.close();
});

test("js: один тест из трёх; нет функции — ReferenceError; ошибка синтаксиса — всё упало + текст ошибки", { skip }, async () => {
  const half = await go({ tests: SUM_TESTS, editor: "js", code: "function sum(...n) { return n.length ? n[0] + n[1] : 0; }\nconst pair = (a, b) => ({ a, b: [b] });", lang: "ru" });
  assert.equal(half.result.passed, 3); // sum(1,2)=3, sum()=0 — обе верны, pair верна
  await half.context.close();
  const one = await go({ tests: SUM_TESTS, editor: "js", code: "function sum() { return 3; }", lang: "ru" });
  assert.deepEqual(one.result.results.map((r) => r.ok), [true, false, false]);
  assert.match(one.result.results[2].message, /ReferenceError: pair is not defined/);
  await one.context.close();
  const syn = await go({ tests: SUM_TESTS, editor: "js", code: "function sum( { return 1 }", lang: "ru" });
  assert.equal(syn.result.passed, 0);
  assert.match(syn.result.error, /Unexpected|token|identifier/i);
  assert.match(syn.result.results[0].message, /ReferenceError: sum is not defined/);
  await syn.context.close();
});

test("async: промисы, таймеры, подмена fetch, console.log и vars()", { skip }, async () => {
  const tests = [
    { name: "again", code: "let n = 0; const r = await tryAgain(async () => { n++; if (n < 3) throw new Error('e'); return 'ok'; }, 5); assert.equal(r, 'ok'); assert.equal(n, 3);" },
    { name: "again fails", code: "let n = 0; await assert.rejects(() => tryAgain(async () => { n++; throw new Error('last' + n); }, 2)); assert.equal(n, 2);" },
    { name: "late", code: "let calls = []; const d = lateX((v) => calls.push(v), 40); d(1); d(2); d(3); assert.deepEqual(calls, []); await sleep(120); assert.deepEqual(calls, [3]);" },
    { name: "fetch", code: "const seen = []; window.fetch = async (u) => { seen.push(u); return { json: async () => u.slice(-1) }; }; const out = await fetchAll(['1', '2']); assert.deepEqual(out, ['1', '2']); assert.deepEqual(seen, ['/api/things/1', '/api/things/2']);" },
    { name: "console.log", code: "assert.ok(logs.some((a) => a[0] === 'salom'), 'log yo\\'q'); assert.deepEqual(logs[0], ['salom', 42]);" },
    { name: "vars", code: "assert.deepEqual(vars().stats, { uno: 5 }); assert.equal(vars().nope, undefined);" },
  ];
  const code = `
async function tryAgain(fn, attempts) { let last; for (let i = 0; i < attempts; i++) { try { return await fn(); } catch (e) { last = e; } } throw last; }
function lateX(fn, ms) { let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }
async function fetchAll(ids) { return Promise.all(ids.map(async (id) => (await fetch('/api/things/' + id)).json())); }
const stats = { uno: 5 };
console.log('salom', 42);`;
  const { result, context } = await go({ tests, editor: "js", code, lang: "uz" });
  assert.deepEqual(result.results.map((r) => `${r.name}:${r.ok ? "ok" : r.message}`), tests.map((t) => `${t.name}:ok`));
  await context.close();
});

test("web: проверки по DOM документа кандидата", { skip }, async () => {
  const tests = [
    { name: "h1", code: "assert.equal(document.querySelector('h1').textContent, 'Salom');" },
    { name: "uchta li", code: "assert.equal(document.querySelectorAll('li').length, 3);" },
    { name: "skript ishladi", code: "assert.equal(document.body.dataset.ready, 'yes');" },
  ];
  const html = "<!doctype html><html><body><h1>Salom</h1><ul><li>1</li><li>2</li></ul><script>document.body.dataset.ready='yes'</script></body></html>";
  const { result, context } = await go({ tests, editor: "web", code: html, lang: "ru" });
  assert.deepEqual(result.results.map((r) => r.ok), [true, false, true]);
  assert.equal(result.results[1].message, "ожидалось: 3, получено: 2");
  await context.close();
});

test("бесконечный цикл и вечный промис: прогон завершается, страница жива", { skip }, async () => {
  const tests = [
    { name: "tsikl", code: "assert.equal(spin(), 1);" },
    { name: "keyingi", code: "assert.equal(spin(), 1);" },
    { name: "tugamaydi", code: "await new Promise(() => {});" },
    { name: "oddiy", code: "assert.ok(true);" },
  ];
  const { result, ms, page, context } = await go({ tests, editor: "js", code: "function spin() { while (true) {} }", lang: "ru" });
  assert.equal(result.timedOut, false);
  assert.deepEqual(result.results.map((r) => r.ok), [false, false, false, true]);
  assert.match(result.results[0].message, /остановлен/);
  assert.match(result.results[2].message, /не завершилось за 2.5 с/);
  assert.ok(ms < 12000, `слишком долго: ${ms}`);
  assert.equal(await page.evaluate(() => 1 + 1), 2);
  await context.close();
});

test("код кандидата не подделает отчёт и не достанет ни токен, ни сеть, ни окна", { skip }, async () => {
  const forge = `
function sum() { return -1; }
// 1) шлёт поддельный отчёт «всё пройдено» с найденным runId (он лежит в prelude) и угаданным ключом
const text = [...document.scripts].map((s) => s.textContent).join("\\n");
const runId = (/"runId":"([^"]+)"/.exec(text) || [])[1];
const fake = [{ ok: true }, { ok: true }, { ok: true }];
for (const nonce of ["", "guess", "0", runId]) {
  parent.postMessage({ __sbx: runId, type: "tests", nonce, results: fake, error: "" }, "*");
}
// 2) пробует вызвать канал отчёта напрямую
for (const k of Object.getOwnPropertyNames(window)) {
  if (k === "__marsTests") { try { window[k].report(fake, "guess"); window[k].report(fake, runId); } catch (e) {} }
}
// 3) ищет ключ в DOM позже (после разбора документа)
setTimeout(() => {
  const later = [...document.scripts].map((s) => s.textContent).join("\\n");
  const m = /nonce":"([0-9a-f]{24})"/.exec(later);
  if (m) parent.postMessage({ __sbx: runId, type: "tests", nonce: m[1], results: fake, error: "" }, "*");
  window.__leak = m ? m[1] : "none";
}, 0);
// 4) токен, сеть, окна
let stolen = "";
try { stolen = parent.localStorage.getItem("k"); } catch (e) { stolen = "blocked"; }
try { fetch("/leak-fetch"); } catch (e) {}
try { window.open("/leak-popup"); } catch (e) {}
try { top.location = "/leak-nav"; } catch (e) {}
window.__stolen = stolen;`;
  const tests = [
    { name: "a", code: "assert.equal(sum(), 0);" },
    { name: "b", code: "assert.equal(sum(), 0);" },
    { name: "c", code: "assert.equal(window.__stolen, 'blocked'); assert.equal(window.__leak, 'none');" },
  ];
  const { result, popups, page, context } = await go({ tests, editor: "js", code: forge, lang: "ru" });
  assert.equal(result.passed, 1, JSON.stringify(result.results)); // только проверка «токен не украден / ключ не найден»
  assert.deepEqual(result.results.map((r) => r.ok), [false, false, true]);
  assert.equal(popups.length, 0);
  assert.deepEqual(hits, []);
  assert.match(page.url(), /\/app$/);
  await context.close();
});

test("без тестов — пустой результат без iframe; плохое сообщение от чужого окна игнорируется", { skip }, async () => {
  const { result, frames, context } = await go({ tests: [], editor: "js", code: "x", lang: "ru" });
  assert.deepEqual(result, { passed: 0, total: 0, results: [], error: "", timedOut: false });
  assert.equal(frames, 0);
  await context.close();
});
