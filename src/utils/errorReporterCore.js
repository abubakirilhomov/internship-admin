/**
 * Чистая логика репортера ошибок: фильтры шума, редакция секретов,
 * дедупликация, circuit breaker, кольцевой буфер, обрезка очереди.
 *
 * Ни одного обращения к window/localStorage/navigator — намеренно: только так
 * это можно прогнать в node без браузера, а тест-раннера в проекте нет.
 * Вся привязка к браузеру живёт в errorReporter.js.
 *
 * Файл одинаков в interns / mentors / internship-admin. Правишь в одном —
 * копируй в остальные два.
 */

export const DEFAULTS = {
  // Крэш-луп в рендере способен слать сотни ошибок в секунду. Серверный
  // лимитер его отобьёт, но клиент не должен даже пытаться.
  maxPerSession: 50,
  maxPerMinute: 10,
  // Одна и та же ошибка в пределах окна — один отчёт.
  dedupWindowMs: 10000,
  maxBreadcrumbs: 20,
  // Потолки очереди в localStorage: она не должна разнести хранилище.
  maxQueueItems: 20,
  maxQueueBytes: 64 * 1024,
  // Сколько раз пытаемся доставить один отчёт, прежде чем выбросить.
  maxAttempts: 5,
  maxMessageChars: 1000,
  maxStackChars: 8000,
  maxComponentStackChars: 4000,
};

// ─── Редакция секретов ───────────────────────────────────────────────────────
// Тот же перечень, что на сервере (int-server/src/utils/redact.js). На
// серверную редакцию не полагаемся: секрет не должен покидать браузер вообще.
const SECRET_PARTS = [
  "password", "token", "secret", "jwt", "authorization", "apikey", "auth",
];
const REDACTED = "[REDACTED]";

export const isSecretKey = (key) => {
  const k = String(key).toLowerCase().replace(/[-_\s]/g, "");
  return SECRET_PARTS.some((s) => k.includes(s));
};

export const redact = (value, depth = 0) => {
  if (depth > 8) return "[DEPTH_LIMIT]";
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out = {};
  for (const key of Object.keys(value)) {
    let v;
    try {
      v = value[key];
    } catch {
      continue; // геттер, который бросает
    }
    if (isSecretKey(key)) out[key] = REDACTED;
    else if (typeof v === "function") continue;
    else if (typeof v === "string") out[key] = scrubSecretsInText(v);
    else out[key] = redact(v, depth + 1);
  }
  return out;
};

/**
 * URL в breadcrumb легко несёт токен в query (?token=..., #access_token=...).
 * Вырезаем значения секретных параметров, оставляя сам факт вызова.
 */
/**
 * Вырезает секреты ВНУТРИ произвольной строки: `?token=abc`, `&jwt=xyz`.
 *
 * Редакции по имени ключа мало. Токен приезжает значением — в URL breadcrumb'а,
 * в тексте сообщения («Failed to fetch https://…?token=…»), в стеке. Ключ там
 * называется `url` или `message`, под перечень секретных не попадает, и без
 * этой функции секрет уходит на сервер целым.
 */
