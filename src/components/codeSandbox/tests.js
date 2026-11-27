// Автотесты мини-заданий (этап 6): «Прогнать у себя». Тесты выполняются ТОЛЬКО здесь,
// в браузере, в той же песочнице-iframe, что и превью (runner.js: sandbox без
// allow-same-origin, CSP без сети, сторож циклов). Сервер код кандидата и тестов не
// запускает. Результат — подсказка: оценку ставит интервьюер.
//
// ⚠ Файл — часть ядра песочницы: ОДИН И ТОТ ЖЕ код в candidates/src/lib/sandbox и
// internship-admin/src/components/codeSandbox (хеш в sync.test.js обоих репозиториев).
//
// Формат теста — { name, code }: code — тело async-функции с параметрами
//   (assert, sleep, logs, vars)
//   assert.ok / equal / deepEqual / throws / rejects / fail;  assert.lang — "uz" | "ru"
//   sleep(ms)
//   logs  — всё, что код кандидата вывел через console.log/info/warn/error (массивы аргументов)
//   vars() — значения верхнеуровневых имён из кода кандидата: { summary: {...} }
// Функции кандидата доступны по имени (глобальная область) — как у обычных <script>.
//
// Порядок документа: prelude (консоль, CSP, сторож) → «пред-скрипт» (запись console.log,
// ошибок, канал отчёта) → код кандидата → vars → по <script> на каждый тест → runner.
// Пред-скрипт, тесты и runner удаляют свои <script> сразу после запуска: код кандидата
// не прочитает ни одноразовый ключ отчёта, ни текст тестов из DOM. Отчёт принимается
// родителем только с этим ключом — подделать «пройдено 5 из 5» из кода кандидата нельзя
// (но это подсказка, а не защита от злого умысла: решает интервьюер).
import { GUARD, protectLoops } from "./protectLoops.js";
import { SANDBOX, LIMIT_MS, head, escapeScript, protectHtmlScripts, safeJson } from "./runner.js";

export const MAX_TESTS = 12;
// Канал внутри iframe (недоступное для записи свойство window). Защита отчёта — не в имени,
// а в одноразовом ключе (nonce), который знает только родитель и runner.
export const CHANNEL = "__marsTests";
export const PER_TEST_MS = 2500;
export const MAX_NAMES = 80;

const TEXTS = {
  uz: {
    expected: "kutilgan", got: "olingan", timeout: "{s} soniyada tugamadi", broken: "test kodida xato (interv'yuerga ayting)",
    notThrow: "xato kutilgan edi, lekin tashlanmadi", notReject: "rad etilgan promis kutilgan edi", fail: "muvaffaqiyatsiz",
    notOk: "to'g'ri (truthy) qiymat kutilgan edi", loop: "Sikl {s} soniyadan uzoq ishladi — to'xtatildi",
  },
  ru: {
    expected: "ожидалось", got: "получено", timeout: "не завершилось за {s} с", broken: "ошибка в коде теста (скажите интервьюеру)",
    notThrow: "ожидалась ошибка, но её не было", notReject: "ожидался отклонённый промис", fail: "не пройдено",
    notOk: "ожидалось истинное значение", loop: "Цикл работает дольше {s} с — остановлен",
  },
};

const RESERVED = new Set(("break case catch class const continue debugger default delete do else enum export extends false " +
  "finally for function if import in instanceof new null return super switch this throw true try typeof var void while with " +
  "yield let static await async of undefined NaN Infinity arguments eval window document self top parent").split(" "));

