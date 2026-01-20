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
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
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
  console.log(stats);
  const filteredStats =
    selectedBranch === "all"
      ? stats
      : stats.filter((s) => s.branchId === selectedBranch);

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
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Интерн</th>
                    <th>Посещено уроков</th>
                    <th>Норма</th>
                    <th>% нормы</th>
                    <th>Выполняет норму</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.map((stat) => (
                    <tr
                      key={stat.internId}
                      className={stat.meetsNorm === false ? "bg-red-100" : ""} // Handle null
                    >
                      <td>{stat.name}</td>
                      <td>{stat.attended}</td>
                      <td>{stat.norm ?? "N/A"}</td>
                      <td>{stat.percentage ?? "N/A"}%</td>
                      <td>
                        {stat.meetsNorm === null
                          ? "N/A"
                          : stat.meetsNorm
                          ? "✅"
                          : "❌"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredStats.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">График посещаемости</h3>
                <Bar
                  data={{
                    labels: filteredStats.map((s) => s.name),
                    datasets: [
                      {
                        label: "Посещено уроков",
                        data: filteredStats.map((s) => s.attended),
                        backgroundColor: "rgba(75, 192, 192, 0.6)",
                        borderColor: "rgba(75, 192, 192, 1)",
                        borderWidth: 1,
                      },
                      {
                        label: "Норма",
                        data: filteredStats.map((s) => s.norm ?? 0), // Per-intern norm; 0 if null
                        backgroundColor: "rgba(255, 99, 132, 0.3)",
                        borderColor: "rgba(255, 99, 132, 1)",
                        borderWidth: 1,
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
                        text: `Посещаемость за ${
                          period === "month"
                            ? "текущий месяц"
                            : period === "prevMonth"
                            ? "прошлый месяц"
                            : period === "week"
                            ? "неделю"
                            : "период"
                        }`,
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
