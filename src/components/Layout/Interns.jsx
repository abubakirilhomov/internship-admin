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
  const [error, setError] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViolationsModal, setShowViolationsModal] = useState(false);
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [period, setPeriod] = useState("month"); // Для фильтра статистики
  const [grades, setGrades] = useState({});

  useEffect(() => {
    fetchInterns();
    fetchBranches();
    fetchMentors();
    fetchRules();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [period]); // Обновлять статистику при смене периода

  const fetchInterns = async () => {
    try {
      setLoading(true);
      const data = await api.interns.getAll();
      setInterns(data);
    } catch (error) {
      setError(error.message || "Ошибка при загрузке интернов");
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const data = await api.branches.getAll();
      setBranches(data);
    } catch (error) {
      setError(error.message || "Ошибка при загрузке филиалов");
    }
  };

  const fetchMentors = async () => {
    try {
      const data = await api.mentors.getAll();
      setMentors(data);
    } catch (error) {
      setError(error.message || "Ошибка при загрузке менторов");
    }
  };

  const fetchRules = async () => {
    try {
      const res = await api.rules.getAll();
      setRules(Array.isArray(res) ? res : res.data || []);
    } catch (error) {
      setError(error.message || "Ошибка при загрузке правил");
    }
  };

  const fetchStats = async () => {
    try {
      // Pass period as query param; add custom if needed
      const params = period === "custom" ? { startDate: "2025-09-01", endDate: "2025-09-13" } : { period };
      const data = await api.lessons.getAttendanceStats(params);
      setStats(data.stats || data); // Fallback if direct array
      setGrades(data.grades || {});
    } catch (error) {
      setError(error.message || "Ошибка при загрузке статистики");
    }
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      await api.interns.delete(id);
      await fetchInterns();
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
        refresh={fetchInterns}
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
            <option value="custom">Период</option> {/* Optional: Add if using start/end */}
          </select>
        </div>
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
              {stats.map((stat) => (
                <tr
                  key={stat.internId}
                  className={stat.meetsNorm === false ? "bg-red-100" : ""} // Handle null
                >
                  <td>{stat.name}</td>
                  <td>{stat.attended}</td>
                  <td>{stat.norm ?? "N/A"}</td>
                  <td>{stat.percentage ?? "N/A"}%</td>
                  <td>{stat.meetsNorm === null ? "N/A" : stat.meetsNorm ? "✅" : "❌"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {stats.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-bold mb-4">График посещаемости</h3>
          <Bar
            data={{
              labels: stats.map((s) => s.name),
              datasets: [
                {
                  label: "Посещено уроков",
                  data: stats.map((s) => s.attended),
                  backgroundColor: "rgba(75, 192, 192, 0.6)",
                  borderColor: "rgba(75, 192, 192, 1)",
                  borderWidth: 1,
                },
                {
                  label: "Норма",
                  data: stats.map((s) => s.norm ?? 0), // Per-intern norm; 0 if null
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
                    period === "month" ? "месяц" : period === "week" ? "неделю" : "период"
                  }`,
                },
              },
            }}
          />
        </div>
      )}

      {showFormModal && (
        <InternFormModal
          initialData={selectedIntern}
          onClose={() => setShowFormModal(false)}
          refresh={() => {
            fetchInterns();
            fetchStats();
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

// Reference functions (unused in chart now, but kept for legacy)
const calculateMonthlyNorm = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let sundays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    if (d.getDay() === 0) sundays++; // Sunday
  }
  return (daysInMonth - sundays) * 2;
};

const calculateNorm = (period) => {
  if (period === "week") return 12; // Legacy: 2 lessons * 6 days
  return calculateMonthlyNorm(new Date());
};

export default Interns;