// Верхнеуровневые имена из кода кандидата (const/let/var/function/class): по ним vars()
// пробует прочитать значения. Локальные имена внутри функций просто не найдутся (undefined).
export function declaredNames(code) {
  const names = [];
  const re = /\b(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  const src = String(code ?? "");
  while ((m = re.exec(src)) && names.length < MAX_NAMES) {
    if (!RESERVED.has(m[1]) && !names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

// ── код, который выполняется внутри iframe (самодостаточные функции: toString) ──

// Пред-скрипт: ДО кода кандидата. Захватывает postMessage родителя, пишет логи и ошибки.
function preMain(cfg) {
  var parentWin = window.parent;
  var post = parentWin.postMessage.bind(parentWin);
  var logs = [];
  var errors = [];
  var c = window.console;
  ["log", "info", "warn", "error", "debug"].forEach(function (level) {
    var orig = c[level];
    c[level] = function () {
      if (logs.length < 500) logs.push(Array.prototype.slice.call(arguments));
      return orig.apply(c, arguments);
    };
  });
  window.addEventListener("error", function (e) {
    if (errors.length < 3) errors.push(String(e.message || e.error || "error").slice(0, 300));
  });
  // Таймеры runner'а — оригинальные: тест может подменить window.setTimeout (мгновенные паузы).
  var api = {
    st: window.setTimeout.bind(window),
    ct: window.clearTimeout.bind(window),
    logs: logs,
    errors: errors,
    fns: [],
    vars: function () { return {}; },
    add: function (i, fn) { api.fns[i] = fn; },
    report: function (results, nonce) {
      post({ __sbx: cfg.runId, type: "tests", nonce: nonce, results: results, error: errors[0] || "" }, "*");
    },
  };
  Object.defineProperty(window, cfg.name, { value: api, writable: false, configurable: false, enumerable: false });
  var me = document.currentScript;
  if (me && me.parentNode) me.parentNode.removeChild(me);
}

// Runner: ПОСЛЕ всех тестов; стартует на load. Ключ отчёта — только здесь.
function runnerMain(cfg) {
  var me = document.currentScript;
  if (me && me.parentNode) me.parentNode.removeChild(me);
  var api = window[cfg.name];
  var T = cfg.t;
  var started = false;

  function show(v) {
    var t = typeof v;
    if (v === undefined) return "undefined";
    if (t === "string") return JSON.stringify(v.length > 120 ? v.slice(0, 120) + "…" : v);
    if (t === "function") return "ƒ " + (v.name || "anonymous");
    if (t === "bigint") return String(v) + "n";
    if (t === "symbol") return v.toString();
    if (t === "number") return Object.is(v, -0) ? "-0" : String(v);
    try {
      var seen = [];
      var s = JSON.stringify(v, function (k, x) {
        if (typeof x === "function") return "ƒ";
        if (typeof x === "undefined") return "undefined";
        if (x instanceof Error) return x.name + ": " + x.message;
        if (x instanceof Map) return "Map" + JSON.stringify(Array.from(x));
        if (x instanceof Set) return "Set" + JSON.stringify(Array.from(x));
        if (x && typeof x === "object") { if (seen.indexOf(x) >= 0) return "[Circular]"; seen.push(x); }
        return x;
      });
      if (s === undefined) return String(v);
      return s.length > 160 ? s.slice(0, 160) + "…" : s;
    } catch { return "[?]"; }
  }

  function deepEq(a, b, depth) {
    if (a === b || (a !== a && b !== b)) return true;
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null || depth > 20) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && +a === +b;
    if (a instanceof Map || b instanceof Map) {
      if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) return false;
      var ok = true;
      a.forEach(function (v, k) { if (!b.has(k) || !deepEq(v, b.get(k), depth + 1)) ok = false; });
      return ok;
    }
    if (a instanceof Set || b instanceof Set) {
      if (!(a instanceof Set && b instanceof Set) || a.size !== b.size) return false;
      var same = true;
      a.forEach(function (v) { if (!b.has(v)) same = false; });
      return same;
    }
    var ka = Object.keys(a);
    var kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[i]) || !deepEq(a[ka[i]], b[ka[i]], depth + 1)) return false;
    }
    return true;
  }

  function fail(msg) { var e = new Error(msg); e.__assert = true; return e; }
  function withNote(note, text) { return note ? note + ": " + text : text; }
  var assert = {
    ok: function (v, note) { if (!v) throw fail(withNote(note, T.notOk + ", " + T.got + ": " + show(v))); },
    equal: function (actual, expected, note) {
      if (!(actual === expected || (actual !== actual && expected !== expected))) {
        throw fail(withNote(note, T.expected + ": " + show(expected) + ", " + T.got + ": " + show(actual)));
      }
    },
    deepEqual: function (actual, expected, note) {
      if (!deepEq(actual, expected, 0)) throw fail(withNote(note, T.expected + ": " + show(expected) + ", " + T.got + ": " + show(actual)));
    },
    throws: function (fn, note) {
      var threw = false;
      try { fn(); } catch { threw = true; }
      if (!threw) throw fail(withNote(note, T.notThrow));
    },
    rejects: function (p, note) {
      var promise;
      try { promise = Promise.resolve(typeof p === "function" ? p() : p); } catch { return Promise.resolve(); }
      return promise.then(function (v) { throw fail(withNote(note, T.notReject + ", " + T.got + ": " + show(v))); }, function () {});
    },
    fail: function (note) { throw fail(note || T.fail); },
  };
  assert.lang = cfg.lang; // "uz" | "ru": сообщения теста на языке кандидата
  var sleep = function (ms) { return new Promise(function (r) { api.st(r, Math.min(Number(ms) || 0, 2000)); }); };

  function messageOf(e) {
    if (e && e.__assert) return e.message;
    var s = e && e.name ? e.name + ": " + (e.message || "") : String(e);
    return s.length > 300 ? s.slice(0, 300) + "…" : s;
  }

  function runOne(i) {
    var fn = api.fns[i];
    if (typeof fn !== "function") return Promise.resolve({ ok: false, message: T.broken });
    var timer;
    var timeout = new Promise(function (_, rej) {
      timer = api.st(function () { rej(new Error(T.timeout.replace("{s}", String(cfg.perTestMs / 1000)))); }, cfg.perTestMs);
    });
    var work;
    try { work = Promise.resolve(fn(assert, sleep, api.logs, api.vars)); } catch (e) { work = Promise.reject(e); }
    return Promise.race([work, timeout]).then(
      function () { api.ct(timer); return { ok: true, message: "" }; },
      function (e) { api.ct(timer); return { ok: false, message: messageOf(e) }; }
    );
  }

  function runAll() {
    var results = [];
    var chain = Promise.resolve();
    for (var i = 0; i < cfg.total; i++) {
      (function (idx) {
        chain = chain.then(function () { return runOne(idx); }).then(function (r) { results.push(r); });
      })(i);
    }
    return chain.then(function () { return results; });
  }

  function start() {
    if (started) return;
    started = true;
    runAll().then(function (results) { api.report(results, cfg.nonce); });
  }
  if (document.readyState === "complete") api.st(start, 0);
  else window.addEventListener("load", function () { api.st(start, 0); });
}

