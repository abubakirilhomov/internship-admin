// Запуск: npm run verify:reporter (из корня проекта).
// Тест-раннера в проекте нет, поэтому это самостоятельный node-скрипт.

// Браузерная часть репортера против минимального поддельного DOM.
// Проверяем поведение, а не чистые функции: очередь, отсутствующий приёмник,
// защита от петли, «никогда не бросает».

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); console.log(`  ✓ ${name}`); pass += 1; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); fail += 1; }
};
const eq = (a, b, m = "") => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${m}\n      получили: ${A}\n      ожидали:  ${B}`);
};
const ok = (v, m) => { if (!v) throw new Error(m || "ожидали истину"); };
const tick = () => new Promise((r) => setTimeout(r, 0));

// ─── Поддельный DOM ──────────────────────────────────────────────────────────
let sent = [];
let fetchImpl = async () => ({ ok: true, status: 202 });
let storeThrows = false;

const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => { if (storeThrows) throw new Error("QuotaExceeded"); return map.has(k) ? map.get(k) : null; },
    setItem: (k, v) => { if (storeThrows) throw new Error("QuotaExceeded"); map.set(k, v); },
    removeItem: (k) => { if (storeThrows) throw new Error("QuotaExceeded"); map.delete(k); },
    _map: map,
  };
};

const listeners = {};
const addL = (type, fn) => { (listeners[type] ||= []).push(fn); };
const dispatch = (type, ev) => (listeners[type] || []).forEach((f) => f(ev));

globalThis.window = {
  localStorage: makeStorage(),
  location: { href: "https://interns-mars.uz/lessons", pathname: "/lessons" },
  history: { pushState() {}, replaceState() {} },
  navigator: { sendBeacon: () => true },
  Blob: class { constructor(p) { this.parts = p; } },
  addEventListener: addL,
  fetch: async (url, init) => { sent.push({ url, init }); return fetchImpl(url, init); },
};
globalThis.document = { addEventListener: addL };

const reporter = await import("../src/utils/errorReporter.js");

const reset = ({ fetchFn, ...opts } = {}) => {
  sent = []; storeThrows = false;
  fetchImpl = fetchFn || (async () => ({ ok: true, status: 202 }));
  window.localStorage._map.clear();
  reporter._internals.reset();
  reporter.initErrorReporter({
    app: "interns",
    endpoint: "https://api.mars.uz/api",
    release: "abc1234",
    ...opts,
  });
};

const boom = () => {
  const e = new Error("Cannot read properties of undefined (reading 'name')");
  e.stack = "TypeError: boom\n    at LessonCard (https://interns-mars.uz/assets/index-Abc.js:4:8)";
  return e;
};
const queued = () => JSON.parse(window.localStorage._map.get("errorReporter.queue.v1") || "[]");

const section = (s) => console.log(`\n${s}`);

// ─────────────────────────────────────────────────────────────────────────────
section("Базовая отправка");

await t("init не бросает и вешает слушатели", () => {
  reset();
  ok(listeners.error && listeners.error.length > 0, "нет слушателя error");
  ok(listeners.unhandledrejection && listeners.unhandledrejection.length > 0);
  ok(reporter._internals.state().started);
});

await t("ошибка уходит на нужный URL в нужном формате", async () => {
  reset();
  reporter.reportError(boom());
  await tick();
  eq(sent.length, 1);
  eq(sent[0].url, "https://api.mars.uz/api/error-reports");
  const body = JSON.parse(sent[0].init.body);
  eq(body.app, "interns");
  eq(body.kind, "window-error");
  eq(body.release, "abc1234");
  ok(body.stack.includes("LessonCard"));
  eq(sent[0].init.keepalive, true, "без keepalive отчёт не переживёт закрытие вкладки");
});

await t("токен прикладывается для подтверждённой атрибуции", async () => {
  reset({ getToken: () => "tok-123" });
  reporter.reportError(boom());
  await tick();
  eq(sent[0].init.headers.Authorization, "Bearer tok-123");
});

await t("componentStack из ErrorBoundary доезжает", async () => {
  reset();
  reporter.reportReactError(boom(), "\n    in LessonCard\n    in Suspense");
  await tick();
  const body = JSON.parse(sent[0].init.body);
  eq(body.kind, "react-render");
  ok(body.componentStack.includes("in LessonCard"));
});

section("Приёмника ещё нет — 404/503 переживаются молча");

await t("404 не бросает, отчёт уходит в очередь", async () => {
  reset({ fetchFn: async () => ({ ok: false, status: 404 }) });
  reporter.reportError(boom());
  await tick(); await tick();
  eq(queued().length, 1, "отчёт потерян вместо очереди");
  eq(queued()[0].attempts, 0);
});

await t("503 — то же самое", async () => {
  reset({ fetchFn: async () => ({ ok: false, status: 503 }) });
  reporter.reportError(boom());
  await tick(); await tick();
  eq(queued().length, 1);
});

await t("сеть отвалилась (fetch бросает) — тоже в очередь, без исключения", async () => {
  reset({ fetchFn: async () => { throw new TypeError("Failed to fetch"); } });
  reporter.reportError(boom());
  await tick(); await tick();
  eq(queued().length, 1);
});

await t("очередь уходит пачкой, когда приёмник появился", async () => {
  reset({ fetchFn: async () => ({ ok: false, status: 404 }) });
  for (let i = 0; i < 3; i += 1) {
    const e = boom(); e.message = `boom ${i}`;
    reporter.reportError(e);
    await tick(); await tick();
  }
  eq(queued().length, 3);

  fetchImpl = async () => ({ ok: true, status: 202 });
  sent = [];
  await reporter._internals.drainQueue();
  eq(queued().length, 0, "очередь не очистилась после успешной отправки");
  eq(sent.length, 1, "должен быть один пакетный запрос");
  eq(JSON.parse(sent[0].init.body).events.length, 3);
});

await t("после N неудачных попыток отчёт выбрасывается, а не копится вечно", async () => {
  reset({ fetchFn: async () => ({ ok: false, status: 404 }), maxAttempts: 3 });
  reporter.reportError(boom());
  await tick(); await tick();
  for (let i = 0; i < 5; i += 1) await reporter._internals.drainQueue();
  eq(queued().length, 0, "мёртвый отчёт остался в очереди навсегда");
});

await t("очередь не разносит localStorage", async () => {
  reset({ fetchFn: async () => ({ ok: false, status: 404 }), maxQueueItems: 5 });
  for (let i = 0; i < 20; i += 1) {
    const e = boom(); e.message = `boom ${i}`;
    reporter.reportError(e);
    await tick(); await tick();
  }
  ok(queued().length <= 5, `в очереди ${queued().length}, потолок 5`);
});

await t("недоступный localStorage (приватный Safari) не роняет ничего", async () => {
  reset({ fetchFn: async () => ({ ok: false, status: 404 }) });
  storeThrows = true;
  reporter.reportError(boom());
  await tick(); await tick();
  // Главное — не было исключения.
  ok(true);
  storeThrows = false;
});

section("Защита от петли — главное требование");

await t("сбой доставки отчёта не репортится", async () => {
  // Иначе: отчёт не ушёл → репортим сбой → он тоже не уходит → бесконечность.
  reset({ fetchFn: async () => { throw new TypeError("Failed to fetch"); } });
  reporter.reportError(boom());
  await tick(); await tick(); await tick();
  eq(sent.length, 1, "репортер попытался сообщить о собственном сбое");
});

await t("HTTP-слой не репортит запросы к самому приёмнику", async () => {
  reset();
  reporter.reportApiFailure({ method: "POST", url: "https://api.mars.uz/api/error-reports", status: 500 });
  await tick();
  eq(sent.length, 0);
  ok(reporter.isIngestUrl("https://api.mars.uz/api/error-reports"));
});

await t("ошибка внутри репортера не уходит в бесконечную рекурсию", async () => {
  reset({ getUser: () => { throw new Error("сломанный getUser"); } });
  // Не должно ни бросить, ни зациклиться.
  reporter.reportError(boom());
  reporter.reportError(boom());
  await tick();
  ok(true);
});

section("Circuit breaker в бою");

await t("крэш-луп в рендере не долбит сеть", async () => {
  reset({ maxPerMinute: 5, maxPerSession: 50 });
  for (let i = 0; i < 200; i += 1) {
    const e = boom(); e.message = `render loop ${i}`; // разные — дедуп не спасёт
    reporter.reportError(e);
  }
  await tick(); await tick();
  eq(sent.length, 5, `ушло ${sent.length} запросов вместо 5`);
});

await t("одинаковая ошибка подряд шлётся один раз", async () => {
  reset();
  for (let i = 0; i < 10; i += 1) reporter.reportError(boom());
  await tick();
  eq(sent.length, 1);
});

section("Фильтры шума не доходят до сети");

await t("расширение браузера не отправляется", async () => {
  reset();
  const e = new Error("x");
  e.stack = "TypeError: x\n    at inject (chrome-extension://kkk/content.js:1:1)";
  reporter.reportError(e);
  await tick();
  eq(sent.length, 0);
});

await t("'Script error.' без стека не отправляется", async () => {
  reset();
  const e = new Error("Script error.");
  e.stack = undefined;
  reporter.reportError(e);
  await tick();
  eq(sent.length, 0);
});

await t("4xx от API молчим, 5xx репортим", async () => {
  reset();
  reporter.reportApiFailure({ method: "GET", url: "https://api.mars.uz/api/interns/x", status: 404 });
  reporter.reportApiFailure({ method: "GET", url: "https://api.mars.uz/api/interns/y", status: 401 });
  await tick();
  eq(sent.length, 0, "4xx уже лежат в серверном аудит-логе, тут они шум");

  reporter.reportApiFailure({ method: "GET", url: "https://api.mars.uz/api/interns/z", status: 500 });
  await tick();
  eq(sent.length, 1);
  eq(JSON.parse(sent[0].init.body).kind, "api-failure");
});

await t("обрыв сети помечается kind=network, а не багом", async () => {
  reset();
  reporter.reportApiFailure({
    method: "GET", url: "https://api.mars.uz/api/interns",
    error: new TypeError("Failed to fetch"),
  });
  await tick();
  eq(JSON.parse(sent[0].init.body).kind, "network");
});

section("Слушатели окна");

await t("window 'error' без event.error игнорируется (битая картинка — не баг)", async () => {
  reset();
  dispatch("error", { error: null, message: "img failed" });
  await tick();
  eq(sent.length, 0);
});

await t("unhandledrejection доезжает с правильным kind", async () => {
  reset();
  dispatch("unhandledrejection", { reason: boom() });
  await tick();
  eq(JSON.parse(sent[0].init.body).kind, "unhandled-rejection");
});

await t("reject не-Error значением не роняет репортер", async () => {
  reset();
  dispatch("unhandledrejection", { reason: "просто строка" });
  await tick();
  eq(sent.length, 1);
  ok(JSON.parse(sent[0].init.body).message.includes("просто строка"));
});

section("Мусор на входе");

await t("репортер не бросает ни на чём", async () => {
  reset();
  for (const junk of [null, undefined, 0, "", {}, [], NaN, Symbol("x")]) {
    reporter.reportError(junk);
    reporter.reportApiFailure(junk);
    reporter.addBreadcrumb(junk);
    reporter.apiBreadcrumb(junk);
  }
  reporter.reportReactError(null, null);
  await tick();
  ok(true);
});

await t("до init вызовы безопасны и ничего не шлют", async () => {
  reporter._internals.reset();
  sent = [];
  reporter.reportError(boom());
  reporter.reportApiFailure({ status: 500, url: "/x" });
  await tick();
  eq(sent.length, 0);
});

console.log(`\n${fail === 0 ? "✅" : "❌"} браузерная часть: ${pass} прошло, ${fail} упало`);
process.exit(fail ? 1 : 0);
