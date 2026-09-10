import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend, Filler,
} from "chart.js";
import {
  Bug, AlertTriangle, X, RefreshCw, ChevronLeft, ChevronRight, Filter,
  Footprints, Wrench, CheckCircle2, EyeOff, Users, Clock, MousePointerClick,
  ArrowRight, Radio, Zap,
} from "lucide-react";
import { api } from "../utils/api";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

// Экран расследования, как и «Аудит-лог»: плотность и скорость важнее красоты.
// Паттерны (фильтры в URL, кликабельные сводки, модалка) взяты оттуда же.
//
// Центр экрана — не список, а блок «что делал перед падением» в детализации:
// связка ошибки с аудит-логом это единственное, чего не даёт внешний Sentry.

// ─── Форматтеры ──────────────────────────────────────────────────────────────
const fmtTime = (d) =>
  d ? new Date(d).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  }) : "—";

const fmtFull = (d) =>
  d ? new Date(d).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }) : "—";

const fmtAgo = (d) => {
  if (!d) return "—";
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s} с назад`;
  if (s < 3600) return `${Math.round(s / 60)} мин назад`;
  if (s < 86400) return `${Math.round(s / 3600)} ч назад`;
  return `${Math.round(s / 86400)} дн назад`;
};

// Смещение относительно момента падения — главное число в ленте контекста.
const fmtDelta = (from, to) => {
  const ms = new Date(from).getTime() - new Date(to).getTime();
  const s = ms / 1000;
  const sign = s < 0 ? "−" : "+";
  const a = Math.abs(s);
  if (a < 60) return `${sign}${a.toFixed(1)} с`;
  return `${sign}${Math.round(a / 60)} мин`;
};

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : "");

// ─── Словари ─────────────────────────────────────────────────────────────────
const STATUS_META = {
  new: { label: "Новая", cls: "bg-red-100 text-red-700 border-red-200" },
  triaged: { label: "В работе", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  "fix-proposed": { label: "Есть правка", cls: "bg-purple-100 text-purple-700 border-purple-200" },
  resolved: { label: "Закрыта", cls: "bg-green-100 text-green-700 border-green-200" },
  ignored: { label: "Игнор", cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

const APP_META = {
  interns: { label: "interns", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  mentors: { label: "mentors", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  admin: { label: "admin", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  server: { label: "server", cls: "bg-slate-100 text-slate-700 border-slate-300" },
};

const KIND_LABELS = {
  "react-render": "рендер",
  "unhandled-rejection": "промис",
  "window-error": "window",
  "api-failure": "API",
  "uncaught-exception": "исключение",
  "cron-failure": "cron",
  "http-5xx": "5xx",
  network: "сеть",
};

// Зеркало серверной таблицы: нужно только чтобы гасить заведомо недоступные
// кнопки. Источник истины — сервер, он отвечает 400 с объяснением.
const ALLOWED = {
  new: ["triaged", "fix-proposed", "resolved", "ignored"],
  triaged: ["fix-proposed", "resolved", "ignored", "new"],
  "fix-proposed": ["resolved", "ignored", "triaged"],
  resolved: ["new"],
  ignored: ["new"],
};

const FILTER_KEYS = [
  "app", "kind", "status", "release", "from", "to", "q",
  "sort", "order", "page", "limit", "issue",
];

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESETS = [
  { label: "24 ч", ms: DAY_MS },
  { label: "7 дн", ms: 7 * DAY_MS },
  { label: "30 дн", ms: 30 * DAY_MS },
];

const statusCode = (code) => {
  if (code >= 500) return "bg-red-100 text-red-700 border-red-200";
  if (code >= 400) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-green-100 text-green-700 border-green-200";
};

// ─── Мелкие блоки ────────────────────────────────────────────────────────────
const Badge = ({ meta, fallback }) => (
  <span className={`px-1.5 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap ${meta ? meta.cls : "bg-gray-100 text-gray-500 border-gray-200"}`}>
    {meta ? meta.label : fallback}
  </span>
);

const Tile = ({ label, value, hint, tone = "gray" }) => {
  const tones = { gray: "text-gray-900", red: "text-red-600", blue: "text-blue-600", green: "text-green-600" };
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${tones[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
};

const Section = ({ title, icon: Icon, right, children, accent = false }) => (
  <div className={`rounded-lg border mb-3 ${accent ? "border-blue-300 bg-blue-50/40" : "border-gray-200 bg-white"}`}>
    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
      {Icon && <Icon className={`w-3.5 h-3.5 ${accent ? "text-blue-600" : "text-gray-400"}`} />}
      <h4 className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-blue-800" : "text-gray-600"}`}>
        {title}
      </h4>
      <div className="ml-auto">{right}</div>
    </div>
    <div className="p-3">{children}</div>
  </div>
);