// Свой <script> удаляется сразу после запуска (IIFE: глобальных имён не добавляем —
// иначе «var s» столкнулся бы с «const s» из кода кандидата).
const SELF_REMOVE = "(function(){var s=document.currentScript;if(s&&s.parentNode)s.parentNode.removeChild(s);})();";

const inline = (fn, cfg) => `(${fn.toString()})(${safeJson(cfg)});`;

// vars(): имя → значение или undefined (нет такого имени / TDZ).
function varsScript(name, names) {
  const body = names
    .map((n) => `try { o[${JSON.stringify(n)}] = typeof ${n} === "undefined" ? undefined : ${n}; } catch (e) {}`)
    .join("\n");
  return `window[${JSON.stringify(name)}].vars = function () { var o = {};\n${body}\nreturn o; };` +
    SELF_REMOVE;
}

function testScript(name, i, test) {
  return `<script>window[${JSON.stringify(name)}].add(${i}, async function (assert, sleep, logs, vars) {\n` +
    `${escapeScript(String(test.code ?? ""))}\n});${SELF_REMOVE}</script>`;
}

/**
 * Документ для iframe srcdoc: код кандидата + тесты.
 * @param editor  "web" — HTML-документ кандидата; "js" — чистый JS
 * @param tests   [{ name, code }]
 * @param nonce   одноразовый ключ отчёта (знает только родитель и runner)
 */
