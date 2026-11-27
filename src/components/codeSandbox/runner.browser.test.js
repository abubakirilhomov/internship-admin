// node --test: песочница для кода кандидата в настоящем Chromium (headless).
// (копия теста из candidates.) Родительская страница отдаётся с CSP ИЗ vercel.json админки — проверяется ровно та
// политика, что уходит на прод. В её localStorage и cookie лежит «токен».
// Код — синтетический. Нужен playwright-core: PLAYWRIGHT_CORE=/путь/к/playwright-core
// (и скачанный браузер). Без него тест пропускается.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import dgram from "node:dgram";
import fs from "node:fs";
import { createRequire } from "node:module";
import { SANDBOX, buildRunDoc, CSP } from "./runner.js";

let chromium = null;
try {
  const require = createRequire(import.meta.url);
  ({ chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core"));
} catch { /* нет playwright — пропуск */ }
const skip = chromium ? false : "нет playwright-core (PLAYWRIGHT_CORE)";

const vercel = JSON.parse(fs.readFileSync(new URL("../../../vercel.json", import.meta.url), "utf8"));
const APP_CSP = vercel.headers[0].headers.find((h) => h.key === "Content-Security-Policy").value;
const TOKEN = "SECRET-TOKEN-7f3a";

// Родитель: тот же приём, что в CodeRunner — iframe с sandbox и srcdoc, сообщения
// принимаются только от своего iframe и только текущего прогона.
const APP_JS = `
localStorage.setItem("cand.token", ${JSON.stringify(TOKEN)});
sessionStorage.setItem("cand.token", ${JSON.stringify(TOKEN)}); // приложение держит токен здесь
document.cookie = "sid=${TOKEN}; path=/";
window.msgs = [];
window.mount = (doc, width, runId) => {
  document.querySelectorAll("iframe").forEach((f) => f.remove());
  window.msgs = [];
  const f = document.createElement("iframe");
  f.setAttribute("sandbox", ${JSON.stringify(SANDBOX)});
  f.style.cssText = "border:0;height:400px;width:" + width + "px";
  f.srcdoc = doc;
  window.addEventListener("message", (e) => {
    if (e.source === f.contentWindow && e.data && e.data.__sbx === runId) window.msgs.push(e.data);
  });
  document.body.appendChild(f);
};`;

let browser;
let server;
let udp;
let base;
let udpPort;
let hits = [];
let udpHits = 0;

before(async () => {
  if (skip) return;
  server = http.createServer((req, res) => {
    if (req.url === "/app") {
      res.writeHead(200, { "content-type": "text/html", "content-security-policy": APP_CSP });
      return res.end('<!doctype html><html><head><title>app</title></head><body><script src="/app.js"></script></body></html>');
    }
    if (req.url === "/app.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      return res.end(APP_JS);
    }
    if (req.url === "/favicon.ico") return res.end();
    hits.push(req.url);
    res.writeHead(200, { "access-control-allow-origin": "*", "content-type": "text/plain" });
    res.end("leak");
  });
  server.on("upgrade", (req, sock) => { hits.push(`ws:${req.url}`); sock.destroy(); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  udp = dgram.createSocket("udp4");
  udp.on("message", () => { udpHits += 1; });
  await new Promise((r) => udp.bind(0, "127.0.0.1", r));
  udpPort = udp.address().port;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
  udp?.close();
});

let seq = 0;
async function run(editor, code, { width = 600, wait = 0, until, raw } = {}) {
  hits = [];
  udpHits = 0;
  const context = await browser.newContext();
  const popups = [];
  context.on("page", (p) => popups.push(p));
  const page = await context.newPage();
  page.on("pageerror", () => {});
  await page.goto(`${base}/app`);
  popups.length = 0;
  const runId = `r${++seq}`;
  const doc = raw ?? buildRunDoc({ editor, code, runId, lang: "ru", limitMs: 1000 });
  await page.evaluate(([d, w, id]) => window.mount(d, w, id), [doc, width, runId]);
  if (!raw) await page.waitForFunction(() => window.msgs.some((m) => m.type === "ready"), null, { timeout: 10000 });
  if (until) await page.waitForFunction(until, null, { timeout: 15000 });
  if (wait) await page.waitForTimeout(wait);
  const msgs = await page.evaluate(() => window.msgs);
  const frame = page.frames().find((f) => f !== page.mainFrame());
  return { page, frame, msgs, popups, context, logs: msgs.filter((m) => m.type === "log").map((m) => m.text) };
}
const hasLog = (text) => new Function(`return window.msgs.some((m) => m.type === "log" && m.text.includes(${JSON.stringify(text)}))`);

// ─── Приёмка: результат как в браузере ──────────────────────────────────────

test("js: порядок вывода — синхронный код, микрозадачи, затем таймер", { skip }, async () => {
  const { logs, context } = await run("js", [
    'setTimeout(() => console.log("t"), 0);',
    '(async () => { console.log("a1"); await null; console.log("a2"); })();',
    'queueMicrotask(() => console.log("m"));',
    'console.log("s");',
    'setTimeout(() => console.log("end"), 20);',
  ].join("\n"), { until: hasLog("end") });
  assert.deepEqual(logs, ["a1", "s", "a2", "m", "t", "end"]);
  await context.close();
});

test("web: mobile-first сетка — 1 колонка на 375, 4 на 1440 (media queries по ширине превью)", { skip }, async () => {
  const code = `<!doctype html><html><head><style>
.cols { display: grid; grid-template-columns: 1fr; }
@media (min-width: 768px) { .cols { grid-template-columns: repeat(4, 1fr); } }
</style></head><body><div class="cols"><div>1</div><div>2</div><div>3</div><div>4</div></div></body></html>`;
  for (const [width, expected] of [[375, 1], [1440, 4]]) {
    const { frame, context } = await run("web", code, { width });
    const cols = await frame.evaluate(() => getComputedStyle(document.querySelector(".cols")).gridTemplateColumns.split(" ").length);
    const mode = await frame.evaluate(() => document.compatMode);
    assert.equal(cols, expected, `ширина ${width}`);
    assert.equal(mode, "CSS1Compat");
    await context.close();
  }
});

test("консоль: форматирование значений, %s/%d, alert, ошибка с номером строки кандидата", { skip }, async () => {
  const { msgs, logs, context } = await run("js", [
    'console.log("%s = %d", "n", 5);',
    'const o = { a: 1, b: [1, "x"], m: new Map([[1, 2]]) }; o.self = o;',
    "console.log(o);",
    'console.warn("w"); alert("salom");',
    "notDefinedFn();",
  ].join("\n"), { until: () => window.msgs.some((m) => m.type === "error") });
  assert.deepEqual(logs, ["n = 5", "{a: 1, b: [1, 'x'], m: Map(1) {1 => 2}, self: [Circular]}", "w", "alert: salom"]);
  const err = msgs.find((m) => m.type === "error");
  assert.match(err.text, /notDefinedFn/);
  assert.equal(err.line, 5);
  await context.close();

  const web = await run("web", "<!doctype html>\n<p>x</p>\n<script>\nnope();\n</script>", { until: () => window.msgs.some((m) => m.type === "error") });
  assert.equal(web.msgs.find((m) => m.type === "error").line, 4);
  await web.context.close();
});

// ─── Бесконечные циклы ──────────────────────────────────────────────────────

test("while(true) не вешает страницу: цикл остановлен, страница отвечает", { skip }, async () => {
  for (const code of [
    'console.log("start"); while (true) {}',
    "for (;;) { try { while (true) {} } catch (e) {} }", // внешний цикл глотает ошибку — всё равно стоп
    "let i = 0; do { i++ } while (i > 0)",
  ]) {
    const { page, msgs, context } = await run("js", code, { until: () => window.msgs.some((m) => m.type === "error") });
    const t0 = Date.now();
    assert.equal(await page.evaluate(() => 1 + 1), 2);
    assert.ok(Date.now() - t0 < 1000);
    const loopErrs = msgs.filter((m) => /остановлен/.test(m.text));
    assert.ok(loopErrs.length >= 1, code);
    assert.equal(loopErrs[0].type, "error");
    assert.equal(loopErrs[0].line, 0); // ошибка из служебного кода — без ложного номера строки
    await context.close();
  }
  const web = await run("web", "<p id=p>ok</p><script>while (true) {}</script>", { until: () => window.msgs.some((m) => m.type === "error") });
  assert.equal(await web.frame.evaluate(() => document.getElementById("p").textContent), "ok");
  await web.context.close();
});

// ─── Безопасность ───────────────────────────────────────────────────────────

test("токены приложения недоступны: ни localStorage родителя, ни свой, ни cookie, ни DOM родителя", { skip }, async () => {
  const { msgs, context } = await run("js", `
    const r = {};
    const tryIt = (k, f) => { try { r[k] = String(f()); } catch (e) { r[k] = "blocked"; } };
    tryIt("parentLS", () => parent.localStorage.getItem("cand.token"));
    tryIt("topLS", () => top.localStorage.getItem("cand.token"));
    tryIt("ownLS", () => localStorage.getItem("cand.token"));
    tryIt("session", () => sessionStorage.getItem("cand.token"));
    tryIt("parentSession", () => parent.sessionStorage.getItem("cand.token"));
    tryIt("cookie", () => document.cookie);
    tryIt("parentDoc", () => parent.document.cookie);
    tryIt("parentHref", () => parent.location.href);
    tryIt("opener", () => window.opener && window.opener.document);
    tryIt("idb", () => indexedDB.open("x") && "opened");
    console.log(JSON.stringify(r));`, { until: () => window.msgs.some((m) => m.type === "log") });
  const r = JSON.parse(msgs.find((m) => m.type === "log").text);
  assert.ok(!JSON.stringify(r).includes(TOKEN));
  for (const k of ["parentLS", "topLS", "ownLS", "session", "parentSession", "parentDoc", "parentHref", "idb"]) assert.equal(r[k], "blocked", k);
  assert.equal(r.cookie, "blocked");
  await context.close();
});

test("сеть закрыта: API, fetch, XHR, beacon, WebSocket, картинки, CSS, шрифты, формы, воркеры, вложенные iframe", { skip }, async () => {
  const u = (p) => `${base}${p}`;
  const code = `<!doctype html><html><head>
<link rel="stylesheet" href="${u("/link.css")}">
<style>@import url("${u("/import.css")}"); @font-face { font-family: X; src: url("${u("/font.woff")}"); }
.bg { background: url("${u("/bg.png")}"); font-family: X; }</style></head>
<body><div class="bg">x</div><img src="${u("/img.png")}"><video src="${u("/v.mp4")}"></video>
<object data="${u("/obj")}"></object><embed src="${u("/embed")}">
<iframe src="${u("/nested")}"></iframe>
<form id="f" action="${u("/form")}" method="post"><input name="a" value="1"></form>
<script>
const go = (f) => { try { f(); } catch (e) {} };
go(() => fetch("/api/candidate/session", { headers: { authorization: "Bearer x" } }).catch(() => {}));
go(() => fetch("${u("/fetch")}", { mode: "no-cors" }).catch(() => {}));
go(() => { const x = new XMLHttpRequest(); x.open("GET", "${u("/xhr")}"); x.send(); });
go(() => navigator.sendBeacon("${u("/beacon")}", "d"));
go(() => new WebSocket("${base.replace("http", "ws")}/ws"));
go(() => new EventSource("${u("/sse")}"));
go(() => { new Image().src = "${u("/image")}"; });
go(() => new Worker(URL.createObjectURL(new Blob(["fetch('${u("/worker")}')"]))));
go(() => document.getElementById("f").requestSubmit());
</script></body></html>`;
  const { msgs, context } = await run("web", code, { wait: 1500 });
  assert.deepEqual(hits, []);
  assert.ok(msgs.some((m) => m.type === "log" && /Сеть в песочнице закрыта/.test(m.text)));
  await context.close();
});

test("уход iframe на чужой адрес (location, ссылка, meta refresh) — не доходит до сети", { skip }, async () => {
  for (const code of [
    `<script>setTimeout(() => { location.href = "${base}/nav"; }, 50)</script>`,
    `<a id="a" href="${base}/link">x</a><script>document.getElementById("a").click()</script>`,
    `<meta http-equiv="refresh" content="0;url=${base}/refresh">`,
  ]) {
    const r = await run("web", code, { wait: 800 });
    assert.deepEqual(hits, [], code);
    await r.context.close();
  }
  // Второй слой отдельно: документ БЕЗ prelude (не отменяет переходы) —
  // переход режет только frame-src 'none' из vercel.json.
  const bare = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${CSP}"><script>location.href = "${base}/bare"</script>`;
  const r = await run("web", "", { raw: bare, wait: 800 });
  assert.deepEqual(hits, []);
  await r.context.close();
});

test("окна не открываются: window.open, target=_blank, форма в новое окно", { skip }, async () => {
  const { msgs, popups, context } = await run("web", `
<a id="a" href="${base}/blank" target="_blank">x</a>
<form id="f" action="${base}/form2" target="_blank"></form>
<script>
const w = window.open("${base}/open");
console.log("open:" + String(w));
document.getElementById("a").click();
document.getElementById("f").requestSubmit();
</script>`, { wait: 1000 });
  assert.ok(msgs.some((m) => m.text === "open:null"));
  assert.equal(popups.length, 0);
  assert.deepEqual(hits, []);
  await context.close();
});

test("WebRTC (STUN мимо CSP) закрыт заглушкой", { skip }, async () => {
  const { msgs, context } = await run("js", `
try {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:127.0.0.1:${udpPort}" }] });
  pc.createDataChannel("x");
  pc.createOffer().then((o) => pc.setLocalDescription(o));
  console.log("made");
} catch (e) { console.log("rtc: " + e.message); }
try { window.RTCPeerConnection = function () {}; } catch (e) {}
console.log(typeof webkitRTCPeerConnection);`, { wait: 2000 });
  assert.ok(msgs.some((m) => /^rtc: RTCPeerConnection: в песочнице отключён/.test(m.text)), JSON.stringify(msgs));
  assert.equal(udpHits, 0);
  await context.close();
});

test("сообщения чужого прогона и не от своего iframe родитель не принимает", { skip }, async () => {
  const { page, context } = await run("js", 'console.log("mine")', { until: hasLog("mine") });
  await page.evaluate(() => window.postMessage({ __sbx: "r-other", type: "log", text: "spoof" }, "*"));
  await page.waitForTimeout(200);
  const texts = await page.evaluate(() => window.msgs.map((m) => m.text));
  assert.ok(!texts.includes("spoof"));
  await context.close();
});