const SECRET_PARAM_RE =
  /\b(access[_-]?token|refresh[_-]?token|id[_-]?token|token|jwt|secret|password|passwd|api[_-]?key|apikey|auth|authorization|code|session)(=)([^&#\s"']+)/gi;

export const scrubSecretsInText = (text) =>
  String(text == null ? "" : text).replace(SECRET_PARAM_RE, (_, k, eq2) => `${k}${eq2}${REDACTED}`);

export const redactUrl = (url) => {
  const raw = String(url == null ? "" : url);
  if (!raw) return "";
  const scrubQuery = (qs) =>
    qs
      .split("&")
      .map((pair) => {
        const eq = pair.indexOf("=");
        if (eq === -1) return pair;
        const k = pair.slice(0, eq);
        return isSecretKey(decodeURIComponent(k)) ? `${k}=${REDACTED}` : pair;
      })
      .join("&");

  return raw
    .replace(/\?([^#]*)/, (_, qs) => `?${scrubQuery(qs)}`)
    .replace(/#(.*)$/, (_, hash) => `#${scrubQuery(hash)}`)
    .slice(0, 500);
};

// ─── Фильтры шума ────────────────────────────────────────────────────────────
const EXTENSION_RE = /(chrome|moz|safari|safari-web)-extension:\/\//;
const NETWORK_RE =
  /failed to fetch|networkerror|network request failed|load failed|the internet connection appears to be offline|net::ERR_|ERR_NETWORK|ERR_INTERNET_DISCONNECTED/i;

export const isNetworkMessage = (message) => NETWORK_RE.test(String(message || ""));

/**
 * Причина отбрасывания либо null, если отчёт нужно слать.
 *
 * Дублирует серверные фильтры сознательно: то, что заведомо мусор, не должно
 * даже уходить в сеть с телефона пользователя.
 */
export const dropReason = ({ message, stack, source } = {}) => {
  const text = `${message || ""}\n${stack || ""}\n${source || ""}`;

  if (EXTENSION_RE.test(text)) return "browser-extension";

  // "Script error." без стека — классический кросс-доменный шум: браузер
  // прячет детали ошибки чужого скрипта. Чинить в этом нечего.
  const msg = String(message || "").trim();
  if (!stack && (msg === "Script error." || msg === "Script error")) {
    return "cross-origin-script";
  }
  if (!msg && !stack) return "empty";

  return null;
};

/** Сетевой обрыв — это метрика доступности, а не баг. Помечаем отдельным kind. */
export const resolveKind = ({ kind, message }) =>
  isNetworkMessage(message) ? "network" : kind;

// ─── Дедупликация ────────────────────────────────────────────────────────────
export const signatureOf = ({ app, kind, message, stack } = {}) => {
  // Первые две строки стека достаточно специфичны, а хвост шумит.
  const head = String(stack || "").split("\n").slice(0, 3).join("|");
  return `${app}|${kind}|${String(message || "").slice(0, 200)}|${head}`;
};

export const makeDedup = (windowMs = DEFAULTS.dedupWindowMs, now = () => Date.now()) => {
  const seen = new Map();
  return {
    /** true — этот отчёт уже слали недавно, слать не надо. */
    isDuplicate(signature) {
      const t = now();
      const prev = seen.get(signature);
      if (prev !== undefined && t - prev < windowMs) return true;
      seen.set(signature, t);
      // Чистим протухшее, чтобы Map не рос вечно на долгой сессии.
      if (seen.size > 200) {
        for (const [k, v] of seen) if (t - v >= windowMs) seen.delete(k);
      }
      return false;
    },
    size: () => seen.size,
  };
};

// ─── Circuit breaker ─────────────────────────────────────────────────────────
export const makeBreaker = (opts = {}, now = () => Date.now()) => {
  const maxPerSession = opts.maxPerSession ?? DEFAULTS.maxPerSession;
  const maxPerMinute = opts.maxPerMinute ?? DEFAULTS.maxPerMinute;

  let session = 0;
  let recent = [];
  let tripped = false;

  return {
    /** Разрешено ли отправлять ещё один отчёт. */
    allow() {
      if (tripped) return false;
      const t = now();
      recent = recent.filter((ts) => t - ts < 60000);

      if (session >= maxPerSession) {
        // Лимит сессии — окончательный: дальше молчим до перезагрузки страницы.
        tripped = true;
        return false;
      }
      if (recent.length >= maxPerMinute) return false;

      session += 1;
      recent.push(t);
      return true;
    },
    state: () => ({ session, lastMinute: recent.length, tripped }),
  };
};

// ─── Кольцевой буфер breadcrumbs ─────────────────────────────────────────────
export const makeBreadcrumbs = (max = DEFAULTS.maxBreadcrumbs) => {
  let items = [];
  return {
    push(crumb) {
      items.push(crumb);
      if (items.length > max) items = items.slice(-max);
    },
    list: () => items.slice(),
    clear() {
      items = [];
    },
  };
};

// ─── Очередь отчётов ─────────────────────────────────────────────────────────
/**
 * Обрезает очередь под потолки: сначала по количеству, потом по объёму.
 * Выбрасываем СТАРЫЕ — свежая ошибка ценнее позавчерашней.
 */
export const trimQueue = (items, opts = {}) => {
  const maxItems = opts.maxItems ?? DEFAULTS.maxQueueItems;
  const maxBytes = opts.maxBytes ?? DEFAULTS.maxQueueBytes;

  let out = Array.isArray(items) ? items.slice(-maxItems) : [];
  while (out.length > 0) {
    let size;
    try {
      size = JSON.stringify(out).length;
    } catch {
      return [];
    }
    if (size <= maxBytes) break;
    out = out.slice(1);
  }
  return out;
};

/** Отчёты, которые пора выбросить: слишком много неудачных попыток. */
export const dropExhausted = (items, maxAttempts = DEFAULTS.maxAttempts) =>
  (items || []).filter((it) => (it.attempts || 0) < maxAttempts);

// ─── Сборка отчёта ───────────────────────────────────────────────────────────
const clip = (v, n) => (v == null ? null : String(v).slice(0, n));
// scrubSecretsInText превращает null в "", а отсутствие стека и пустой стек —
// разные вещи (на них завязан фильтр шума). Сохраняем null.
const scrubOrNull = (v) => (v == null ? null : scrubSecretsInText(v));

/**
 * Приводит сырые данные к телу, которое ждёт POST /api/error-reports.
 * Возвращает null, если отчёт отбракован фильтром шума.
 */
export const buildReport = (input, ctx = {}) => {
  const reason = dropReason(input);
  if (reason) return { dropped: reason, report: null };

  const kind = resolveKind(input);

  return {
    dropped: null,
    report: {
      app: ctx.app,
      kind,
      message: clip(scrubOrNull(input.message), DEFAULTS.maxMessageChars) || "",
      stack: clip(scrubOrNull(input.stack), DEFAULTS.maxStackChars),
      componentStack: clip(input.componentStack, DEFAULTS.maxComponentStackChars),
      release: ctx.release || null,
      url: redactUrl(ctx.url),
      // Со слов клиента — сервер положит это в actor.identifier, не в name.
      user: clip(ctx.user, 120),
      breadcrumbs: redact(ctx.breadcrumbs || []),
      context: redact(input.context || null),
    },
  };
};