export function buildTestDoc({ editor, code = "", tests = [], runId = "test", nonce = "", lang = "uz", limitMs = LIMIT_MS } = {}) {
  const list = (tests || []).slice(0, MAX_TESTS);
  const t = TEXTS[lang] || TEXTS.uz;
  const name = CHANNEL;
  const baseCfg = { runId: String(runId), guard: GUARD, limitMs, lineOffset: 0, t: {
    tooMany: "…", rtc: "—", loop: t.loop, nav: "—", net: "—",
  } };
  const src = String(code ?? "");
  const names = declaredNames(src);
  const pre = `<script>${inline(preMain, { runId: String(runId), name })}</script>`;
  const vars = `<script>${varsScript(name, names)}</script>`;
  const tail = list.map((tst, i) => testScript(name, i, tst)).join("") +
    `<script>${inline(runnerMain, { name, nonce: String(nonce), total: list.length, perTestMs: PER_TEST_MS, t, lang: lang === "ru" ? "ru" : "uz" })}</script>`;
  if (editor === "js") {
    return `<!doctype html><html><head>${head(baseCfg)}</head><body>${pre}<script>\n${escapeScript(protectLoops(src))}\n</script>${vars}${tail}</body></html>`;
  }
  const doctype = /^\s*<!doctype[^>]*>/i.exec(src);
  const rest = doctype ? src.slice(doctype[0].length) : src;
  return `<!doctype html>${head(baseCfg)}${pre}${protectHtmlScripts(rest)}${vars}${tail}`;
}

export { TESTABLE, canTest } from "./testable.js";

const randomNonce = () => {
  const a = new Uint8Array(12);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
};

let seq = 0;

/**
 * Прогон в скрытом iframe-песочнице. Возвращает
 * { passed, total, results: [{ name, ok, message }], error, timedOut }.
 * Сообщения принимаются только от своего iframe, только текущего прогона и с ключом.
 */
export function runTests({ tests, editor, code, lang = "uz", timeoutMs, parent = globalThis.document?.body } = {}) {
  const list = (tests || []).slice(0, MAX_TESTS);
  return new Promise((resolve) => {
    if (!list.length || !parent) return resolve({ passed: 0, total: list.length, results: [], error: "", timedOut: false });
    const runId = `t${Date.now().toString(36)}-${(seq += 1)}`;
    const nonce = randomNonce();
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", SANDBOX);
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.referrerPolicy = "no-referrer";
    frame.title = "tests";
    frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1024px;height:768px;border:0;opacity:0;pointer-events:none";
    let timer;
    const finish = (out) => {
      clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      frame.remove();
      resolve(out);
    };
    const onMsg = (e) => {
      const d = e.data;
      if (e.source !== frame.contentWindow || !d || typeof d !== "object") return;
      if (d.__sbx !== runId || d.type !== "tests" || d.nonce !== nonce || !Array.isArray(d.results)) return;
      const results = list.map((tst, i) => {
        const r = d.results[i];
        return { name: String(tst.name ?? ""), ok: r?.ok === true, message: r?.ok === true ? "" : String(r?.message ?? "").slice(0, 500) };
      });
      finish({ passed: results.filter((r) => r.ok).length, total: list.length, results, error: String(d.error ?? "").slice(0, 300), timedOut: false });
    };
    window.addEventListener("message", onMsg);
    timer = setTimeout(() => {
      finish({ passed: 0, total: list.length, results: list.map((tst) => ({ name: String(tst.name ?? ""), ok: false, message: "" })), error: "", timedOut: true });
    }, timeoutMs || 5000 + list.length * (PER_TEST_MS + 500));
    frame.srcdoc = buildTestDoc({ editor, code, tests: list, runId, nonce, lang });
    parent.appendChild(frame);
  });
}
