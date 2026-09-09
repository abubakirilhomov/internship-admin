import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend, Filler,
} from "chart.js";
import {
  ScrollText, AlertTriangle, X, ShieldAlert, UserCircle, HelpCircle,
  RefreshCw, ChevronLeft, ChevronRight, Filter,
} from "lucide-react";
import { api } from "../utils/api";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

// Экран расследований: «кто удалил стажёра во вторник», «почему у ментора X
// сыпятся 403», «кто ломился в логин ночью». Плотность важнее красоты —
// отсюда компактные строки, узкие отступы и кликабельные сводные таблицы:
// клик по строке сводки = готовый фильтр, чтобы до ответа было два клика.

// ─── Форматтеры ──────────────────────────────────────────────────────────────
const fmtTime = (d) =>
  d ? new Date(d).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", hour: "2-digit",
    minute: "2-digit", second: "2-digit",
  }) : "—";

const fmtFull = (d) =>
  d ? new Date(d).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }) : "—";

const fmtDuration = (ms) => {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)} мс`;
  return `${(ms / 1000).toFixed(2)} с`;
};

// datetime-local хочет локальное «YYYY-MM-DDTHH:mm», а в URL и API живёт ISO.
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : "");

const statusClass = (code) => {
  if (code >= 500) return "bg-red-100 text-red-700 border-red-200";
  if (code >= 400) return "bg-amber-100 text-amber-700 border-amber-200";
  if (code >= 300) return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-green-100 text-green-700 border-green-200";
};

const METHOD_CLASS = {
  GET: "text-slate-500",
  POST: "text-green-600",
  PUT: "text-blue-600",
  PATCH: "text-blue-600",
  DELETE: "text-red-600",
};

const ROLE_LABELS = {
  admin: "Админ",
  mentor: "Ментор",
  intern: "Стажёр",
  branchManager: "Branch Manager",
  administrator: "Ресепшен",
};

// ─── Фильтры живут в URL ─────────────────────────────────────────────────────
// Единственный источник истины — query string: ссылку на конкретную выборку
// («все 403 ментора X за вторник») можно просто переслать коллеге.
const FILTER_KEYS = [
  "from", "to", "actorId", "kind", "role", "method",
  "status", "routePattern", "branchId", "path", "page", "limit",
];

const DAY_MS = 24 * 60 * 60 * 1000;
const PRESETS = [
  { label: "1 ч", ms: 60 * 60 * 1000 },
  { label: "24 ч", ms: DAY_MS },
  { label: "7 дн", ms: 7 * DAY_MS },
  { label: "30 дн", ms: 30 * DAY_MS },
];

// ─── Мелкие блоки ────────────────────────────────────────────────────────────
const Tile = ({ label, value, hint, tone = "gray" }) => {
  const tones = {
    gray: "text-gray-900",
    amber: "text-amber-600",
    red: "text-red-600",
    green: "text-green-600",
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${tones[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
};

// Актор: подтверждённое имя и непроверенная строка из тела запроса — разные
// сущности, и на экране расследования их нельзя показывать одинаково.
const ActorCell = ({ actor }) => {
  if (!actor) return <span className="text-gray-300">—</span>;

  if (actor.kind === "anonymous") {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <HelpCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        {actor.identifier ? (
          <span
            className="italic text-amber-700 border-b border-dashed border-amber-300 truncate"
            title="Не подтверждено: строка из тела запроса, а не установленная личность"
          >
            {actor.identifier}
          </span>
        ) : (
          <span className="text-gray-400">аноним</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <UserCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span className="text-gray-900 truncate">{actor.name || actor.id}</span>
      {actor.isAdmin && (
        <span className="px-1 rounded bg-purple-100 text-purple-700 text-[10px] font-semibold flex-shrink-0">
          admin
        </span>
      )}
      <span className="text-[11px] text-gray-400 flex-shrink-0">
        {ROLE_LABELS[actor.role] || actor.role || ""}
      </span>
    </div>
  );
};

// Сводная таблица, строки которой применяют фильтр.
const TopTable = ({ title, rows, renderLabel, renderValue, onPick, empty }) => (
  <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
    <div className="px-3 py-2 border-b border-gray-100">
      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</h3>
    </div>
    {rows.length === 0 ? (
      <p className="px-3 py-6 text-center text-xs text-gray-400">{empty}</p>
    ) : (
      <table className="w-full text-xs">
        <tbody className="divide-y divide-gray-50">
          {rows.map((r, i) => (
            <tr
              key={i}
              onClick={() => onPick(r)}
              className="hover:bg-blue-50 cursor-pointer transition-colors"
              title="Применить как фильтр"
            >
              <td className="px-3 py-1.5 text-gray-700 max-w-0 truncate">{renderLabel(r)}</td>
              <td className="px-3 py-1.5 text-right whitespace-nowrap">{renderValue(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

// ─── Модалка полной записи ───────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div className="grid grid-cols-[110px_1fr] gap-2 py-1 border-b border-gray-50 last:border-0">
    <span className="text-xs text-gray-400 pt-0.5">{label}</span>
    <div className="text-sm text-gray-800 break-words min-w-0">{children}</div>
  </div>
);

const Json = ({ value }) =>
  value == null ? (
    <span className="text-gray-300">—</span>
  ) : (
    <pre className="bg-gray-50 border border-gray-100 rounded p-2 text-[11px] leading-snug overflow-x-auto max-h-56">
      {JSON.stringify(value, null, 2)}
    </pre>
  );

const DetailModal = ({ log, branchName, onClose, onFilter }) => (
  <div
    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div
      className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[88vh] flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between px-5 py-3 border-b border-gray-100">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
            <span className={`font-mono text-sm ${METHOD_CLASS[log.method] || "text-gray-600"}`}>
              {log.method}
            </span>
            <span className="font-mono text-sm text-gray-700 break-all">{log.path}</span>
            <span className={`px-1.5 py-0.5 rounded border text-xs font-semibold ${statusClass(log.statusCode)}`}>
              {log.statusCode}
            </span>
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">{fmtFull(log.createdAt)}</p>
        </div>
        <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 overflow-y-auto">
        {log.error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="break-words">{log.error}</span>
          </div>
        )}

        <Field label="Актор">
          <div className="flex items-center gap-2 flex-wrap">
            <ActorCell actor={log.actor} />
            {log.actor?.id && (
              <button
                onClick={() => onFilter({ actorId: log.actor.id })}
                className="text-xs text-blue-600 hover:underline"
              >
                все его действия →
              </button>
            )}
          </div>
        </Field>
        <Field label="ID актора">
          <span className="font-mono text-xs">{log.actor?.id || "—"}</span>
        </Field>
        <Field label="Шаблон">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs">{log.routePattern || "—"}</span>
            {log.routePattern && (
              <button
                onClick={() => onFilter({ routePattern: log.routePattern })}
                className="text-xs text-blue-600 hover:underline"
              >
                все запросы сюда →
              </button>
            )}
          </div>
        </Field>
        <Field label="Ресурс">
          {log.resource?.type
            ? `${log.resource.type}${log.resource.id ? ` / ${log.resource.id}` : ""}`
            : "—"}
        </Field>
        <Field label="Длительность">{fmtDuration(log.durationMs)}</Field>
        <Field label="Филиал">{branchName || "—"}</Field>
        <Field label="IP">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">{log.ip || "—"}</span>
          </div>
        </Field>
        <Field label="User-Agent">
          <span className="text-xs text-gray-500 break-all">{log.userAgent || "—"}</span>
        </Field>
        <Field label="Query"><Json value={log.query} /></Field>
        <Field label="Params"><Json value={log.params} /></Field>
        <Field label="Тело">
          {log.body == null ? (
            <span className="text-gray-300">— (тело пишется только для мутаций)</span>
          ) : (
            <>
              <Json value={log.body} />
              <p className="text-[11px] text-gray-400 mt-1">
                Секреты вырезаны на сервере до записи.
                {log.body._truncated && " Тело обрезано по размеру — сохранён только состав полей."}
              </p>
            </>
          )}
        </Field>
      </div>
    </div>
  </div>
);

// ─── Страница ────────────────────────────────────────────────────────────────
const AuditLog = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [stats, setStats] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const filters = useMemo(() => {
    const out = {};
    for (const k of FILTER_KEYS) out[k] = searchParams.get(k) || "";
    return out;
  }, [searchParams]);

  // Локальное состояние поля поиска: писать в URL на каждое нажатие клавиши
  // значит дёргать API на каждую букву и засорять history.
  const [pathInput, setPathInput] = useState(filters.path);
  useEffect(() => { setPathInput(filters.path); }, [filters.path]);

  const setFilter = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v === "" || v == null) next.delete(k);
        else next.set(k, String(v));
      }
      // Любая смена фильтра возвращает на первую страницу — иначе легко
      // «потеряться» на 7-й странице пустой выборки.
      if (!("page" in patch)) next.delete("page");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (pathInput !== filters.path) setFilter({ path: pathInput });
    }, 400);
    return () => clearTimeout(t);
  }, [pathInput, filters.path, setFilter]);

  // Без периода в URL смотрим последние сутки — и сразу фиксируем это в URL,
  // чтобы ссылка указывала на конкретное окно, а не на «последние сутки от
  // момента открытия».
  useEffect(() => {
    if (!filters.from && !filters.to) {
      setFilter({ from: new Date(Date.now() - DAY_MS).toISOString() });
    }
  }, [filters.from, filters.to, setFilter]);

  useEffect(() => {
    api.branches.getAll()
      .then((d) => setBranches(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const branchNames = useMemo(
    () => Object.fromEntries(branches.map((b) => [String(b._id), b.name])),
    [branches]
  );

  // Фильтры без пагинации: и список, и сводка бьются по одному и тому же
  // набору, а page/limit к сводке отношения не имеют.
  const queryFilters = useMemo(() => {
    const rest = { ...filters };
    delete rest.page;
    delete rest.limit;
    return rest;
  }, [filters]);

  // Журнал
  useEffect(() => {
    if (!filters.from && !filters.to) return; // ждём, пока проставится дефолт
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await api.auditLogs.list({
          ...queryFilters,
          page: filters.page || 1,
          limit: filters.limit || 50,
        });
        if (cancelled) return;
        setLogs(Array.isArray(d?.data) ? d.data : []);
        setPagination(d?.pagination || null);
      } catch (e) {
        if (!cancelled) setError(e.message || "Не удалось загрузить журнал");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [queryFilters, filters.page, filters.limit, filters.from, filters.to, reloadKey]);

  // Сводка — по тем же фильтрам, что и таблица: сузив выборку до одного
  // ментора, админ видит статистику именно по нему.
  useEffect(() => {
    if (!filters.from && !filters.to) return;
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const d = await api.auditLogs.stats(queryFilters);
        if (!cancelled) setStats(d);
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [queryFilters, filters.from, filters.to, reloadKey]);

  const applyPreset = (ms) =>
    setFilter({ from: new Date(Date.now() - ms).toISOString(), to: "" });

  const resetFilters = () =>
    setSearchParams({ from: new Date(Date.now() - DAY_MS).toISOString() }, { replace: true });

  const activeFilterCount = useMemo(
    () => FILTER_KEYS.filter(
      (k) => !["from", "to", "page", "limit"].includes(k) && filters[k]
    ).length,
    [filters]
  );

  const page = Number(filters.page) || 1;
  const totalPages = pagination?.totalPages || 0;

  // ─── График ────────────────────────────────────────────────────────────────
  const chart = useMemo(() => {
    const tl = stats?.timeline || [];
    if (tl.length === 0) return null;
    const byDay = stats?.period?.bucketUnit === "day";
    return {
      labels: tl.map((b) =>
        new Date(b._id).toLocaleString("ru-RU",
          byDay ? { day: "2-digit", month: "2-digit" } : { hour: "2-digit", minute: "2-digit" })
      ),
      datasets: [
        {
          label: "Запросы",
          data: tl.map((b) => b.total),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
        },
        {
          label: "Ошибки",
          data: tl.map((b) => b.errors),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.12)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
        },
      ],
    };
  }, [stats]);

  const t = stats?.totals;

  const selectCls =
    "border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center">
          <ScrollText className="w-5 h-5 text-slate-700" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Аудит-лог</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Кто, что и когда делал в системе. Каждый запрос к API.
          </p>
        </div>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
          title="Обновить"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {/* Быстрые срезы — то, ради чего экран и открывают */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold mr-1">Период</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.ms)}
            className="px-2.5 py-1 rounded-full text-xs font-medium border bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            {p.label}
          </button>
        ))}

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <button
          onClick={() => setFilter({ status: "", path: "" })}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
            !filters.status && !filters.path
              ? "bg-gray-800 text-white border-gray-800"
              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Всё
        </button>
        <button
          onClick={() => setFilter({ status: "4xx", path: "" })}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
            filters.status === "4xx" && !filters.path
              ? "bg-amber-500 text-white border-amber-500"
              : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
          }`}
        >
          4xx {t ? `(${t.clientErrors})` : ""}
        </button>
        <button
          onClick={() => setFilter({ status: "5xx", path: "" })}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
            filters.status === "5xx"
              ? "bg-red-500 text-white border-red-500"
              : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
          }`}
        >
          5xx {t ? `(${t.serverErrors})` : ""}
        </button>
        <button
          onClick={() => setFilter({ status: "4xx", path: "login" })}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
            filters.path === "login" && filters.status === "4xx"
              ? "bg-purple-600 text-white border-purple-600"
              : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
          }`}
        >
          <ShieldAlert className="w-3 h-3" />
          Неудачные входы
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={resetFilters}
            className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
          >
            <X className="w-3 h-3" />
            Сбросить фильтры ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Tile label="Запросов" value={statsLoading ? "…" : (t?.requests ?? 0)} />
        <Tile
          label="Доля ошибок"
          value={statsLoading ? "…" : `${t?.errorRate ?? 0}%`}
          tone={(t?.errorRate || 0) > 20 ? "red" : (t?.errorRate || 0) > 5 ? "amber" : "green"}
          hint={t ? `${t.errors} шт.` : null}
        />
        <Tile label="4xx" value={statsLoading ? "…" : (t?.clientErrors ?? 0)} tone="amber" />
        <Tile label="5xx" value={statsLoading ? "…" : (t?.serverErrors ?? 0)} tone="red" />
        <Tile
          label="Средний отклик"
          value={statsLoading ? "…" : fmtDuration(t?.avgDurationMs)}
        />
      </div>

      {/* График динамики */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-4">
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
          Динамика {stats?.period?.bucketUnit === "day" ? "по дням" : "по часам"}
        </h3>
        {chart ? (
          <div className="h-48">
            <Line
              data={chart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: { legend: { display: true, position: "top", labels: { boxWidth: 10, font: { size: 11 } } } },
                scales: {
                  y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } },
                  x: { ticks: { font: { size: 10 }, maxRotation: 0, autoSkipPadding: 20 } },
                },
              }}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-10">
            {statsLoading ? "Загрузка…" : "Нет данных за выбранный период"}
          </p>
        )}
      </div>

      {/* Топы — каждая строка применяет фильтр */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-5">
        <TopTable
          title="Топ акторов"
          rows={stats?.topActors || []}
          empty="Нет данных"
          onPick={(r) => setFilter({ actorId: r._id })}
          renderLabel={(r) => (
            <span className="block truncate">
              {r.name || r._id}
              <span className="text-gray-400 ml-1">{ROLE_LABELS[r.role] || r.kind}</span>
            </span>
          )}
          renderValue={(r) => (
            <span>
              <span className="font-semibold text-gray-800">{r.count}</span>
              {r.errors > 0 && <span className="text-red-500 ml-1.5">{r.errors} ош.</span>}
            </span>
          )}
        />
        <TopTable
          title="Топ эндпоинтов"
          rows={stats?.topRoutes || []}
          empty="Нет данных"
          onPick={(r) => setFilter({ routePattern: r._id.routePattern, method: r._id.method })}
          renderLabel={(r) => (
            <span className="block truncate font-mono text-[11px]">
              <span className={METHOD_CLASS[r._id.method] || ""}>{r._id.method}</span>{" "}
              {r._id.routePattern}
            </span>
          )}
          renderValue={(r) => <span className="font-semibold text-gray-800">{r.count}</span>}
        />
        <TopTable
          title="Топ по ошибкам"
          rows={stats?.topErrorRoutes || []}
          empty="Ошибок нет"
          onPick={(r) => setFilter({ routePattern: r._id.routePattern, method: r._id.method, status: "" })}
          renderLabel={(r) => (
            <span className="block truncate font-mono text-[11px]">
              <span className={METHOD_CLASS[r._id.method] || ""}>{r._id.method}</span>{" "}
              {r._id.routePattern}
            </span>
          )}
          renderValue={(r) => (
            <span>
              {r.clientErrors > 0 && <span className="text-amber-600">{r.clientErrors}</span>}
              {r.clientErrors > 0 && r.serverErrors > 0 && <span className="text-gray-300"> / </span>}
              {r.serverErrors > 0 && <span className="text-red-600 font-semibold">{r.serverErrors}</span>}
            </span>
          )}
        />
        <TopTable
          title="Неудачные входы"
          rows={stats?.failedLogins || []}
          empty="Нет неудачных входов"
          onPick={() => setFilter({ path: "login", status: "4xx" })}
          renderLabel={(r) => (
            <span className="block truncate">
              <span className="italic text-amber-700">{r._id.identifier || "—"}</span>
              <span className="text-gray-400 ml-1 font-mono text-[10px]">{r._id.ip || ""}</span>
            </span>
          )}
          renderValue={(r) => <span className="font-semibold text-red-600">{r.count}</span>}
        />
      </div>

      {/* Фильтры */}
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-4">
        <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <Filter className="w-3 h-3" /> Фильтры
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">С</label>
            <input
              type="datetime-local"
              className={selectCls}
              value={toLocalInput(filters.from)}
              onChange={(e) => setFilter({ from: fromLocalInput(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">По</label>
            <input
              type="datetime-local"
              className={selectCls}
              value={toLocalInput(filters.to)}
              onChange={(e) => setFilter({ to: fromLocalInput(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">Вид</label>
            <select className={selectCls} value={filters.kind} onChange={(e) => setFilter({ kind: e.target.value })}>
              <option value="">Все</option>
              <option value="mentor">Ментор</option>
              <option value="intern">Стажёр</option>
              <option value="anonymous">Аноним</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">Роль</label>
            <select className={selectCls} value={filters.role} onChange={(e) => setFilter({ role: e.target.value })}>
              <option value="">Все</option>
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">Метод</label>
            <select className={selectCls} value={filters.method} onChange={(e) => setFilter({ method: e.target.value })}>
              <option value="">Все</option>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">Статус</label>
            <select className={selectCls} value={filters.status} onChange={(e) => setFilter({ status: e.target.value })}>
              <option value="">Все</option>
              <option value="2xx">2xx — успех</option>
              <option value="4xx">4xx — клиент</option>
              <option value="5xx">5xx — сервер</option>
              <option value="401">401 — не авторизован</option>
              <option value="403">403 — запрещено</option>
              <option value="404">404 — не найдено</option>
              <option value="429">429 — rate limit</option>
              <option value="500">500 — ошибка сервера</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">Филиал</label>
            <select className={selectCls} value={filters.branchId} onChange={(e) => setFilter({ branchId: e.target.value })}>
              <option value="">Все</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">ID актора</label>
            <input
              type="text"
              placeholder="ObjectId"
              className={`${selectCls} font-mono w-[190px]`}
              value={filters.actorId}
              onChange={(e) => setFilter({ actorId: e.target.value.trim() })}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[11px] text-gray-500">Шаблон роута</label>
            <input
              type="text"
              placeholder="/api/interns/:id"
              className={`${selectCls} font-mono w-[190px]`}
              value={filters.routePattern}
              onChange={(e) => setFilter({ routePattern: e.target.value.trim() })}
            />
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-[170px]">
            <label className="text-[11px] text-gray-500">Поиск по пути</label>
            <input
              type="text"
              placeholder="часть URL, напр. login"
              className={`${selectCls} w-full`}
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Журнал */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-xs uppercase tracking-wide">
              <th className="px-3 py-2 font-semibold text-gray-500 whitespace-nowrap">Время</th>
              <th className="px-3 py-2 font-semibold text-gray-500">Актор</th>
              <th className="px-3 py-2 font-semibold text-gray-500">Запрос</th>
              <th className="px-3 py-2 font-semibold text-gray-500">Статус</th>
              <th className="px-3 py-2 font-semibold text-gray-500 text-right">Время&nbsp;отв.</th>
              <th className="px-3 py-2 font-semibold text-gray-500">Филиал</th>
              <th className="px-3 py-2 font-semibold text-gray-500">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-12">
                  <div className="flex justify-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <ScrollText className="w-10 h-10 opacity-30" />
                    <p className="font-medium text-gray-500">Записей не найдено</p>
                    <p className="text-xs">Расширьте период или снимите фильтры</p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr
                  key={l._id}
                  onClick={() => setSelected(l)}
                  className={`cursor-pointer transition-colors ${
                    l.statusCode >= 500 ? "bg-red-50/40 hover:bg-red-50"
                      : l.statusCode >= 400 ? "hover:bg-amber-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap text-xs font-mono">
                    {fmtTime(l.createdAt)}
                  </td>
                  <td className="px-3 py-1.5 text-sm max-w-[220px]">
                    <ActorCell actor={l.actor} />
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs max-w-[340px]">
                    <span className={`font-semibold ${METHOD_CLASS[l.method] || "text-gray-600"}`}>
                      {l.method}
                    </span>{" "}
                    <span className="text-gray-700">{l.routePattern || l.path}</span>
                    {l.error && (
                      <span className="block text-[11px] text-red-500 truncate font-sans">
                        {l.error}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded border text-xs font-semibold ${statusClass(l.statusCode)}`}>
                      {l.statusCode}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs text-gray-500 whitespace-nowrap">
                    {fmtDuration(l.durationMs)}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-gray-500 whitespace-nowrap">
                    {branchNames[String(l.branchId)] || "—"}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-gray-400 font-mono whitespace-nowrap">
                    {l.ip || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Пагинация */}
        {!loading && pagination && pagination.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              {(page - 1) * pagination.limit + 1}–
              {Math.min(page * pagination.limit, pagination.total)} из {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <select
                className="border border-gray-200 rounded px-1.5 py-1 text-xs bg-white"
                value={filters.limit || "50"}
                onChange={(e) => setFilter({ limit: e.target.value })}
                title="Записей на странице (потолок API — 200)"
              >
                {[25, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>{n} / стр.</option>
                ))}
              </select>
              <button
                onClick={() => setFilter({ page: page - 1 })}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3 h-3" /> Назад
              </button>
              <span className="text-xs text-gray-500">{page} / {totalPages || 1}</span>
              <button
                onClick={() => setFilter({ page: page + 1 })}
                disabled={!pagination.hasMore}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Вперёд <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <DetailModal
          log={selected}
          branchName={branchNames[String(selected.branchId)]}
          onClose={() => setSelected(null)}
          onFilter={(patch) => { setFilter(patch); setSelected(null); }}
        />
      )}
    </div>
  );
};

export default AuditLog;
