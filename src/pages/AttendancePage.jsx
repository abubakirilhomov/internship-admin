import React, { useState, useEffect, useMemo } from "react";
import { api } from "../utils/api";

const GRADE_LABELS = {
  junior: "Junior",
  strongJunior: "Strong Junior",
  middle: "Middle",
  strongMiddle: "Strong Middle",
  senior: "Senior",
};

const GRADE_COLORS = {
  junior: "bg-green-100 text-green-700",
  strongJunior: "bg-blue-100 text-blue-700",
  middle: "bg-yellow-100 text-yellow-700",
  strongMiddle: "bg-orange-100 text-orange-700",
  senior: "bg-red-100 text-red-700",
};

const getDefaultDates = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
};

const AttendancePage = () => {
  const defaults = getDefaultDates();

  const [stats, setStats] = useState([]);
  const [branches, setBranches] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedMentor, setSelectedMentor] = useState("all");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);

  // Load branches and mentors once
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [branchesData, mentorsData] = await Promise.all([
          api.branches.getAll(),
          api.mentors.getAll(),
        ]);
        setBranches(Array.isArray(branchesData) ? branchesData : []);
        setMentors(Array.isArray(mentorsData) ? mentorsData : []);
      } catch (err) {
        console.error("Failed to load meta", err);
      }
    };
    fetchMeta();
  }, []);

  // Fetch stats when date range or branch changes
  useEffect(() => {
    fetchStats();
  }, [selectedBranch, startDate, endDate]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { startDate, endDate };
      if (selectedBranch !== "all") params.branch = selectedBranch;

      const data = await api.lessons.getAttendanceStats(params);
      setStats(Array.isArray(data.stats) ? data.stats : []);
    } catch (err) {
      console.error("Failed to load attendance stats", err);
      setError("Не удалось загрузить данные посещаемости.");
    } finally {
      setLoading(false);
    }
  };

  // Mentors filtered by selected branch (client-side)
  const filteredMentors = useMemo(() => {
    if (selectedBranch === "all") return mentors;
    return mentors.filter(
      (m) =>
        m.branch === selectedBranch ||
        m.branch?._id === selectedBranch ||
        (Array.isArray(m.branches) &&
          m.branches.some(
            (b) => b === selectedBranch || b?._id === selectedBranch
          ))
    );
  }, [mentors, selectedBranch]);

  // Reset mentor filter when branch changes and current mentor is no longer available
  useEffect(() => {
    if (
      selectedMentor !== "all" &&
      !filteredMentors.find((m) => m._id === selectedMentor)
    ) {
      setSelectedMentor("all");
    }
  }, [filteredMentors]);

  // Client-side mentor filter applied to stats
  const displayedStats = useMemo(() => {
    if (selectedMentor === "all") return stats;
    return stats.filter((row) => {
      const mentorId = row.mentor?._id || row.mentorId;
      return mentorId === selectedMentor;
    });
  }, [stats, selectedMentor]);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Посещаемость</h1>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-wrap gap-4 items-end">
        {/* Branch */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Филиал</label>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="all">Все филиалы</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Start date */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Период с
          </label>
          <input
            type="date"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        {/* End date */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Период по
          </label>
          <input
            type="date"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Mentor */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Ментор</label>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
            value={selectedMentor}
            onChange={(e) => setSelectedMentor(e.target.value)}
          >
            <option value="all">Все менторы</option>
            {filteredMentors.map((m) => (
              <option key={m._id} value={m._id}>
                {m?.name} {m?.lastName || ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-600">
                Стажёр
              </th>
              <th className="px-4 py-3 font-semibold text-gray-600">Грейд</th>
              <th className="px-4 py-3 font-semibold text-gray-600">
                Филиал
              </th>
              <th className="px-4 py-3 font-semibold text-gray-600">
                Ментор
              </th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-center">
                Подтверждено
              </th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-center">
                В ожидании
              </th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-center">
                Норма
              </th>
              <th className="px-4 py-3 font-semibold text-gray-600 min-w-[140px]">
                % выполнения
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan="8" className="text-center py-12">
                  <div className="flex justify-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                </td>
              </tr>
            ) : displayedStats.length === 0 ? (
              <tr>
                <td
                  colSpan="8"
                  className="text-center py-12 text-gray-500"
                >
                  Нет данных
                </td>
              </tr>
            ) : (
              displayedStats.map((row) => {
                const pct = row.percentage ?? 0;
                const barColor =
                  pct >= 100
                    ? "bg-green-500"
                    : pct >= 60
                    ? "bg-blue-500"
                    : pct >= 30
                    ? "bg-yellow-500"
                    : "bg-red-500";

                const mentorName = row.mentor
                  ? `${row.mentor.name || ""} ${row.mentor.lastName || ""}`.trim()
                  : "—";

                return (
                  <tr
                    key={row.internId}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {row.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          GRADE_COLORS[row.grade] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {GRADE_LABELS[row.grade] || row.grade || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.branch?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{mentorName}</td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900">
                      {row.confirmedCount ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {row.pendingCount ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {row.norm ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[80px]">
                          <div
                            className={`h-2 rounded-full transition-all ${barColor}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-10 text-right">
                          {pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendancePage;
