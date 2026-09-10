// Запуск: npm run verify:reporter (из корня проекта).
// Тест-раннера в проекте нет, поэтому это самостоятельный node-скрипт.

// Проверка репортера без браузера. Тест-раннера в проектах нет, поэтому это
// самостоятельный node-скрипт: чистая логика напрямую, браузерная часть —
// против минимального поддельного DOM.
import {
  redact, redactUrl, dropReason, resolveKind, isNetworkMessage,
  signatureOf, makeDedup, makeBreaker, makeBreadcrumbs, scrubSecretsInText,
  trimQueue, dropExhausted, buildReport,
} from "../src/utils/errorReporterCore.js";

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); pass += 1; }
  catch (e) { console.log(`  ✗ ${name}\n      ${e.message}`); fail += 1; }
};
const eq = (a, b, m = "") => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${m}\n      получили: ${A}\n      ожидали:  ${B}`);
};
const ok = (v, m) => { if (!v) throw new Error(m || "ожидали истину"); };

const section = (s) => console.log(`\n${s}`);

// ─────────────────────────────────────────────────────────────────────────────
section("Редакция секретов (сервер — вторая линия, а не первая)");

t("вырезает пароли и токены рекурсивно", () => {
  const out = redact({
    username: "ali", password: "hunter2",
    session: { accessToken: "eyJ", nested: { refreshToken: "rt" } },
    list: [{ jwt: "x" }, { ok: 1 }],
  });
  eq(out.username, "ali");
  eq(out.password, "[REDACTED]");
  eq(out.session.accessToken, "[REDACTED]");
  eq(out.session.nested.refreshToken, "[REDACTED]");
  eq(out.list, [{ jwt: "[REDACTED]" }, { ok: 1 }]);
});

t("ловит варианты написания ключа", () => {
  const out = redact({ "Refresh-Token": "a", api_key: "b", AUTHORIZATION: "c" });
  eq(Object.values(out), ["[REDACTED]", "[REDACTED]", "[REDACTED]"]);
});

t("не мутирует исходный объект", () => {
  const src = { password: "hunter2" };
  redact(src);
  eq(src.password, "hunter2");
});

t("переживает геттер, который бросает", () => {
  const evil = {};
  Object.defineProperty(evil, "boom", { get() { throw new Error("nope"); }, enumerable: true });
  evil.safe = 1;
  eq(redact(evil), { safe: 1 });
});

t("циклическая ссылка не вешает редактор", () => {
  const a = { name: "x" }; a.self = a;
  const out = redact(a);
  ok(out.name === "x");
  ok(JSON.stringify(out).includes("DEPTH_LIMIT"));
});

t("секрет вырезается ВНУТРИ строки — не только по имени ключа", () => {
  // Токен приезжает значением: в url breadcrumb'а, в тексте сообщения, в стеке.
  // Ключ там называется url/message, под перечень секретных не попадает.
  eq(redact([{ type: "api", url: "/api/x?jwt=SECRET&page=2" }]),
     [{ type: "api", url: "/api/x?jwt=[REDACTED]&page=2" }]);
  eq(scrubSecretsInText("Failed to fetch https://a.uz/cb?access_token=SECRET&x=1"),
     "Failed to fetch https://a.uz/cb?access_token=[REDACTED]&x=1");
  eq(scrubSecretsInText("Cannot read properties of undefined (reading name)"),
     "Cannot read properties of undefined (reading name)");
});

t("токен в query URL вырезается", () => {
  eq(redactUrl("https://api.uz/api/interns?token=SECRET&page=2"),
     "https://api.uz/api/interns?token=[REDACTED]&page=2");
  eq(redactUrl("https://api.uz/cb#access_token=SECRET&state=1"),
     "https://api.uz/cb#access_token=[REDACTED]&state=1");
  eq(redactUrl("https://api.uz/api/interns?page=2"),
     "https://api.uz/api/interns?page=2");
});

section("Фильтры шума (не тратим сеть пользователя на мусор)");

t("расширение браузера отбрасывается", () => {
  eq(dropReason({ message: "x", stack: "at i (chrome-extension://k/c.js:1:1)" }), "browser-extension");
  eq(dropReason({ message: "x", stack: "at i (moz-extension://k/c.js:1:1)" }), "browser-extension");
  eq(dropReason({ message: "x", source: "safari-web-extension://k/c.js" }), "browser-extension");
});

t("'Script error.' без стека — кросс-доменный шум", () => {
  eq(dropReason({ message: "Script error.", stack: null }), "cross-origin-script");
  // Со стеком — уже не шум, это настоящая ошибка.
  eq(dropReason({ message: "Script error.", stack: "at f (/src/a.js:1:1)" }), null);
});

t("пустая ошибка отбрасывается", () => {
  eq(dropReason({}), "empty");
  eq(dropReason({ message: "", stack: "" }), "empty");
});

t("нормальная ошибка проходит", () => {
  eq(dropReason({ message: "Cannot read properties of undefined", stack: "at LessonCard" }), null);
});

t("сетевой обрыв помечается отдельным kind, а не как баг", () => {
  eq(resolveKind({ kind: "api-failure", message: "Failed to fetch" }), "network");
  eq(resolveKind({ kind: "api-failure", message: "NetworkError when attempting" }), "network");
  eq(resolveKind({ kind: "react-render", message: "boom" }), "react-render");
  ok(isNetworkMessage("net::ERR_INTERNET_DISCONNECTED"));
});

section("Дедупликация");

t("тот же стек в окне не шлётся дважды", () => {
  let now = 1000;
  const d = makeDedup(10000, () => now);
  const sig = signatureOf({ app: "interns", kind: "react-render", message: "boom", stack: "at A" });
  eq(d.isDuplicate(sig), false);
  eq(d.isDuplicate(sig), true);
  now += 9000; eq(d.isDuplicate(sig), true);
  now += 2000; eq(d.isDuplicate(sig), false, "после окна должен пройти");
});

t("разные ошибки не глушат друг друга", () => {
  const d = makeDedup(10000);
  eq(d.isDuplicate(signatureOf({ message: "a", stack: "at A" })), false);
  eq(d.isDuplicate(signatureOf({ message: "b", stack: "at B" })), false);
});

t("Map не растёт бесконечно на долгой сессии", () => {
  let now = 0;
  const d = makeDedup(100, () => now);
  for (let i = 0; i < 500; i += 1) { now += 10; d.isDuplicate(`sig-${i}`); }
  ok(d.size() < 300, `размер ${d.size()} — чистка не работает`);
});

section("Circuit breaker (крэш-луп не должен долбить сеть)");

t("минутный потолок", () => {
  let now = 0;
  const b = makeBreaker({ maxPerMinute: 3, maxPerSession: 100 }, () => now);
  eq([b.allow(), b.allow(), b.allow(), b.allow()], [true, true, true, false]);
  now += 61000;
  eq(b.allow(), true, "через минуту окно должно освободиться");
});

t("сессионный потолок срабатывает окончательно", () => {
  let now = 0;
  const b = makeBreaker({ maxPerMinute: 100, maxPerSession: 3 }, () => now);
  eq([b.allow(), b.allow(), b.allow(), b.allow()], [true, true, true, false]);
  now += 10 * 60000;
  eq(b.allow(), false, "сессионный лимит не должен сбрасываться по времени");
  eq(b.state().tripped, true);
});

t("шторм в 500 ошибок пропускает единицы", () => {
  let now = 0;
  const b = makeBreaker({ maxPerMinute: 10, maxPerSession: 50 }, () => now);
  let allowed = 0;
  for (let i = 0; i < 500; i += 1) { now += 2; if (b.allow()) allowed += 1; }
  eq(allowed, 10, "за одну минуту должно пройти ровно minute-лимит");
});

section("Кольцевой буфер breadcrumbs");

t("держит последние N", () => {
  const c = makeBreadcrumbs(3);
  for (let i = 0; i < 10; i += 1) c.push({ i });
  eq(c.list(), [{ i: 7 }, { i: 8 }, { i: 9 }]);
});

section("Очередь в localStorage");

t("обрезается по количеству, выбрасывая старое", () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ report: { i } }));
  const out = trimQueue(items, { maxItems: 5, maxBytes: 1e6 });
  eq(out.length, 5);
  eq(out[0].report.i, 25, "должны остаться свежие");
});

t("обрезается по объёму", () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ report: { i, blob: "x".repeat(1000) } }));
  const out = trimQueue(items, { maxItems: 100, maxBytes: 3000 });
  ok(out.length < 10 && out.length > 0, `получили ${out.length}`);
  ok(JSON.stringify(out).length <= 3000);
});

t("исчерпавшие попытки выбрасываются", () => {
  const items = [{ attempts: 0 }, { attempts: 4 }, { attempts: 5 }, { attempts: 9 }];
  eq(dropExhausted(items, 5).length, 2);
});

t("мусор вместо очереди не роняет обрезку", () => {
  eq(trimQueue(null), []);
  eq(trimQueue(undefined), []);
  eq(trimQueue("не массив"), []);
  eq(dropExhausted(null), []);
});

section("Сборка отчёта");

t("отбракованное не превращается в отчёт", () => {
  const r = buildReport({ message: "Script error.", stack: null }, { app: "interns" });
  eq(r.report, null);
  eq(r.dropped, "cross-origin-script");
});

t("нормальный отчёт собирается под контракт сервера", () => {
  const { report } = buildReport(
    { kind: "react-render", message: "boom", stack: "at LessonCard (/a.js:1:1)",
      componentStack: "in LessonCard", context: { password: "hunter2", page: 2 } },
    { app: "interns", release: "abc1234", url: "https://x.uz/l?token=SECRET",
      user: "ali", breadcrumbs: [{ type: "api", url: "/api/x?jwt=SECRET" }] }
  );
  eq(report.app, "interns");
  eq(report.kind, "react-render");
  eq(report.release, "abc1234");
  eq(report.user, "ali");
  eq(report.context.password, "[REDACTED]");
  eq(report.context.page, 2);
  ok(report.url.includes("[REDACTED]"), "токен в url отчёта не вырезан");
  ok(!JSON.stringify(report).includes("SECRET"), "СЕКРЕТ УТЁК В ОТЧЁТ");
});

t("отсутствие стека не превращается в пустую строку", () => {
  // На этом различии стоит фильтр шума: "Script error." без стека — мусор,
  // со стеком — настоящая ошибка.
  const { report } = buildReport({ kind: "window-error", message: "boom", stack: null }, { app: "interns" });
  eq(report.stack, null);
});

t("секрет в сообщении и стеке не уезжает на сервер", () => {
  const { report } = buildReport(
    { kind: "api-failure",
      message: "GET https://api.uz/interns?token=SECRET failed",
      stack: "at f (https://api.uz/x?jwt=SECRET:1:1)" },
    { app: "admin" }
  );
  ok(!JSON.stringify(report).includes("SECRET"), "секрет в message/stack утёк");
});

t("длинные поля обрезаются", () => {
  const { report } = buildReport(
    { kind: "window-error", message: "m".repeat(5000), stack: "s".repeat(50000) },
    { app: "mentors" }
  );
  eq(report.message.length, 1000);
  eq(report.stack.length, 8000);
});

console.log(`\n${fail === 0 ? "✅" : "❌"} чистая логика: ${pass} прошло, ${fail} упало`);
process.exit(fail ? 1 : 0);
