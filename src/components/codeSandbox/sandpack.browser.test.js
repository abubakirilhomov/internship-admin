// node --test: Sandpack (React / Vue / Vue + Tailwind) в настоящем Chromium и с НАСТОЯЩИМ
// бандлером CodeSandbox (нужен интернет). Родительская страница собирается из боевого
// SandpackRunner (harness/) и отдаётся с CSP ИЗ vercel.json; в её localStorage /
// sessionStorage / cookie (в админке access-токен живёт в памяти, в localStorage — только user; тест берёт худший случай) лежит «токен». Код «кандидата» — синтетический.
// Нужны playwright-core (PLAYWRIGHT_CORE=/путь/к/playwright-core) и скачанный браузер;
// без них или без сети тест пропускается.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { BUNDLER_HOST, BUNDLER_URL, SANDPACK_IFRAME_SANDBOX } from "./sandpack.js";

let chromium = null;
try {
  const require = createRequire(import.meta.url);
  ({ chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core"));
} catch { /* нет playwright — пропуск */ }
const skipNoPw = chromium ? false : "нет playwright-core (PLAYWRIGHT_CORE)";

const here = path.dirname(fileURLToPath(import.meta.url));
const vercel = JSON.parse(fs.readFileSync(path.join(here, "../../../vercel.json"), "utf8"));
const APP_CSP = vercel.headers[0].headers.find((h) => h.key === "Content-Security-Policy").value;
const TOKEN = "SECRET-TOKEN-7f3a";

let browser;
// Приложение «живёт» на https-origin (как на Vercel); запросы к нему перехватывает route контекста.
const base = "https://candidates.test";
let outDir;
let hits = [];
let online = false;
const skipReason = () => skipNoPw || (online ? false : "нет доступа к бандлеру CodeSandbox (интернет)");
// skip решается ПОСЛЕ before (там проверяется сеть), поэтому внутри теста.
const it = (name, fn) => test(name, async (t) => { const why = skipReason(); if (why) return t.skip(why); return fn(t); });

before(async () => {
  if (skipNoPw) return;
  online = await fetch(BUNDLER_URL, { signal: AbortSignal.timeout(8000) }).then((r) => r.ok, () => false);
  if (!online) return;
  const [{ build }, { default: react }] = await Promise.all([import("vite"), import("@vitejs/plugin-react")]);
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-harness-"));
  await build({
    root: path.join(here, "harness"), configFile: false, logLevel: "error", base: "./",
    plugins: [react()], build: { outDir, emptyOutDir: true },
  });
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (outDir) fs.rmSync(outDir, { recursive: true, force: true });
});

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
async function serve(route) {
  const req = route.request();
  const url = new URL(req.url()).pathname;
  const index = () => fs.readFileSync(path.join(outDir, "index.html"));
  if (url === "/app" || url === "/app2") {
    if (url === "/app2") hits.push({ url, headers: await req.allHeaders(), framed: true });
    return route.fulfill({ status: 200, headers: { "content-type": "text/html", "content-security-policy": APP_CSP }, body: index() });
  }
  if (url === "/bare") return route.fulfill({ status: 200, headers: { "content-type": "text/html" }, body: index() }); // без CSP
  const file = path.join(outDir, url);
  if (url !== "/" && file.startsWith(outDir) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(file)] || "application/octet-stream", "content-security-policy": APP_CSP }, body: fs.readFileSync(file) });
  }
  if (url === "/favicon.ico") return route.fulfill({ status: 204 });
  hits.push({ url: new URL(req.url()).pathname, headers: await req.allHeaders() });
  return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "text/plain" }, body: "leak" });
}

