import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { api } from "../../utils/api";
import InternsTable from "./InternsTable";
import InternsCardList from "./InternsCardList";
import InternFormModal from "./InternFormModal";
import ViolationsModal from "./ViolationsModal";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  BarController,
} from "chart.js";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  BarController
);

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

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [internsData, branchesData, mentorsData, rulesData] =
          await Promise.all([
            api.interns.getAll(),
            api.branches.getAll(),
            api.mentors.getAll(),
            api.rules.getAll(),
          ]);
        setInterns(internsData);
        setBranches(branchesData);
        setMentors(mentorsData);
        setRules(Array.isArray(rulesData) ? rulesData : rulesData.data || []);
      } catch (error) {
        setError(error.message || "Ошибка при загрузке начальных данных");
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [period]);

  useEffect(() => {
    if (period === "custom") {
      fetchStats();
    }
  }, [startDate, endDate]);

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
    } catch (error) {
      setError(error.message || "Ошибка при загрузке статистики");
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      await api.interns.delete(id);
      const [internsData] = await Promise.all([api.interns.getAll()]);
      setInterns(internsData);
      await fetchStats();
    } catch (error) {
      setError(error.message || "Ошибка при удалении стажёра");
      console.error("Error deleting intern:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }
  console.log(stats[0]);
  const filteredStats =
    selectedBranch === "all"
      ? stats
      : stats.filter((s) => s.branchId === selectedBranch);

  // 🔹 Применяем быстрый фильтр
  const quickFilteredStats = filteredStats.filter((stat) => {
    if (quickFilter === "all") return true;
    if (quickFilter === "nearDeadline") return stat.nearDeadline || stat.isOverdue;
    if (quickFilter === "concession") return stat.canPromoteWithConcession;
    if (quickFilter === "meetsNorm") return stat.meetsNorm;
    return true;
  });

  return (
    <div className="p-6">
      {error && (
        <div className="alert alert-error mb-4">
          {error}
          <button
            className="btn btn-sm btn-circle"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Интерны</h1>
        <button
          className="btn btn-primary gap-2"
          onClick={() => {
            setSelectedIntern(null);
            setShowFormModal(true);
          }}
        >
          <Plus className="h-4 w-4" /> Добавить интерна
        </button>
      </div>

      <InternsTable
        interns={interns}
        branches={branches}
        mentors={mentors}
        rules={rules}
        onEdit={(intern) => {
          setSelectedIntern(intern);
          setShowFormModal(true);
        }}
        onDelete={handleDelete}
        onViolations={(intern) => {
          setSelectedIntern(intern);
          setShowViolationsModal(true);
        }}
        refresh={async () => {
          const [internsData] = await Promise.all([api.interns.getAll()]);
          setInterns(internsData);
          await fetchStats();
        }}
      />

      {/* 📊 Панель рекомендаций */}
      {!loadingStats && stats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div
            className="stats shadow bg-orange-100 border border-orange-300 cursor-pointer hover:shadow-lg transition"
            onClick={() => setQuickFilter("concession")}
          >
            <div className="stat">
              <div className="stat-figure text-orange-600">
                <span className="text-4xl">🎁</span>
              </div>
              <div className="stat-title">Кандидаты на уступку</div>
              <div className="stat-value text-orange-600">
                {stats.filter((s) => s.canPromoteWithConcession).length}
              </div>
              <div className="stat-desc">50-60% + близко к дедлайну</div>
            </div>
          </div>

          <div
            className="stats shadow bg-yellow-100 border border-yellow-300 cursor-pointer hover:shadow-lg transition"
            onClick={() => setQuickFilter("nearDeadline")}
          >
            <div className="stat">
              <div className="stat-figure text-yellow-600">
                <span className="text-4xl">⚠️</span>
              </div>
              <div className="stat-title">Близкие к дедлайну</div>
              <div className="stat-value text-yellow-600">
                {stats.filter((s) => s.nearDeadline || s.isOverdue).length}
              </div>
              <div className="stat-desc">Включая просроченные</div>
            </div>
          </div>

          <div
            className="stats shadow bg-green-100 border border-green-300 cursor-pointer hover:shadow-lg transition"
            onClick={() => setQuickFilter("meetsNorm")}
          >
            <div className="stat">
              <div className="stat-figure text-green-600">
                <span className="text-4xl">✅</span>
              </div>
              <div className="stat-title">Выполняют норму</div>
              <div className="stat-value text-green-600">
                {stats.filter((s) => s.meetsNorm).length}
              </div>
              <div className="stat-desc">≥100% плана</div>
            </div>
          </div>

          <div
            className="stats shadow bg-blue-100 border border-blue-300 cursor-pointer hover:shadow-lg transition"
            onClick={() => setQuickFilter("all")}
          >
            <div className="stat">
              <div className="stat-figure text-blue-600">
                <span className="text-4xl">📊</span>
              </div>
              <div className="stat-title">Всего интернов</div>
              <div className="stat-value text-blue-600">{stats.length}</div>
              <div className="stat-desc">В системе</div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Статистика посещаемости</h2>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="select select-bordered"
          >
            <option value="month">Месяц</option>
            <option value="week">Неделя</option>
            <option value="custom">Период</option>
            <option value="month_prev">Прошлый месяц</option>
          </select>

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="select select-bordered"
          >
            <option value="all">Все филиалы</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        {period === "custom" && (
          <div className="flex gap-4 mb-4">
            <div>
              <label className="label">Начальная дата</label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                className="input input-bordered w-full"
                dateFormat="yyyy-MM-dd"
              />
            </div>
            <div>
              <label className="label">Конечная дата</label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate}
                className="input input-bordered w-full"
                dateFormat="yyyy-MM-dd"
              />
            </div>
          </div>
        )}

        {loadingStats ? (
          <div className="flex justify-center items-center h-32">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        ) : (
          <>
            <div className="alert alert-info mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <h3 className="font-bold">Как рассчитывается норма?</h3>
                <div className="text-sm">
                  Норма для каждого интерна рассчитывается индивидуально на основе:
                  <ul className="list-disc list-inside mt-1">
                    <li><strong>Грейда:</strong> Junior (24/мес), Strong Junior (40), Middle (50), Strong Middle (60), Senior (80)</li>
                    <li><strong>Дней работы:</strong> Сколько дней УЖЕ проработал с момента найма или повышения</li>
                    <li><strong>Испытательный период:</strong> Junior/Strong Junior (1 мес), Middle/Strong Middle (2 мес), Senior (3 мес)</li>
                  </ul>
                  <div className="mt-1 font-mono text-xs bg-base-200 p-1 rounded inline-block">
                    Норма = (дни_уже_проработанные / 30) × уроков_по_грейду
                  </div>
                  <p className="mt-2 text-xs opacity-75">
                    💡 Новички не обязаны выполнять полную месячную норму, если работают меньше месяца
                  </p>
                  <p className="mt-1 text-xs opacity-75">
                    🎁 Оранжевая подсветка = можно повысить с уступкой (50-60% + близко к дедлайну)
                  </p>
                </div>
              </div>
            </div>

            {/* 🔹 Кнопки быстрой фильтрации */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                className={`btn btn-sm ${quickFilter === "all" ? "btn-primary" : "btn-outline"
                  }`}
                onClick={() => setQuickFilter("all")}
              >
                Все интерны ({filteredStats.length})
              </button>
              <button
                className={`btn btn-sm ${quickFilter === "nearDeadline" ? "btn-warning" : "btn-outline btn-warning"
                  }`}
                onClick={() => setQuickFilter("nearDeadline")}
              >
                ⚠️ Близкие к дедлайну ({filteredStats.filter(s => s.nearDeadline || s.isOverdue).length})
              </button>
              <button
                className={`btn btn-sm ${quickFilter === "concession" ? "btn-accent" : "btn-outline btn-accent"
                  }`}
                onClick={() => setQuickFilter("concession")}
              >
                🎁 Кандидаты на уступку ({filteredStats.filter(s => s.canPromoteWithConcession).length})
              </button>
              <button
                className={`btn btn-sm ${quickFilter === "meetsNorm" ? "btn-success" : "btn-outline btn-success"
                  }`}
                onClick={() => setQuickFilter("meetsNorm")}
              >
                ✅ Выполняют норму ({filteredStats.filter(s => s.meetsNorm).length})
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Интерн</th>
                    <th>Грейд</th>
                    <th>Оценённые</th>
                    <th>Ожидают оценки</th>
                    <th>Норма</th>
                    <th>% выполнения</th>
                    <th>Срок грейда</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {quickFilteredStats.map((stat) => {
                    const percentage = stat.percentage || 0;
                    let rowColor = "";

                    // 🎁 Приоритет: возможность уступки
                    if (stat.canPromoteWithConcession) {
                      rowColor = "bg-orange-100 border-l-4 border-orange-500";
                    } else if (percentage >= 100) {
                      rowColor = "bg-green-50";
                    } else if (percentage >= 70) {
                      rowColor = "bg-yellow-50";
                    } else if (percentage > 0) {
                      rowColor = "bg-red-50";
                    }

                    // ⚠️ Дополнительное предупреждение о дедлайне
                    if (stat.nearDeadline && !stat.canPromoteWithConcession && percentage < 70) {
                      rowColor += " border-l-4 border-yellow-600";
                    }

                    return (
                      <tr key={stat.internId} className={rowColor}>
                        <td className="font-medium">{stat.name}</td>
                        <td>
                          <span className="badge badge-sm">
                            {stat.grade}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-success badge-sm">
                            {stat.confirmedCount}
                          </span>
                        </td>
                        <td>
                          {stat.pendingCount > 0 ? (
                            <span className="badge badge-warning badge-sm">
                              {stat.pendingCount}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td>{stat.norm ?? "—"}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{percentage}%</span>
                            {stat.canPromoteWithConcession && (
                              <span className="text-xl" title="Можно повысить с уступкой (50-60% + близко к дедлайну)">🎁</span>
                            )}
                            {!stat.canPromoteWithConcession && (
                              percentage >= 100 ? (
                                <span className="text-green-600">✓</span>
                              ) : percentage >= 70 ? (
                                <span className="text-yellow-600">⚠</span>
                              ) : (
                                <span className="text-red-600">✗</span>
                              )
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span className="font-semibold">
                              {stat.daysWorking} / {stat.trialPeriodDays} дн.
                            </span>
                            {stat.nearDeadline && (
                              <span className="text-xs text-warning font-semibold">
                                ⚠ {stat.daysRemaining} дн. осталось
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {stat.meetsNorm === null ? (
                            "—"
                          ) : stat.meetsNorm ? (
                            <span className="text-green-600 font-semibold">Выполняет</span>
                          ) : (
                            <span className="text-red-600 font-semibold">Не выполняет</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {quickFilteredStats.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">График посещаемости</h3>
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
                            ? "rgba(251, 146, 60, 0.6)" // Оранжевый для уступки
                            : "rgba(34, 197, 94, 0.6)"  // Зелёный обычный
                        ),
                        borderColor: quickFilteredStats.map((s) =>
                          s.canPromoteWithConcession
                            ? "rgba(251, 146, 60, 1)"
                            : "rgba(34, 197, 94, 1)"
                        ),
                        borderWidth: 1,
                      },
                      {
                        label: "Ожидают оценки",
                        data: quickFilteredStats.map((s) => s.pendingCount),
                        backgroundColor: "rgba(251, 191, 36, 0.6)",
                        borderColor: "rgba(251, 191, 36, 1)",
                        borderWidth: 1,
                      },
                      {
                        label: "Норма",
                        data: quickFilteredStats.map((s) => s.norm ?? 0),
                        backgroundColor: "rgba(239, 68, 68, 0.3)",
                        borderColor: "rgba(239, 68, 68, 1)",
                        borderWidth: 2,
                        type: "line",
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: { display: true, text: "Количество уроков" },
                      },
                      x: {
                        title: { display: true, text: "Интерны" },
                      },
                    },
                    plugins: {
                      legend: { display: true },
                      title: {
                        display: true,
                        text: `Посещаемость за ${period === "month"
                          ? "текущий месяц"
                          : period === "prevMonth"
                            ? "прошлый месяц"
                            : period === "week"
                              ? "неделю"
                              : "период"
                          }`,
                      },
                      tooltip: {
                        callbacks: {
                          afterLabel: function (context) {
                            const stat = quickFilteredStats[context.dataIndex];
                            let extra = [];
                            if (stat.canPromoteWithConcession) {
                              extra.push("🎁 Кандидат на уступку");
                            }
                            if (stat.nearDeadline) {
                              extra.push(`⚠️ ${stat.daysRemaining} дн. до дедлайна`);
                            }
                            if (extra.length > 0) {
                              return extra.join("\n");
                            }
                            return "";
                          },
                        },
                      },
                    },
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {showFormModal && (
        <InternFormModal
          initialData={selectedIntern}
          onClose={() => setShowFormModal(false)}
          refresh={async () => {
            const [internsData] = await Promise.all([api.interns.getAll()]);
            setInterns(internsData);
            await fetchStats();
          }}
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
