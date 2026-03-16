import React, { useState, useEffect, useMemo } from "react";
import {
  Plus, Gift, AlertTriangle, CheckCircle, Users,
  ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";
import { api } from "../../utils/api";
import InternsTable from "./InternsTable";
import InternFormModal from "./InternFormModal";
import ViolationsModal from "./ViolationsModal";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, PointElement, LineElement,
  Title, Tooltip, Legend,
  LineController, BarController,
} from "chart.js";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, PointElement, LineElement,
  Title, Tooltip, Legend,
  LineController, BarController
);

// ─── Stat Pill ────────────────────────────────────────────────────────────────
const StatPill = ({ icon: Icon, label, desc, value, color, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 min-w-[140px] flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all text-left shadow-sm ${
      active
        ? `${color.activeBg} ${color.activeBorder} ring-2 ${color.ring}`
        : `bg-white border-slate-100 hover:border-slate-200 hover:shadow`
    }`}
  >
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color.icon}`}>
      <Icon className="w-4 h-4 text-white" />
    </div>
    <div className="min-w-0">
      <p className={`text-xl font-bold leading-none ${active ? color.value : "text-slate-900"}`}>
        {value}
      </p>
      <p className="text-xs text-slate-500 mt-0.5 truncate">{label}</p>
      {desc && <p className="text-xs text-slate-400 truncate">{desc}</p>}
    </div>
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const QUICK_FILTERS = [
  { key: "all",         label: "Все" },
  { key: "nearDeadline",label: "Близко к дедлайну" },
  { key: "concession",  label: "Кандидаты на уступку" },
  { key: "meetsNorm",   label: "Выполняют норму" },
];

const Interns = () => {
  const [interns, setInterns] = useState([]);
  const [branches, setBranches] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [rules, setRules] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViolationsModal, setShowViolationsModal] = useState(false);
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [period, setPeriod] = useState("month");
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [endDate, setEndDate] = useState(new Date());
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [showNormInfo, setShowNormInfo] = useState(false);

  // ── Data Fetching ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [internsData, branchesData, mentorsData, rulesData] = await Promise.all([
          api.interns.getAll(),
          api.branches.getAll(),
          api.mentors.getAll(),
          api.rules.getAll(),
        ]);
        setInterns(internsData);
        setBranches(branchesData);
        setMentors(mentorsData);
        setRules(Array.isArray(rulesData) ? rulesData : rulesData.data || []);
      } catch (err) {
        setError(err.message || "Ошибка при загрузке данных");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const params =
        period === "custom"
          ? { startDate, endDate }
          : period === "month_prev"
          ? { period: "month", prevMonth: true }
          : { period };
      const data = await api.lessons.getAttendanceStats(params);
      setStats(data.stats || data);
    } catch (err) {
      setError(err.message || "Ошибка при загрузке статистики");
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => { fetchStats(); }, [period]);
  useEffect(() => { if (period === "custom") fetchStats(); }, [startDate, endDate]);

  // ── Refresh helpers ──────────────────────────────────────────────────────────
  const refreshInterns = async () => {
    const data = await api.interns.getAll();
    setInterns(data);
    await fetchStats();
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      await api.interns.delete(id);
      await refreshInterns();
    } catch (err) {
      setError(err.message || "Ошибка при удалении стажёра");
    } finally {
      setLoading(false);
    }
  };

  // ── Derived stats ────────────────────────────────────────────────────────────
  const filteredStats = useMemo(
    () => (selectedBranch === "all" ? stats : stats.filter((s) => s.branchId === selectedBranch)),
    [stats, selectedBranch]
  );

  const quickFilteredStats = useMemo(
    () =>
      filteredStats.filter((stat) => {
        if (quickFilter === "nearDeadline") return stat.nearDeadline || stat.isOverdue;
        if (quickFilter === "concession") return stat.canPromoteWithConcession;
        if (quickFilter === "meetsNorm") return stat.meetsNorm;
        return true;
      }),
    [filteredStats, quickFilter]
  );

  const statMeta = useMemo(
    () => ({
      total:      filteredStats.length,
      meetsNorm:  filteredStats.filter((s) => s.meetsNorm).length,
      near:       filteredStats.filter((s) => s.nearDeadline || s.isOverdue).length,
      concession: filteredStats.filter((s) => s.canPromoteWithConcession).length,
    }),
    [filteredStats]
  );

  // ── Loading / Error ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3 text-slate-400">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-sm">Загрузка данных...</p>
      </div>
    );
  }

  const PERIOD_LABEL = {
    month: "текущий месяц",
    week: "неделю",
    month_prev: "прошлый месяц",
    custom: "период",
  };

  return (
    <div className="p-6 space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-700">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="text-sm flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-0.5 hover:bg-red-100 rounded-lg transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Интерны</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {interns.length} стажёра в системе
          </p>
        </div>
        <button
          onClick={() => { setSelectedIntern(null); setShowFormModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Добавить интерна
        </button>
      </div>

      {/* Stat Pills (from stats, click to filter) */}
      {!loadingStats && stats.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <StatPill
            icon={Users} label="Всего в статистике" value={statMeta.total}
            active={quickFilter === "all"} onClick={() => setQuickFilter("all")}
            color={{ icon: "bg-blue-500", value: "text-blue-600", activeBg: "bg-blue-50", activeBorder: "border-blue-300", ring: "ring-blue-200" }}
          />
          <StatPill
            icon={CheckCircle} label="Выполняют норму" desc="≥ 100% плана"
            value={statMeta.meetsNorm} active={quickFilter === "meetsNorm"}
            onClick={() => setQuickFilter("meetsNorm")}
            color={{ icon: "bg-green-500", value: "text-green-600", activeBg: "bg-green-50", activeBorder: "border-green-300", ring: "ring-green-200" }}
          />
          <StatPill
            icon={AlertTriangle} label="Близко к дедлайну" desc="Включая просроченных"
            value={statMeta.near} active={quickFilter === "nearDeadline"}
            onClick={() => setQuickFilter("nearDeadline")}
            color={{ icon: "bg-amber-500", value: "text-amber-600", activeBg: "bg-amber-50", activeBorder: "border-amber-300", ring: "ring-amber-200" }}
          />
          <StatPill
            icon={Gift} label="Кандидаты на уступку" desc="50–60% + близко к дедлайну"
            value={statMeta.concession} active={quickFilter === "concession"}
            onClick={() => setQuickFilter("concession")}
            color={{ icon: "bg-orange-500", value: "text-orange-600", activeBg: "bg-orange-50", activeBorder: "border-orange-300", ring: "ring-orange-200" }}
          />
        </div>
      )}

      {/* Interns Table */}
      <InternsTable
        interns={interns}
        branches={branches}
        mentors={mentors}
        rules={rules}
        onEdit={(intern) => { setSelectedIntern(intern); setShowFormModal(true); }}
        onDelete={handleDelete}
        onViolations={(intern) => { setSelectedIntern(intern); setShowViolationsModal(true); }}
        refresh={refreshInterns}
      />

      {/* ── Attendance Stats Section ─────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Section header */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Статистика посещаемости</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="month">Текущий месяц</option>
              <option value="week">Неделя</option>
              <option value="month_prev">Прошлый месяц</option>
              <option value="custom">Период</option>
            </select>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">Все филиалы</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
            <button
              onClick={fetchStats}
              disabled={loadingStats}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
              title="Обновить"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStats ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Custom date range */}
        {period === "custom" && (
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-4">
            {[
              { label: "Начало", value: startDate, onChange: setStartDate, selectsStart: true },
              { label: "Конец",  value: endDate,   onChange: setEndDate,   selectsEnd: true, minDate: startDate },
            ].map(({ label, value, onChange, ...rest }) => (
              <div key={label}>
                <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
                <DatePicker
                  selected={value}
                  onChange={onChange}
                  startDate={startDate}
                  endDate={endDate}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-36"
                  dateFormat="yyyy-MM-dd"
                  {...rest}
                />
              </div>
            ))}
          </div>
        )}

        {loadingStats ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* How norm is calculated — collapsible */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowNormInfo((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>Как рассчитывается норма?</span>
                {showNormInfo ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
              {showNormInfo && (
                <div className="px-4 pb-4 text-sm text-slate-600 border-t border-slate-100 pt-3 space-y-2">
                  <p>Норма рассчитывается индивидуально на основе:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-500">
                    <li><strong className="text-slate-700">Грейда:</strong> Junior (24/мес), Strong Junior (40), Middle (50), Strong Middle (60), Senior (80)</li>
                    <li><strong className="text-slate-700">Дней работы:</strong> сколько дней уже проработал с момента найма или повышения</li>
                    <li><strong className="text-slate-700">Испытательный период:</strong> Junior/Strong Junior — 1 мес, Middle/Strong Middle — 2 мес, Senior — 3 мес</li>
                  </ul>
                  <p className="font-mono text-xs bg-slate-100 rounded-lg px-3 py-2 inline-block">
                    Норма = (дни_проработанные / 30) × уроков_по_грейду
                  </p>
                  <p className="text-xs text-slate-400">
                    Оранжевая подсветка = можно повысить с уступкой (50–60% + близко к дедлайну)
                  </p>
                </div>
              )}
            </div>

            {/* Quick filter tabs */}
            <div className="flex flex-wrap gap-2">
              {QUICK_FILTERS.map(({ key, label }) => {
                const count =
                  key === "all" ? filteredStats.length
                  : key === "nearDeadline" ? filteredStats.filter((s) => s.nearDeadline || s.isOverdue).length
                  : key === "concession" ? filteredStats.filter((s) => s.canPromoteWithConcession).length
                  : filteredStats.filter((s) => s.meetsNorm).length;
                return (
                  <button
                    key={key}
                    onClick={() => setQuickFilter(key)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-xl border transition-colors ${
                      quickFilter === key
                        ? "bg-blue-500 text-white border-blue-500"
                        : "text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Stats table */}
            {quickFilteredStats.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Нет данных для выбранного фильтра</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {["Интерн", "Грейд", "Оценённые", "Ожидают", "Норма", "% выполнения", "Срок", "Статус"].map(
                          (h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {quickFilteredStats.map((stat) => {
                        const pct = stat.percentage || 0;
                        const rowBg = stat.canPromoteWithConcession
                          ? "bg-orange-50"
                          : pct >= 100
                          ? "bg-green-50/60"
                          : pct >= 70
                          ? "bg-yellow-50/60"
                          : pct > 0
                          ? "bg-red-50/40"
                          : "";
                        const leftBorder = stat.canPromoteWithConcession
                          ? "border-l-4 border-l-orange-400"
                          : stat.nearDeadline && pct < 70
                          ? "border-l-4 border-l-amber-400"
                          : "";

                        return (
                          <tr key={stat.internId} className={`${rowBg} ${leftBorder}`}>
                            <td className="px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                              {stat.name}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                {stat.grade}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                {stat.confirmedCount}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {stat.pendingCount > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                  {stat.pendingCount}
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-slate-700">{stat.norm ?? "—"}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold">{pct}%</span>
                                {stat.canPromoteWithConcession ? (
                                  <Gift className="w-3.5 h-3.5 text-orange-500" title="Кандидат на уступку" />
                                ) : pct >= 100 ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                ) : pct >= 70 ? (
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                ) : (
                                  <span className="text-red-500 text-xs font-bold">✗</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div>
                                <span className="font-medium text-slate-700">
                                  {stat.daysWorking} / {stat.trialPeriodDays} дн.
                                </span>
                                {stat.nearDeadline && (
                                  <p className="text-xs text-amber-600 font-medium">
                                    ⚠ {stat.daysRemaining} дн. осталось
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              {stat.meetsNorm === null ? (
                                <span className="text-slate-400">—</span>
                              ) : stat.meetsNorm ? (
                                <span className="text-xs font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                                  Выполняет
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-red-700 bg-red-100 rounded-full px-2 py-0.5">
                                  Не выполняет
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Chart */}
                <div className="pt-2">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">
                    График посещаемости — {PERIOD_LABEL[period]}
                  </h3>
                  <Bar
                    key={`chart-${period}-${selectedBranch}`}
                    data={{
                      labels: quickFilteredStats.map((s) => s.name),
                      datasets: [
                        {
                          label: "Оценённые уроки",
                          data: quickFilteredStats.map((s) => s.confirmedCount),
                          backgroundColor: quickFilteredStats.map((s) =>
                            s.canPromoteWithConcession
                              ? "rgba(251,146,60,0.6)"
                              : "rgba(34,197,94,0.6)"
                          ),
                          borderColor: quickFilteredStats.map((s) =>
                            s.canPromoteWithConcession
                              ? "rgba(251,146,60,1)"
                              : "rgba(34,197,94,1)"
                          ),
                          borderWidth: 1,
                        },
                        {
                          label: "Ожидают оценки",
                          data: quickFilteredStats.map((s) => s.pendingCount),
                          backgroundColor: "rgba(251,191,36,0.6)",
                          borderColor: "rgba(251,191,36,1)",
                          borderWidth: 1,
                        },
                        {
                          label: "Норма",
                          data: quickFilteredStats.map((s) => s.norm ?? 0),
                          backgroundColor: "rgba(239,68,68,0.2)",
                          borderColor: "rgba(239,68,68,1)",
                          borderWidth: 2,
                          type: "line",
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      scales: {
                        y: { beginAtZero: true, title: { display: true, text: "Уроков" } },
                        x: { title: { display: true, text: "Интерны" } },
                      },
                      plugins: {
                        legend: { display: true },
                        tooltip: {
                          callbacks: {
                            afterLabel(context) {
                              const stat = quickFilteredStats[context.dataIndex];
                              const lines = [];
                              if (stat.canPromoteWithConcession) lines.push("🎁 Кандидат на уступку");
                              if (stat.nearDeadline) lines.push(`⚠️ ${stat.daysRemaining} дн. до дедлайна`);
                              return lines.join("\n") || "";
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showFormModal && (
        <InternFormModal
          initialData={selectedIntern}
          onClose={() => setShowFormModal(false)}
          refresh={refreshInterns}
          branches={branches}
          mentors={mentors}
          rules={rules}
        />
      )}
      {showViolationsModal && selectedIntern && (
        <ViolationsModal
          intern={selectedIntern}
          rules={rules}
          onClose={() => setShowViolationsModal(false)}
        />
      )}
    </div>
  );
};

export default Interns;