// Один контекст = общий HTTP-кэш, как у одного кандидата (холодный старт — первый тест).
async function open(editor, code, { shared, path: p = "/app" } = {}) {
  hits = [];
  const context = shared || await browser.newContext();
  await context.route(`${base}/**`, serve);
  const page = await context.newPage();
  const popups = []; // только окна, открытые кодом (сама страница уже создана)
  context.on("page", (pg) => popups.push(pg));
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.addInitScript(() => {
    window.__v = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__v.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const t0 = Date.now();
  await page.goto(`${base}${p}?editor=${editor}&code=${encodeURIComponent(code)}`);
  await page.waitForFunction(() => window.__setSandbox);
  const frame = () => page.frames().find((f) => f.url().includes(BUNDLER_HOST));
  return { context, page, popups, pageErrors, frame, t0 };
}
const loaded = (page) => page.waitForFunction(() => !document.querySelector('[data-testid="sp-loading"]'), null, { timeout: 45000 });

it("iframe: хост бандлера и минимальный sandbox", async () => {
  const s = await open("jsx", "function A(){ return <b id='b'>ok</b>; }");
  await loaded(s.page);
  const frames = await s.page.evaluate(() => [...document.querySelectorAll("iframe")].map((f) => ({ sandbox: f.getAttribute("sandbox"), src: f.src, ref: f.referrerPolicy })));
  assert.equal(frames.length, 1);
  assert.equal(frames[0].sandbox, SANDPACK_IFRAME_SANDBOX);
  for (const bad of ["allow-popups", "allow-top-navigation", "allow-modals", "allow-downloads", "allow-pointer-lock", "allow-presentation"]) {
    assert.ok(!frames[0].sandbox.includes(bad), bad);
  }
  assert.equal(new URL(frames[0].src).host, BUNDLER_HOST);
  assert.equal(frames[0].ref, "no-referrer");
  assert.deepEqual(await s.page.evaluate(() => window.__v), [], "CSP родителя ничего не заблокировала");
  await s.context.close();
});

it("React: R4-счётчик решается, клик работает, консоль без дублей (без StrictMode)", async () => {
  const code = `function Counter() {
  const [count, setCount] = useState(0);
  console.log("render", count);
  return <button id="b" onClick={() => setCount(count + 1)}>Count: {count}</button>;
}`;
  const s = await open("jsx", code);
  await loaded(s.page);
  const fr = s.frame();
  await fr.waitForSelector("#b", { timeout: 20000 });
  const first = Date.now() - s.t0;
  await fr.click("#b");
  await fr.waitForFunction(() => document.querySelector("#b").innerText === "Count: 1");
  const log = await s.page.locator("[role=log]").innerText();
  assert.match(log, /render 0/);
  assert.equal((log.match(/render 0/g) || []).length, 1, "одна строка на рендер");
  console.log(`# React: первая загрузка ${first} мс`);
  assert.deepEqual(await s.page.evaluate(() => window.__v), []);
  await s.context.close();
});

it("Vue: V-задание (script setup) решается, console.log и реактивность", async () => {
  const code = `<script setup>
import { ref } from "vue";
const n = ref(0);
console.log("vue setup");
</script>
<template><button id="b" @click="n++">Count: {{ n }}</button></template>`;
  const s = await open("vue", code);
  await loaded(s.page);
  const fr = s.frame();
  await fr.waitForSelector("#b", { timeout: 20000 });
  console.log(`# Vue: первая загрузка ${Date.now() - s.t0} мс`);
  await fr.click("#b");
  await fr.waitForFunction(() => document.querySelector("#b").innerText === "Count: 1");
  assert.match(await s.page.locator("[role=log]").innerText(), /vue setup/);
  assert.deepEqual(await s.page.evaluate(() => window.__v), []);
  await s.context.close();
});

it("Tailwind v4: T-вёрстка — голая разметка заворачивается в template, классы работают", async () => {
  const code = `<div id="box" class="p-8 bg-sky-500 text-white rounded-xl md:w-1/2">Tailwind v4</div>`;
  const s = await open("tailwind", code);
  await loaded(s.page);
  const fr = s.frame();
  await fr.waitForSelector("#box", { timeout: 20000 });
  console.log(`# Tailwind: первая загрузка ${Date.now() - s.t0} мс`);
  await fr.waitForFunction(() => getComputedStyle(document.querySelector("#box")).backgroundColor.startsWith("oklch"), null, { timeout: 15000 });
  const css = await fr.evaluate(() => { const c = getComputedStyle(document.querySelector("#box")); return { pad: c.paddingTop, color: c.color }; });
  assert.equal(css.pad, "32px");
  assert.deepEqual(await s.page.evaluate(() => window.__v), []);
  await s.context.close();
});

it("правка кода обновляет превью; правка во время первой загрузки не теряется", async () => {
  const s = await open("jsx", "function A(){ return <b id='b'>v1</b>; }");
  // сразу, не дожидаясь первой загрузки бандлера
  await s.page.evaluate(() => window.__setSandbox({ editor: "jsx", code: "function A(){ return <b id='b'>v2</b>; }" }));
  await loaded(s.page);
  const fr = s.frame();
  await fr.waitForFunction(() => document.querySelector("#b")?.innerText === "v2", null, { timeout: 25000 });
  await s.page.evaluate(() => window.__setSandbox({ editor: "jsx", code: "function A(){ return <b id='b'>v3</b>; }" }));
  await fr.waitForFunction(() => document.querySelector("#b")?.innerText === "v3", null, { timeout: 15000 });
  await s.context.close();
});

it("Vue и Tailwind без <script> (только разметка): правка обновляет превью", async () => {
  // Регресс: бандлер не обновляет SFC без <script> — normalizeVue добавляет пустой компонент.
  for (const [editor, one, two] of [
    ["vue", "<template><b id='x'>one</b></template>", "<template><b id='x'>two</b></template>"],
    ["tailwind", "<b id='x' class='p-2'>one</b>", "<b id='x' class='p-2'>two</b>"],
  ]) {
    const s = await open(editor, one);
    await loaded(s.page);
    await s.frame().waitForFunction(() => document.querySelector("#x")?.innerText === "one", null, { timeout: 25000 });
    await s.page.evaluate(([e, c]) => window.__setSandbox({ editor: e, code: c }), [editor, two]);
    await s.frame().waitForFunction(() => document.querySelector("#x")?.innerText === "two", null, { timeout: 15000 });
    await s.context.close();
  }
});

it("ошибка компиляции показывается в консоли, страница живёт", async () => {
  const s = await open("jsx", "function A(){ return <b>; }");
  await loaded(s.page);
  await s.page.waitForSelector('[data-testid="sp-error"]', { timeout: 20000 });
  assert.match(await s.page.locator('[data-testid="sp-error"]').innerText(), /✖/);
  assert.deepEqual(s.pageErrors, []);
  await s.context.close();
});

// ── Безопасность: код кандидата исполняется на чужом домене ──────────────────────────
const ATTACK = (b) => `const BASE = ${JSON.stringify(b)};
const r = {};
const t = (name, f) => { try { r[name] = String(f()); } catch (e) { r[name] = "ERR:" + e.name; } };
t("parentSession", () => parent.sessionStorage.getItem("token"));
t("parentLocal", () => parent.localStorage.getItem("token"));
t("parentCookie", () => parent.document.cookie);
t("topDoc", () => top.document.title);
t("topStorage", () => top.localStorage.length);
t("ownStorage", () => [localStorage.getItem("token"), sessionStorage.getItem("token"), document.cookie].join("|"));
t("open", () => window.open(BASE + "/leak-open", "_blank"));
t("topNav", () => { top.location = BASE + "/leak-top"; return "assigned"; });
t("parentNav", () => { parent.location.href = BASE + "/leak-parent"; return "assigned"; });
t("opener", () => String(window.opener));
fetch(BASE + "/leak-fetch", { mode: "no-cors", credentials: "include" }).catch(() => {});
const a = document.createElement("a"); a.href = BASE + "/leak-a"; a.target = "_top"; document.body.appendChild(a); a.click();
const f = document.createElement("form"); f.action = BASE + "/leak-form"; f.target = "_top"; f.method = "post"; document.body.appendChild(f); f.submit();
const ifr = document.createElement("iframe"); ifr.src = BASE + "/app2"; document.body.appendChild(ifr);
window.__res = r;
export default function App() { return <pre id="out">{JSON.stringify(r)}</pre>; }`;

it("безопасность: код кандидата не достаёт токены и не уводит вкладку", async () => {
  const s = await open("jsx", ATTACK(base));
  await loaded(s.page);
  const fr = s.frame();
  await fr.waitForSelector("#out", { timeout: 25000 });
  await s.page.waitForTimeout(2500); // навигации и запросы успевают случиться
  const res = JSON.parse(await fr.evaluate(() => document.querySelector("#out").innerText));
  for (const k of ["parentSession", "parentLocal", "parentCookie", "topDoc", "topStorage"]) {
    assert.match(res[k], /^ERR:SecurityError$/, `${k}: ${res[k]}`);
  }
  assert.ok(!res.ownStorage.includes(TOKEN), "в origin бандлера токена нет");
  assert.ok(!res.open || res.open === "null", "window.open заблокирован (нет allow-popups)");
  assert.equal(s.popups.length, 0, "новых окон нет");
  const url = new URL(s.page.url());
  assert.equal(url.pathname, "/app", "родитель не уведён с места");
  const leaked = hits.map((h) => h.url);
  for (const bad of ["/leak-open", "/leak-top", "/leak-parent", "/leak-a", "/leak-form"]) {
    assert.ok(!leaked.includes(bad), `${bad} не должен быть запрошен: ${leaked}`);
  }
  // fetch наружу кандидату доступен (он может писать код с fetch), но токенов в нём нет.
  for (const h of hits.filter((x) => !x.framed)) {
    const blob = JSON.stringify(h.headers);
    assert.ok(!blob.includes(TOKEN), "токен в заголовках");
    assert.equal(h.headers.cookie, undefined, "cookie не уходят");
    assert.equal(h.headers.authorization, undefined);
  }
  // наша страница во вложенном iframe не открывается (frame-ancestors 'none')
  const framedReq = hits.filter((h) => h.framed);
  assert.ok(framedReq.length >= 1, "вложенный iframe на нашу страницу действительно запрошен");
  assert.ok(!s.page.frames().some((f) => f.url().startsWith(`${base}/app2`)), "своя страница не загрузилась во фрейме (frame-ancestors 'none')");
  assert.deepEqual(s.pageErrors, []);
  await s.context.close();
});

it("безопасность: бесконечный цикл в превью не вешает приложение", async () => {
  const s = await open("jsx", "while (true) {}\nexport default function App(){ return null; }");
  await s.page.waitForTimeout(6000);
  const t0 = Date.now();
  assert.equal(await s.page.evaluate(() => 1 + 1), 2);
  assert.ok(Date.now() - t0 < 3000, "родитель отвечает (другой процесс)");
  await s.context.close();
});

it("безопасность: даже без CSP родителя навигацию и окна режет sandbox iframe", async () => {
  // Негативный контроль: страница без frame-src/frame-ancestors — защита держится на атрибутах iframe.
  const s = await open("jsx", ATTACK(base), { path: "/bare" });
  await loaded(s.page);
  await s.frame().waitForSelector("#out", { timeout: 25000 });
  await s.page.waitForTimeout(2500);
  assert.equal(new URL(s.page.url()).pathname, "/bare");
  assert.equal(s.popups.length, 0);
  const leaked = hits.map((h) => h.url);
  for (const bad of ["/leak-open", "/leak-top", "/leak-parent", "/leak-a", "/leak-form"]) assert.ok(!leaked.includes(bad), bad);
  const res = JSON.parse(await s.frame().evaluate(() => document.querySelector("#out").innerText));
  assert.match(res.parentSession, /SecurityError/);
  await s.context.close();
});
