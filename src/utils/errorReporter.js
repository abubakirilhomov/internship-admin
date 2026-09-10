/**
 * Отлов ошибок в браузере и отправка на POST /api/error-reports.
 *
 * Чистая логика (фильтры, дедуп, breaker, редакция) вынесена в
 * errorReporterCore.js и проверяется в node. Здесь — только привязка к
 * браузеру: слушатели, отправка, очередь в localStorage.
 *
 * Файл одинаков в interns / mentors / internship-admin. Правишь в одном —
 * копируй в остальные два.
 *
 * ГЛАВНОЕ ПРАВИЛО: репортер не имеет права ни упасть, ни зациклиться.
 *  • всё наружное завёрнуто в safe();
 *  • пока мы внутри репортера, флаг `busy` глушит собственные ошибки;
 *  • сбои доставки НЕ репортятся — только тихо кладутся в очередь;
 *  • на console не полагаемся нигде: в interns прод-сборка вырезает console.*
 *    целиком (vite.config.js → esbuild.drop).
 *
 * Приёмника может не быть вовсе (эндпоинт живёт в отдельной ветке бэкенда).
 * 404/503 обязаны переживаться молча — отчёт уходит в очередь и ждёт.
 */
import {
  DEFAULTS,
  buildReport,
  signatureOf,
  makeDedup,
  makeBreaker,
  makeBreadcrumbs,
  trimQueue,
  dropExhausted,
  redactUrl,
} from "./errorReporterCore.js";

const QUEUE_KEY = "errorReporter.queue.v1";
const INGEST_PATH = "/error-reports";

let config = null;
let breaker = null;
let dedup = null;
let crumbs = makeBreadcrumbs(DEFAULTS.maxBreadcrumbs);
let busy = false;
let started = false;

/** Любая наружная функция репортера проходит через это. Никогда не бросает. */
const safe = (fn) => (...args) => {
  if (busy) return undefined; // защита от рекурсии: ошибка внутри репортера
  busy = true;
  try {
    return fn(...args);
  } catch {
    return undefined; // молча: сообщать об этом некому и незачем
  } finally {
    busy = false;
  }
};

const enabled = () => config !== null && config.enabled;

