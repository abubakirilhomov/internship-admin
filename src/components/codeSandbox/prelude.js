// Код, который выполняется ПЕРВЫМ внутри песочницы, до кода кандидата.
// Вставляется в srcdoc как `(${sandboxPrelude})(cfg)` — поэтому функция должна
// быть самодостаточной: никаких импортов и замыканий на модуль.
//
// Что делает:
//  • console.* / ошибки / отклонённые промисы → postMessage в панель консоли;
//  • alert / confirm / prompt → строка в консоли (модальные окна в sandbox
//    без allow-modals всё равно заблокированы);
//  • сторож циклов (см. protectLoops.js): синхронный код дольше cfg.limitMs → ошибка;
//  • WebRTC закрыт заглушками: CSP его не режет, а STUN-запрос — это выход в сеть;
//  • уход документа на другой адрес отменяется (главная защита — frame-src 'none'
//    у родительской страницы, это второй слой);
//  • нарушения CSP (картинка из сети, fetch…) → предупреждение в консоли.
//
// Всё, что приходит отсюда, родитель считает недоверенным: код кандидата может
// сам слать любые сообщения. Родитель выводит их только как текст.
export function sandboxPrelude(cfg) {
  var parentWin = window.parent;
  var MAX_MESSAGES = 300;
  var MAX_TEXT = 4000;
  var sent = 0;
  var dropped = 0;
  var offset = cfg.lineOffset || 0;
  var micro = typeof queueMicrotask === "function" ? queueMicrotask : function (f) { Promise.resolve().then(f); };
  var now = typeof performance !== "undefined" && performance.now ? function () { return performance.now(); } : Date.now;

  function send(msg) {
    msg.__sbx = cfg.runId;
    try { parentWin.postMessage(msg, "*"); } catch { /* родителя нет */ }
  }

  function quote(s) { return "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n") + "'"; }

  function nodeLabel(n) {
    if (n.nodeType === 3) return "#text " + quote((n.textContent || "").slice(0, 40));
    if (n.nodeType === 9) return "#document";
    if (n.nodeType !== 1) return "#node";
    var s = "<" + n.tagName.toLowerCase();
    if (n.id) s += "#" + n.id;
    if (typeof n.className === "string" && n.className.trim()) s += "." + n.className.trim().split(/\s+/).join(".");
    return s + ">";
  }

  function fmt(v, depth, seen) {
    var t = typeof v;
    if (v === null) return "null";
    if (t === "undefined") return "undefined";
    if (t === "string") return depth === 0 ? v : quote(v);
    if (t === "number") return Object.is(v, -0) ? "-0" : String(v);
    if (t === "bigint") return String(v) + "n";
    if (t === "boolean") return String(v);
    if (t === "symbol") return v.toString();
    if (t === "function") return "ƒ " + (v.name || "anonymous") + "()";
    try {
      if (v instanceof Error) return (v.name || "Error") + ": " + v.message;
      if (typeof Node !== "undefined" && v instanceof Node) return nodeLabel(v);
      if (v === window) return "Window";
      if (seen.indexOf(v) >= 0) return "[Circular]";
      if (v instanceof Date) return isNaN(v) ? "Invalid Date" : v.toISOString();
      if (v instanceof RegExp) return String(v);
      if (typeof Promise !== "undefined" && v instanceof Promise) return "Promise {…}";
      var isArr = Array.isArray(v);
      if (depth >= 3) return isArr ? "[…]" : "{…}";
      var next = seen.concat([v]);
      var parts = [];
      var more = 0;
      if (isArr) {
        for (var i = 0; i < v.length; i++) {
          if (i >= 100) { more = v.length - 100; break; }
          parts.push(fmt(v[i], depth + 1, next));
        }
        return "[" + parts.join(", ") + (more ? ", … +" + more : "") + "]";
      }
      if (v instanceof Map) {
        v.forEach(function (val, key) { if (parts.length < 50) parts.push(fmt(key, depth + 1, next) + " => " + fmt(val, depth + 1, next)); });
        return "Map(" + v.size + ") {" + parts.join(", ") + "}";
      }
      if (v instanceof Set) {
        v.forEach(function (val) { if (parts.length < 50) parts.push(fmt(val, depth + 1, next)); });
        return "Set(" + v.size + ") {" + parts.join(", ") + "}";
      }
      var keys = Object.keys(v);
      for (var k = 0; k < keys.length; k++) {
        if (k >= 50) { more = keys.length - 50; break; }
        var val;
        try { val = fmt(v[keys[k]], depth + 1, next); } catch { val = "[?]"; }
        parts.push((/^[A-Za-z_$][\w$]*$/.test(keys[k]) ? keys[k] : quote(keys[k])) + ": " + val);
      }
      var proto = Object.getPrototypeOf(v);
      var name = proto && proto !== Object.prototype && proto.constructor && proto.constructor.name ? proto.constructor.name + " " : "";
      return name + "{" + parts.join(", ") + (more ? ", … +" + more : "") + "}";
    } catch {
      return "[?]";
    }
  }

  // console.log("%s = %d", a, b) — основные подстановки, как в браузере.
  function format(args) {
    var list = Array.prototype.slice.call(args);
    var out = [];
    if (typeof list[0] === "string" && list[0].indexOf("%") >= 0) {
      var first = list.shift();
      first = first.replace(/%([sdifoOc%])/g, function (m, f) {
        if (f === "%") return "%";
        if (!list.length) return m;
        var a = list.shift();
        if (f === "c") return "";
        if (f === "s") return typeof a === "string" ? a : fmt(a, 1, []);
        if (f === "d" || f === "i") return String(parseInt(a, 10));
        if (f === "f") return String(parseFloat(a));
        return fmt(a, 1, []);
      });
      out.push(first);
    }
    for (var i = 0; i < list.length; i++) out.push(fmt(list[i], 0, []));
    return out.join(" ");
  }

  function emit(level, text) {
    if (sent >= MAX_MESSAGES) {
      dropped += 1;
      if (dropped === 1) send({ type: "log", level: "warn", text: cfg.t.tooMany });
      return;
    }
    sent += 1;
    var s = String(text);
    send({ type: "log", level: level, text: s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) + " …" : s });
  }

  var c = window.console || {};
  var counts = {};
  var timers = {};
  var bind = function (level) { return function () { emit(level, format(arguments)); }; };
  c.log = bind("log");
  c.info = bind("info");
  c.debug = bind("log");
  c.warn = bind("warn");
  c.error = bind("error");
  c.table = bind("log");
  c.dir = bind("log");
  c.trace = bind("log");
  c.assert = function (cond) {
    if (cond) return;
    var rest = Array.prototype.slice.call(arguments, 1);
    emit("error", "Assertion failed" + (rest.length ? ": " + format(rest) : ""));
  };
  c.clear = function () { send({ type: "clear" }); };
  c.count = function (label) { label = label === undefined ? "default" : String(label); counts[label] = (counts[label] || 0) + 1; emit("log", label + ": " + counts[label]); };
  c.countReset = function (label) { counts[label === undefined ? "default" : String(label)] = 0; };
  c.time = function (label) { timers[label === undefined ? "default" : String(label)] = now(); };
  c.timeEnd = function (label) {
    label = label === undefined ? "default" : String(label);
    if (timers[label] === undefined) return;
    emit("log", label + ": " + (now() - timers[label]).toFixed(1) + " ms");
    delete timers[label];
  };
  c.timeLog = function (label) {
    label = label === undefined ? "default" : String(label);
    if (timers[label] !== undefined) emit("log", label + ": " + (now() - timers[label]).toFixed(1) + " ms");
  };
  window.console = c;

  window.addEventListener("error", function (e) {
    // Строка внутри служебной шапки (например, ошибка сторожа циклов) — без номера.
    var line = e.lineno > offset ? e.lineno - offset : 0;
    send({ type: "error", text: e.message || String(e.error), line: line, col: e.colno || 0 });
  });
  window.addEventListener("unhandledrejection", function (e) {
    emit("error", "Uncaught (in promise) " + fmt(e.reason, 0, []));
  });

  window.alert = function (m) { emit("info", "alert: " + (m === undefined ? "" : String(m))); };
  window.confirm = function (m) { emit("info", "confirm: " + (m === undefined ? "" : String(m)) + " → false"); return false; };
  window.prompt = function (m) { emit("info", "prompt: " + (m === undefined ? "" : String(m)) + " → null"); return null; };

  ["RTCPeerConnection", "webkitRTCPeerConnection", "RTCDataChannel", "RTCSessionDescription", "RTCIceCandidate"].forEach(function (name) {
    var blocked = function () { throw new Error(name + ": " + cfg.t.rtc); };
    try { Object.defineProperty(window, name, { value: blocked, writable: false, configurable: false }); } catch { /* нет такого */ }
  });

  // Сторож циклов: один бюджет на синхронный прогон (сбрасывается микрозадачей,
  // когда стек пуст). Сработав однажды, бросает всегда — чтобы внешний цикл с
  // try/catch не продолжал крутиться.
  var tripped = false;
  var armed = false;
  var started = 0;
  var ticks = 0;
  var limit = cfg.limitMs || 2000;
  var loopError = function () { return new RangeError(cfg.t.loop.replace("{s}", String(Math.round(limit / 1000)))); };
  var guard = function () {
    if (tripped) throw loopError();
    if (!armed) {
      armed = true;
      started = now();
      ticks = 0;
      micro(function () { armed = false; });
    }
    ticks += 1;
    if ((ticks & 1023) === 0 && now() - started > limit) {
      tripped = true;
      throw loopError();
    }
  };
  Object.defineProperty(window, cfg.guard, { value: guard, writable: false, configurable: false, enumerable: false });

  if (window.navigation && window.navigation.addEventListener) {
    window.navigation.addEventListener("navigate", function (e) {
      if (e.cancelable && !(e.destination && e.destination.sameDocument)) {
        e.preventDefault();
        emit("warn", cfg.t.nav);
      }
    });
  }

  var seenCsp = {};
  document.addEventListener("securitypolicyviolation", function (e) {
    var what = (e.blockedURI || e.violatedDirective || "").slice(0, 200);
    if (seenCsp[what]) return;
    seenCsp[what] = true;
    emit("warn", cfg.t.net + ": " + what);
  });

  send({ type: "ready" });
}
