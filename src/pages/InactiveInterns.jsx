import React, { useState, useEffect, useMemo } from "react";
import { AlertTriangle, TrendingDown, Users, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
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

const THRESHOLD_OPTIONS = [
  { label: "< 25% нормы", value: 25 },
  { label: "< 50% нормы", value: 50 },
  { label: "< 75% нормы", value: 75 },
  { label: "0 уроков", value: 0 },
];

const InactiveInterns = () => {
  const [stats, setStats] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [threshold, setThreshold] = useState(50);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [period, setPeriod] = useState("month");
  const [sortField, setSortField] = useState("percentage");
  const [sortDir, setSortDir] = useState("asc");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, branchesData] = await Promise.all([
        api.lessons.getAttendanceStats({ period }),
        api.branches.getAll(),
      ]);
      setStats(Array.isArray(statsData) ? statsData : statsData?.data || []);
      setBranches(Array.isArray(branchesData) ? branchesData : branchesData?.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const filtered = useMemo(() => {
    let list = stats.filter((s) => {
      if (threshold === 0) return s.confirmedCount === 0;
      const pct = s.norm > 0 ? (s.confirmedCount / s.norm) * 100 : 0;
      return pct < threshold;
    });

    if (selectedBranch !== "all") {
      list = list.filter((s) => {
        const bId = s.branchId?.toString() || s.branch?._id?.toString();
        return bId === selectedBranch;
      });
    }

    list.sort((a, b) => {
      let av, bv;
      if (sortField === "percentage") {
        av = a.norm > 0 ? a.confirmedCount / a.norm : 0;
        bv = b.norm > 0 ? b.confirmedCount / b.norm : 0;
      } else if (sortField === "confirmedCount") {
        av = a.confirmedCount;
        bv = b.confirmedCount;
      } else if (sortField === "name") {
        av = a.name?.toLowerCase() || "";
        bv = b.name?.toLowerCase() || "";
      } else if (sortField === "norm") {
        av = a.norm || 0;
        bv = b.norm || 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [stats, threshold, selectedBranch, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-slate-300 ml-1">↕</span>;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 inline ml-1 text-blue-500" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1 text-blue-500" />
    );
  };

  const getPctColor = (pct) => {
    if (pct === 0) return "text-red-600 font-bold";
    if (pct < 25) return "text-red-500 font-semibold";
    if (pct < 50) return "text-orange-500 font-semibold";
    return "text-yellow-600";
  };

  const getBarColor = (pct) => {
    if (pct < 25) return "bg-red-400";
    if (pct < 50) return "bg-orange-400";
    return "bg-yellow-400";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
          <TrendingDown className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Низкая активность</h1>
          <p className="text-sm text-slate-500">Интерны, которые редко добавляют уроки</p>
        </div>
        <button
          onClick={fetchData}
          className="ml-auto p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          title="Обновить"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-center">
        {/* Period */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Период:</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            <option value="month">Текущий месяц</option>
            <option value="week">Текущая неделя</option>
          </select>
        </div>

        {/* Threshold */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Порог:</span>
          <div className="flex gap-1">
            {THRESHOLD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setThreshold(opt.value)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                  threshold === opt.value
                    ? "bg-red-500 text-white border-red-500"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Branch */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Филиал:</span>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            <option value="all">Все филиалы</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Count badge */}
        <div className="ml-auto flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          <span className="text-sm font-semibold text-red-700">
            {loading ? "..." : filtered.length} интернов
          </span>
        </div>
      </div>

      {/* Table */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600">
          Ошибка загрузки: {error}
        </div>
      ) : loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 opacity-40" />
          Загрузка...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p className="text-slate-500 font-medium">Нет интернов с низкой активностью</p>
          <p className="text-slate-400 text-sm mt-1">
            Попробуйте изменить порог или период
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  #
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700"
                  onClick={() => handleSort("name")}
                >
                  Интерн <SortIcon field="name" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Грейд
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Филиал
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700"
                  onClick={() => handleSort("confirmedCount")}
                >
                  Уроков <SortIcon field="confirmedCount" />
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700"
                  onClick={() => handleSort("norm")}
                >
                  Норма <SortIcon field="norm" />
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 min-w-[160px]"
                  onClick={() => handleSort("percentage")}
                >
                  Выполнение <SortIcon field="percentage" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((s, idx) => {
                const pct =
                  s.norm > 0
                    ? Math.round((s.confirmedCount / s.norm) * 100)
                    : 0;
                const gradeKey =
                  s.grade?.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) ||
                  s.grade;
                return (
                  <tr key={s.internId || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {s.profilePhoto ? (
                          <img
                            src={s.profilePhoto}
                            alt={s.name}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-slate-500">
                              {s.name?.charAt(0) || "?"}
                            </span>
                          </div>
                        )}
                        <span className="font-medium text-slate-800">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          GRADE_COLORS[gradeKey] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {GRADE_LABELS[gradeKey] || s.grade || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {s.branch?.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          s.confirmedCount === 0 ? "text-red-600" : "text-slate-700"
                        }`}
                      >
                        {s.confirmedCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.norm ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 min-w-[80px]">
                          <div
                            className={`h-1.5 rounded-full transition-all ${getBarColor(pct)}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm min-w-[40px] text-right ${getPctColor(pct)}`}>
                          {pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InactiveInterns;