// ─── Очередь в localStorage ──────────────────────────────────────────────────
const readQueue = () => {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (items) => {
  try {
    const trimmed = trimQueue(items, {
      maxItems: config.maxQueueItems,
      maxBytes: config.maxQueueBytes,
    });
    if (trimmed.length === 0) window.localStorage.removeItem(QUEUE_KEY);
    else window.localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  } catch {
    // Переполненное или недоступное хранилище (приватный режим Safari) —
    // не повод ломать страницу. Отчёт просто теряется.
    try {
      window.localStorage.removeItem(QUEUE_KEY);
    } catch { /* и это может не сработать */ }
  }
};

const enqueue = (report) => {
  const items = readQueue();
  items.push({ report, attempts: 0, at: Date.now() });
  writeQueue(items);
};

// ─── Отправка ────────────────────────────────────────────────────────────────
/**
 * true — доставлено. false — нет (сеть, 404, 503, что угодно).
 *
 * Никогда не бросает и никогда не репортит собственный сбой: отчёт об
 * упавшей отправке отчёта — это петля.
 */
const deliver = async (body) => {
  const url = `${config.endpoint}${INGEST_PATH}`;
  const json = JSON.stringify(body);

  // Основной путь — fetch с keepalive: он переживает закрытие вкладки, умеет
  // CORS и позволяет приложить токен для подтверждённой атрибуции.
  // sendBeacon ничего из этого не умеет, поэтому он только запасной.
  if (typeof window.fetch === "function") {
    try {
      const token = config.getToken ? config.getToken() : null;
      const res = await window.fetch(url, {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: json,
      });
      return res.ok;
    } catch {
      return false; // сеть, CORS, приёмника нет — разницы никакой
    }
  }

  // Запасной путь для браузеров без fetch(keepalive) — прежде всего Firefox
  // до 121. text/plain выбран сознательно: это «простой» content-type, он не
  // вызывает preflight, которого sendBeacon не переживает.
  // ВАЖНО: приёмник сейчас парсит только application/json, поэтому доставка
  // этим путём пока не сработает. Потери нет — отчёт остаётся в очереди и
  // уйдёт через fetch при следующей загрузке страницы.
  try {
    if (typeof window.navigator?.sendBeacon !== "function") return false;
    const blob = new window.Blob([json], { type: "text/plain;charset=UTF-8" });
    return window.navigator.sendBeacon(url, blob);
  } catch {
    return false;
  }
};

/** Пытается отправить накопленное. Всё, что не ушло, остаётся в очереди. */
const drainQueue = async () => {
  if (!enabled()) return;
  let items = dropExhausted(readQueue(), config.maxAttempts);
  if (items.length === 0) {
    writeQueue(items);
    return;
  }

  // Одним запросом — приёмник принимает пачку.
  const batch = items.slice(0, config.maxQueueItems);
  const ok = await deliver({ events: batch.map((i) => i.report) });

  if (ok) {
    writeQueue(items.slice(batch.length));
  } else {
    items = items.map((i) => ({ ...i, attempts: (i.attempts || 0) + 1 }));
    writeQueue(dropExhausted(items, config.maxAttempts));
  }
};

// ─── Приём ошибки ────────────────────────────────────────────────────────────
const submit = (input) => {
  if (!enabled()) return;

  const { report, dropped } = buildReport(input, {
    app: config.app,
    release: config.release,
    url: typeof window !== "undefined" ? window.location.href : null,
    user: config.getUser ? config.getUser() : null,
    breadcrumbs: crumbs.list(),
  });
  if (dropped || !report) return;

  if (dedup.isDuplicate(signatureOf(report))) return;
  if (!breaker.allow()) return;

  // Не ждём ответа: падение страницы не должно упираться в сеть.
  deliver(report).then((ok) => {
    if (!ok) {
      try {
        enqueue(report);
      } catch { /* очередь недоступна — отчёт теряется, и это лучше исключения */ }
    }
  });
};

// ─── Публичные точки входа ───────────────────────────────────────────────────
export const reportError = safe((error, extra = {}) => {
  const err = error instanceof Error ? error : new Error(String(error));
  submit({
    kind: extra.kind || "window-error",
    message: err.message,
    stack: err.stack,
    componentStack: extra.componentStack || null,
    context: extra.context || null,
  });
});

/** Зовётся из componentDidCatch трёх ErrorBoundary. */
export const reportReactError = safe((error, componentStack, context = null) => {
  const err = error instanceof Error ? error : new Error(String(error));
  submit({
    kind: "react-render",
    message: err.message,
    stack: err.stack,
    componentStack,
    context,
  });
});

/**
 * Зовётся HTTP-слоем приложения.
 *
 * Сообщаем только про сетевые обрывы и 5xx. 4xx сознательно молчим: они уже
 * лежат в серверном аудит-логе с полным контекстом, который клиенту недоступен,
 * а 401 при протухшем токене — вообще штатная работа.
 */
export const reportApiFailure = safe(({ method, url, status, error }) => {
  if (isIngestUrl(url)) return; // сбой доставки отчёта не репортим — это петля

  if (status && status < 500) return;

  const safeUrl = redactUrl(url);
  if (status >= 500) {
    submit({
      kind: "api-failure",
      message: `HTTP ${status} ${method || "GET"} ${safeUrl}`,
      stack: error && error.stack ? error.stack : null,
      context: { method, url: safeUrl, status },
    });
    return;
  }
  if (error) {
    submit({
      kind: "network",
      message: error.message || "Network request failed",
      stack: error.stack || null,
      context: { method, url: safeUrl },
    });
  }
});

export const addBreadcrumb = safe((crumb) => {
  if (!enabled()) return;
  crumbs.push({ t: Date.now(), ...crumb });
});

/** Хлебная крошка про вызов API. Зовётся HTTP-слоем на каждый запрос. */
export const apiBreadcrumb = safe(({ method, url, status, ms }) => {
  if (!enabled() || isIngestUrl(url)) return;
  crumbs.push({
    t: Date.now(),
    type: "api",
    method: method || "GET",
    url: redactUrl(url),
    status: status ?? null,
    ms: ms ?? null,
  });
});

export const isIngestUrl = (url) => String(url || "").includes(INGEST_PATH);

// ─── Инициализация ───────────────────────────────────────────────────────────
const describeTarget = (el) => {
  // Записываем СЕЛЕКТОР, но не текст: в тексте кнопки или строки таблицы
  // легко окажутся имя стажёра или телефон.
  if (!el || !el.tagName) return "unknown";
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const testid = el.getAttribute && el.getAttribute("data-testid");
  const cls =
    typeof el.className === "string" && el.className
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
      : "";
  return `${tag}${id}${testid ? `[data-testid=${testid}]` : ""}${cls}`.slice(0, 120);
};

/**
 * @param app       'interns' | 'mentors' | 'admin' — должно совпадать с enum сервера
 * @param endpoint  база API (VITE_API_URL), уже включает /api
 * @param release   git sha сборки, прокинут через vite define
 * @param getToken  () => access token, для подтверждённой атрибуции
 * @param getUser   () => строка-подпись, если токена нет (уйдёт в identifier)
 */
export const initErrorReporter = (options = {}) => {
  try {
    if (started) return;
    if (typeof window === "undefined") return;
    if (!options.app || !options.endpoint) return;

    started = true;
    config = {
      app: options.app,
      endpoint: String(options.endpoint).replace(/\/+$/, ""),
      release: options.release || null,
      getToken: options.getToken || null,
      getUser: options.getUser || null,
      enabled: options.enabled !== false,
      maxQueueItems: options.maxQueueItems ?? DEFAULTS.maxQueueItems,
      maxQueueBytes: options.maxQueueBytes ?? DEFAULTS.maxQueueBytes,
      maxAttempts: options.maxAttempts ?? DEFAULTS.maxAttempts,
    };
    breaker = makeBreaker(options);
    dedup = makeDedup(options.dedupWindowMs);

    if (!config.enabled) return;

    window.addEventListener("error", (event) => {
      // Ошибки загрузки ресурсов (img/script) прилетают сюда же, но у них нет
      // event.error — чинить в коде нечего, это не исключение.
      if (!event || !event.error) return;
      reportError(event.error, { kind: "window-error" });
    });

    window.addEventListener("unhandledrejection", (event) => {
      const reason = event && event.reason;
      reportError(reason instanceof Error ? reason : new Error(String(reason)), {
        kind: "unhandled-rejection",
      });
    });

    // Переходы роутера — через history, чтобы не лезть в App.jsx каждого
    // приложения. Работает и с react-router, и с прямыми вызовами.
    const trackNav = (to) => addBreadcrumb({ type: "route", to: redactUrl(to) });
    for (const method of ["pushState", "replaceState"]) {
      const original = window.history[method];
      if (typeof original !== "function") continue;
      window.history[method] = function patched(...args) {
        const result = original.apply(this, args);
        try {
          trackNav(args[2] != null ? String(args[2]) : window.location.pathname);
        } catch { /* навигация важнее крошки */ }
        return result;
      };
    }
    window.addEventListener("popstate", () => trackNav(window.location.pathname));

    document.addEventListener(
      "click",
      (event) => {
        addBreadcrumb({ type: "click", target: describeTarget(event.target) });
      },
      { capture: true, passive: true }
    );

    // Накопленное с прошлых сессий и с моментов, когда приёмник лежал.
    drainQueue();
    window.addEventListener("online", () => { drainQueue(); });
    window.addEventListener("pagehide", () => { drainQueue(); });

    addBreadcrumb({ type: "init", release: config.release });
  } catch {
    // Инициализация репортера не имеет права помешать запуску приложения.
    started = true;
  }
};

// Для проверки из node-скрипта и из консоли разработчика.
export const _internals = {
  state: () => ({
    started,
    enabled: enabled(),
    breaker: breaker ? breaker.state() : null,
    breadcrumbs: crumbs.list(),
    queue: (() => {
      try {
        return readQueue().length;
      } catch {
        return -1;
      }
    })(),
  }),
  reset: () => {
    config = null; breaker = null; dedup = null; started = false; busy = false;
    crumbs = makeBreadcrumbs(DEFAULTS.maxBreadcrumbs);
  },
  drainQueue,
  QUEUE_KEY,
};