const Pre = ({ children, max = "max-h-56" }) => (
  <pre className={`bg-gray-50 border border-gray-100 rounded p-2 text-[11px] leading-snug overflow-x-auto ${max} whitespace-pre-wrap break-all`}>
    {children}
  </pre>
);

// ─── Breadcrumbs в читаемом виде ─────────────────────────────────────────────
const CRUMB_ICON = { route: ArrowRight, api: Radio, click: MousePointerClick, init: Zap };

const crumbText = (c) => {
  switch (c.type) {
    case "route": return `переход на ${c.to}`;
    case "api": return `${c.method || "GET"} ${c.url}${c.status ? ` → ${c.status}` : ""}${c.ms != null ? ` (${c.ms} мс)` : ""}`;
    case "click": return `клик по ${c.target}`;
    case "init": return `старт приложения${c.release ? `, релиз ${c.release}` : ""}`;
    default: return JSON.stringify(c);
  }
};

const Breadcrumbs = ({ items, crashAt }) => {
  if (!items || items.length === 0) {
    return <p className="text-xs text-gray-400">Крошек нет — ошибка пришла без них</p>;
  }
  return (
    <ol className="space-y-0.5">
      {items.map((c, i) => {
        const Icon = CRUMB_ICON[c.type] || Footprints;
        return (
          <li key={i} className="flex items-start gap-2 text-xs py-0.5">
            <Icon className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-gray-700 flex-1 break-all font-mono text-[11px]">{crumbText(c)}</span>
            {c.t && crashAt && (
              <span className="text-[10px] text-gray-400 whitespace-nowrap tabular-nums">
                {fmtDelta(c.t, crashAt)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
};

// ─── Что делал перед падением ────────────────────────────────────────────────
// Центральный блок экрана. Единственное, чего внешний Sentry дать не может:
// у него нет нашего аудит-лога.
const AuditContext = ({ ctx, loading, windowSec, onWindow }) => {
  const crashAt = ctx?.event?.createdAt;

  const body = () => {
    if (loading) return <p className="text-xs text-gray-400">Загрузка…</p>;
    if (!ctx) return <p className="text-xs text-gray-400">Нет данных</p>;

    if (ctx.reason === "anonymous-actor" || ctx.reason === "no-events") {
      return (
        <div className="text-xs text-gray-500 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <span>{ctx.note}</span>
        </div>
      );
    }
    if (!ctx.entries || ctx.entries.length === 0) {
      return (
        <p className="text-xs text-gray-400">
          В аудит-логе нет записей этого пользователя за выбранное окно. Попробуйте расширить.
        </p>
      );
    }

    return (
      <ol className="divide-y divide-gray-100">
        {ctx.entries.map((e, i) => {
          const isClosest = i === ctx.closestIndex;
          return (
            <li
              key={e._id || i}
              className={`flex items-center gap-2 py-1 px-1 text-xs ${isClosest ? "bg-amber-50 rounded" : ""}`}
              title={isClosest ? "Ближе всего к моменту падения" : undefined}
            >
              <span className="tabular-nums text-[10px] text-gray-400 w-14 flex-shrink-0 text-right">
                {fmtDelta(e.createdAt, crashAt)}
              </span>
              <span className="font-mono text-[11px] font-semibold text-gray-600 w-14 flex-shrink-0">
                {e.method}
              </span>
              <span className="font-mono text-[11px] text-gray-700 flex-1 truncate">
                {e.routePattern || e.path}
              </span>
              <span className={`px-1 py-0.5 rounded border text-[10px] font-semibold ${statusCode(e.statusCode)}`}>
                {e.statusCode}
              </span>
              {isClosest && (
                <span className="text-[10px] text-amber-700 font-semibold whitespace-nowrap">← падение здесь</span>
              )}
            </li>
          );
        })}
      </ol>
    );
  };

  return (
    <Section
      title="Что делал перед падением"
      icon={Footprints}
      accent
      right={
        <select
          className="border border-gray-300 rounded px-1.5 py-0.5 text-[11px] bg-white"
          value={windowSec}
          onChange={(e) => onWindow(Number(e.target.value))}
          title="Окно до момента падения"
        >
          {[30, 60, 120, 300, 900, 3600].map((s) => (
            <option key={s} value={s}>{s < 60 ? `${s} с` : `${s / 60} мин`}</option>
          ))}
        </select>
      }
    >
      {ctx?.event?.actor && (
        <p className="text-[11px] text-gray-500 mb-2">
          {ctx.event.actor.name || ctx.event.actor.identifier || ctx.event.actor.id || "аноним"}
          {ctx.event.actor.role ? ` · ${ctx.event.actor.role}` : ""}
          {" · падение "}
          {fmtFull(crashAt)}
        </p>
      )}
      {body()}
    </Section>
  );
};

// ─── Детализация ─────────────────────────────────────────────────────────────
const IssueDetail = ({ fingerprint, onClose, onChanged }) => {
  const [data, setData] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const [windowSec, setWindowSec] = useState(120);
  const [eventId, setEventId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const d = await api.errorIssues.get(fingerprint);
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fingerprint]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCtxLoading(true);
      try {
        const c = await api.errorIssues.context(fingerprint, {
          windowSec,
          ...(eventId ? { eventId } : {}),
        });
        if (!cancelled) setCtx(c);
      } catch {
        if (!cancelled) setCtx(null);
      } finally {
        if (!cancelled) setCtxLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fingerprint, windowSec, eventId]);

  const setStatus = async (status) => {
    setBusy(true);
    setErr(null);
    try {
      const updated = await api.errorIssues.update(fingerprint, { status });
      setData((d) => ({ ...d, issue: updated }));
      onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const issue = data?.issue;
  const events = data?.events || [];
  const current = ctx?.event || events[0];

  const chart = useMemo(() => {
    const tl = data?.timeline || [];
    if (tl.length === 0) return null;
    return {
      labels: tl.map((b) => new Date(b._id).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit" })),
      datasets: [{
        label: "Случаев",
        data: tl.map((b) => b.total),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.12)",
        fill: true, tension: 0.3, pointRadius: 0,
      }],
    };
  }, [data]);

  const actions = [
    { status: "triaged", label: "Взять в работу", Icon: Wrench, cls: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100" },
    { status: "resolved", label: "Закрыть", Icon: CheckCircle2, cls: "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" },
    { status: "ignored", label: "В игнор", Icon: EyeOff, cls: "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100" },
    { status: "new", label: "Переоткрыть", Icon: RefreshCw, cls: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-5xl my-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-start justify-between px-5 py-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl z-10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge meta={APP_META[issue?.app]} fallback={issue?.app} />
              <Badge meta={STATUS_META[issue?.status]} fallback={issue?.status} />
              <span className="text-[11px] text-gray-500">{KIND_LABELS[issue?.kind] || issue?.kind}</span>
              {issue?.regressedAt && (
                <span className="text-[11px] text-amber-700 font-semibold">
                  ♻️ вернулась {fmtAgo(issue.regressedAt)}
                </span>
              )}
            </div>
            <h3 className="font-bold text-gray-900 break-words text-sm">
              {issue?.sampleMessage || "—"}
            </h3>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5">
              {issue?.topFrames?.[0]} · fp {String(fingerprint).slice(0, 12)}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Действия */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-gray-100 flex-wrap">
          {actions.map(({ status, label, Icon, cls }) => {
            const allowed = issue && (ALLOWED[issue.status] || []).includes(status);
            if (!allowed) return null;
            return (
              <button
                key={status}
                onClick={() => setStatus(status)}
                disabled={busy}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium disabled:opacity-50 ${cls}`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            );
          })}
          {issue?.statusChangedBy?.name && (
            <span className="text-[11px] text-gray-400 ml-auto">
              {STATUS_META[issue.status]?.label} · {issue.statusChangedBy.name}, {fmtAgo(issue.statusChangedAt)}
            </span>
          )}
        </div>

        <div className="p-4">
          {err && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-3 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          {/* ЦЕНТР ЭКРАНА — контекст из аудит-лога.
              Стоит выше гейта загрузки намеренно: он приходит своим запросом,
              и заставлять главный блок ждать детализацию незачем. */}
          <AuditContext ctx={ctx} loading={ctxLoading} windowSec={windowSec} onWindow={setWindowSec} />

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Числа */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <Tile label="Случаев" value={issue?.count ?? 0} tone="red" />
                <Tile label="Пользователей" value={data?.affectedUsersExact ?? 0}
                      hint="по сохранённым событиям" />
                <Tile label="Впервые" value={fmtAgo(issue?.firstSeen)} hint={fmtFull(issue?.firstSeen)} />
                <Tile label="Последний раз" value={fmtAgo(issue?.lastSeen)} hint={fmtFull(issue?.lastSeen)} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div>
                  <Section title="Стек" icon={Bug}>
                    <Pre>{current?.stack || "—"}</Pre>
                  </Section>

                  {current?.componentStack && (
                    <Section title="Дерево компонентов">
                      <Pre max="max-h-40">{current.componentStack}</Pre>
                    </Section>
                  )}

                  <Section title="Крошки перед падением" icon={Footprints}>
                    <Breadcrumbs items={current?.breadcrumbs} crashAt={current?.createdAt} />
                  </Section>
                </div>

                <div>
                  <Section title="Частота">
                    {chart ? (
                      <div className="h-36">
                        <Line data={chart} options={{
                          responsive: true, maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: {
                            y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } },
                            x: { ticks: { font: { size: 9 }, maxRotation: 0, autoSkipPadding: 24 } },
                          },
                        }} />
                      </div>
                    ) : <p className="text-xs text-gray-400 py-6 text-center">Нет данных</p>}
                  </Section>

                  <Section title="Релизы">
                    {(data?.byRelease || []).length === 0 ? (
                      <p className="text-xs text-gray-400">—</p>
                    ) : (
                      <ul className="text-xs space-y-0.5">
                        {data.byRelease.map((r) => (
                          <li key={r._id || "unknown"} className="flex justify-between gap-2">
                            <span className="font-mono text-gray-700">{r._id || "неизвестно"}</span>
                            <span className="text-gray-500">{r.count} · {fmtAgo(r.lastSeen)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>

                  <Section
                    title={`Последние случаи (${events.length})`}
                    icon={Clock}
                    right={<span className="text-[10px] text-gray-400">клик — контекст этого случая</span>}
                  >
                    <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                      {events.map((e) => (
                        <li key={e._id}>
                          <button
                            onClick={() => setEventId(e._id)}
                            className={`w-full text-left px-1 py-1 text-xs hover:bg-blue-50 rounded flex items-center gap-2 ${
                              String(current?._id) === String(e._id) ? "bg-blue-50" : ""
                            }`}
                          >
                            <span className="text-gray-400 tabular-nums text-[10px] w-24 flex-shrink-0">
                              {fmtTime(e.createdAt)}
                            </span>
                            <span className="text-gray-700 truncate flex-1">
                              {e.actor?.name || e.actor?.identifier || "аноним"}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">{e.release || "—"}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Section>

                  {current?.userAgent && (
                    <Section title="Окружение">
                      <p className="text-[11px] text-gray-600 break-all">{current.userAgent}</p>
                      {current.url && (
                        <p className="text-[11px] text-gray-500 break-all mt-1 font-mono">{current.url}</p>
                      )}
                    </Section>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Страница ────────────────────────────────────────────────────────────────
const ErrorIssues = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [issues, setIssues] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const filters = useMemo(() => {
    const out = {};
    for (const k of FILTER_KEYS) out[k] = searchParams.get(k) || "";
    return out;
  }, [searchParams]);

  // Локальное состояние поиска: писать в URL на каждую букву значит дёргать
  // API на каждое нажатие и засорять history.
  const [qInput, setQInput] = useState(filters.q);
  useEffect(() => { setQInput(filters.q); }, [filters.q]);

  const setFilter = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v === "" || v == null) next.delete(k);
        else next.set(k, String(v));
      }
      if (!("page" in patch) && !("issue" in patch)) next.delete("page");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (qInput !== filters.q) setFilter({ q: qInput });
    }, 400);
    return () => clearTimeout(t);
  }, [qInput, filters.q, setFilter]);

  // Фильтры списка без пагинации и без выбранного issue.
  const queryFilters = useMemo(() => {
    const rest = { ...filters };
    delete rest.page; delete rest.limit; delete rest.issue;
    return rest;
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await api.errorIssues.list({
          ...queryFilters,
          page: filters.page || 1,
          limit: filters.limit || 50,
        });
        if (cancelled) return;
        setIssues(Array.isArray(d?.data) ? d.data : []);
        setPagination(d?.pagination || null);
      } catch (e) {
        if (!cancelled) setError(e.message || "Не удалось загрузить список");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [queryFilters, filters.page, filters.limit, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const d = await api.errorIssues.stats({ from: filters.from, to: filters.to });
        if (!cancelled) setStats(d);
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filters.from, filters.to, reloadKey]);

  const refresh = () => setReloadKey((k) => k + 1);

  const page = Number(filters.page) || 1;
  const totalPages = pagination?.totalPages || 0;
  const t = stats?.totals;

  const activeFilterCount = useMemo(
    () => ["app", "kind", "status", "release", "q"].filter((k) => filters[k]).length,
    [filters]
  );

  const chart = useMemo(() => {
    const tl = stats?.timeline || [];
    if (tl.length === 0) return null;
    const byDay = stats?.period?.bucketUnit === "day";
    return {
      labels: tl.map((b) => new Date(b._id).toLocaleString("ru-RU",
        byDay ? { day: "2-digit", month: "2-digit" } : { hour: "2-digit", minute: "2-digit" })),
      datasets: [{
        label: "Случаев",
        data: tl.map((b) => b.total),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.12)",
        fill: true, tension: 0.3, pointRadius: 0,
      }],
    };
  }, [stats]);

  const selectCls =
    "border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  const chip = (active, activeCls) =>
    `px-2.5 py-1 rounded-full text-xs font-medium border ${
      active ? activeCls : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
    }`;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <Bug className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Ошибки</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Сгруппированные проблемы всех приложений. Клик по строке — разбор.
          </p>
        </div>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {/* Быстрые срезы */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold mr-1">Статус</span>
        <button onClick={() => setFilter({ status: "new,triaged,fix-proposed" })}
                className={chip(filters.status === "new,triaged,fix-proposed", "bg-gray-800 text-white border-gray-800")}>
          Открытые {t ? `(${t.open})` : ""}
        </button>
        <button onClick={() => setFilter({ status: "new" })}
                className={chip(filters.status === "new", "bg-red-500 text-white border-red-500")}>
          Новые {stats?.byStatus?.new ? `(${stats.byStatus.new})` : ""}
        </button>
        <button onClick={() => setFilter({ status: "triaged" })}
                className={chip(filters.status === "triaged", "bg-blue-500 text-white border-blue-500")}>
          В работе
        </button>
        <button onClick={() => setFilter({ status: "" })}
                className={chip(!filters.status, "bg-gray-800 text-white border-gray-800")}>
          Все
        </button>

        <span className="w-px h-5 bg-gray-200 mx-1" />
        <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold mr-1">Период</span>
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => setFilter({ from: new Date(Date.now() - p.ms).toISOString(), to: "" })}
                  className={chip(false)}>
            {p.label}
          </button>
        ))}

        {activeFilterCount > 0 && (
          <button
            onClick={() => setSearchParams({}, { replace: true })}
            className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
          >
            <X className="w-3 h-3" /> Сбросить ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Tile label="Проблем всего" value={statsLoading ? "…" : (t?.issues ?? 0)} />
        <Tile label="Открыто" value={statsLoading ? "…" : (t?.open ?? 0)}
              tone={(t?.open || 0) > 0 ? "red" : "green"} />
        <Tile label="Новых за период" value={statsLoading ? "…" : (t?.newInPeriod ?? 0)} tone="blue" />
        <Tile label="Случаев всего" value={statsLoading ? "…" : (t?.events ?? 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Динамика {stats?.period?.bucketUnit === "day" ? "по дням" : "по часам"}
          </h3>
          {chart ? (
            <div className="h-36">
              <Line data={chart} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } },
                  x: { ticks: { font: { size: 10 }, maxRotation: 0, autoSkipPadding: 20 } },
                },
              }} />
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-10">
              {statsLoading ? "Загрузка…" : "Нет данных за период"}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-3 py-2 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">По приложениям</h3>
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-gray-50">
              {(stats?.byApp || []).map((a) => (
                <tr key={a._id} onClick={() => setFilter({ app: a._id })}
                    className="hover:bg-blue-50 cursor-pointer" title="Отфильтровать">
                  <td className="px-3 py-1.5"><Badge meta={APP_META[a._id]} fallback={a._id} /></td>
                  <td className="px-3 py-1.5 text-right text-gray-500">{a.count} проблем</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-gray-800">{a.events}</td>
                </tr>
              ))}
              {(stats?.byApp || []).length === 0 && (
                <tr><td className="px-3 py-6 text-center text-gray-400">Нет данных</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-4">
        <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <Filter className="w-3 h-3" /> Фильтры
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">Приложение</label>
            <select className={selectCls} value={filters.app} onChange={(e) => setFilter({ app: e.target.value })}>
              <option value="">Все</option>
              {Object.keys(APP_META).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">Вид</label>
            <select className={selectCls} value={filters.kind} onChange={(e) => setFilter({ kind: e.target.value })}>
              <option value="">Все</option>
              {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">Статус</label>
            <select className={selectCls} value={filters.status} onChange={(e) => setFilter({ status: e.target.value })}>
              <option value="">Все</option>
              <option value="new,triaged,fix-proposed">Открытые</option>
              {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">Релиз</label>
            <input type="text" placeholder="sha" className={`${selectCls} font-mono w-[120px]`}
                   value={filters.release} onChange={(e) => setFilter({ release: e.target.value.trim() })} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">С</label>
            <input type="datetime-local" className={selectCls} value={toLocalInput(filters.from)}
                   onChange={(e) => setFilter({ from: fromLocalInput(e.target.value) })} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">По</label>
            <input type="datetime-local" className={selectCls} value={toLocalInput(filters.to)}
                   onChange={(e) => setFilter({ to: fromLocalInput(e.target.value) })} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">Сортировка</label>
            <select className={selectCls} value={filters.sort || "lastSeen"}
                    onChange={(e) => setFilter({ sort: e.target.value })}>
              <option value="lastSeen">По свежести</option>
              <option value="count">По частоте</option>
              <option value="firstSeen">По дате появления</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-[170px]">
            <label className="text-[11px] text-gray-500">Поиск</label>
            <input type="text" placeholder="сообщение или кадр стека" className={`${selectCls} w-full`}
                   value={qInput} onChange={(e) => setQInput(e.target.value)} />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Список */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-xs uppercase tracking-wide">
              <th className="px-3 py-2 font-semibold text-gray-500">Проблема</th>
              <th className="px-3 py-2 font-semibold text-gray-500">Где</th>
              <th className="px-3 py-2 font-semibold text-gray-500">Статус</th>
              <th className="px-3 py-2 font-semibold text-gray-500 text-right">Случаев</th>
              <th className="px-3 py-2 font-semibold text-gray-500 text-right">Людей</th>
              <th className="px-3 py-2 font-semibold text-gray-500">Впервые</th>
              <th className="px-3 py-2 font-semibold text-gray-500">Последний раз</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="7" className="text-center py-12">
                <div className="flex justify-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              </td></tr>
            ) : issues.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-16">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Bug className="w-10 h-10 opacity-30" />
                  <p className="font-medium text-gray-500">Проблем не найдено</p>
                  <p className="text-xs">Снимите фильтры или расширьте период</p>
                </div>
              </td></tr>
            ) : (
              issues.map((i) => (
                <tr
                  key={i.fingerprint}
                  onClick={() => setFilter({ issue: i.fingerprint })}
                  className={`cursor-pointer transition-colors ${
                    i.status === "new" ? "hover:bg-red-50" : "hover:bg-gray-50"
                  } ${i.status === "ignored" ? "opacity-50" : ""}`}
                >
                  <td className="px-3 py-2 max-w-[440px]">
                    <p className="text-gray-900 truncate text-[13px]">{i.sampleMessage || i.normalizedMessage}</p>
                    <p className="text-[11px] text-gray-400 font-mono truncate">
                      {i.topFrames?.[0] || "—"}
                      {i.regressedAt && <span className="text-amber-600 ml-1.5">♻️ вернулась</span>}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <Badge meta={APP_META[i.app]} fallback={i.app} />
                      <span className="text-[11px] text-gray-400">{KIND_LABELS[i.kind] || i.kind}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2"><Badge meta={STATUS_META[i.status]} fallback={i.status} /></td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-800 tabular-nums">{i.count}</td>
                  <td className="px-3 py-2 text-right text-gray-500 tabular-nums">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Users className="w-3 h-3 text-gray-300" />
                      {(i.affectedUsers || []).length}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap" title={fmtFull(i.firstSeen)}>
                    {fmtAgo(i.firstSeen)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap" title={fmtFull(i.lastSeen)}>
                    {fmtAgo(i.lastSeen)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!loading && pagination && pagination.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} из {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <select className="border border-gray-200 rounded px-1.5 py-1 text-xs bg-white"
                      value={filters.limit || "50"} onChange={(e) => setFilter({ limit: e.target.value })}
                      title="Записей на странице (потолок API — 200)">
                {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} / стр.</option>)}
              </select>
              <button onClick={() => setFilter({ page: page - 1 })} disabled={page <= 1}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft className="w-3 h-3" /> Назад
              </button>
              <span className="text-xs text-gray-500">{page} / {totalPages || 1}</span>
              <button onClick={() => setFilter({ page: page + 1 })} disabled={!pagination.hasMore}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                Вперёд <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {filters.issue && (
        <IssueDetail
          fingerprint={filters.issue}
          onClose={() => setFilter({ issue: "" })}
          onChanged={refresh}
        />
      )}
    </div>
  );
};

export default ErrorIssues;
