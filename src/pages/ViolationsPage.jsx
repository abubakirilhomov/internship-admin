import React, { useState, useEffect, useMemo } from "react";
import { api } from "../utils/api";
import { ShieldAlert, AlertTriangle } from "lucide-react";

const CATEGORY_META = {
  red:    { label: "Красные",  dot: "bg-red-500",    badge: "bg-red-100 text-red-700 border-red-200" },
  yellow: { label: "Жёлтые",  dot: "bg-yellow-400",  badge: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  green:  { label: "Зелёные", dot: "bg-green-500",   badge: "bg-green-100 text-green-700 border-green-200" },
  black:  { label: "Чёрные",  dot: "bg-gray-800",    badge: "bg-gray-100 text-gray-800 border-gray-300" },
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

const CategoryBadge = ({ category }) => {
  const meta = CATEGORY_META[category];
  if (!meta) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
};

const ViolationsPage = () => {
  const defaults = getDefaultDates();

  const [violations, setViolations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.branches.getAll()
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchViolations();
  }, [selectedBranch, selectedCategory, startDate, endDate]);

  const fetchViolations = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedBranch !== "all") params.branch = selectedBranch;
      if (selectedCategory !== "all") params.category = selectedCategory;
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.endDate = end.toISOString();
      }

      const data = await api.violations.getAll(params);
      setViolations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Не удалось загрузить нарушения.");
    } finally {
      setLoading(false);
    }
  };

  const displayed = useMemo(() => {
    if (!search.trim()) return violations;
    const q = search.toLowerCase();
    return violations.filter(
      (v) =>
        v.internName?.toLowerCase().includes(q) ||
        v.ruleTitle?.toLowerCase().includes(q) ||
        v.branchName?.toLowerCase().includes(q)
    );
  }, [violations, search]);

  // Summary counts by category
  const counts = useMemo(() =>
    Object.keys(CATEGORY_META).reduce((acc, cat) => {
      acc[cat] = violations.filter((v) => v.category === cat).length;
      return acc;
    }, {}),
    [violations]
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Журнал нарушений</h1>
          <p className="text-sm text-gray-500 mt-0.5">История нарушений стажёров</p>
        </div>
      </div>

      {/* Summary pills */}
      {!loading && violations.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 shadow-sm">
            Всего: <span className="font-bold text-gray-900">{violations.length}</span>
          </span>
          {Object.entries(CATEGORY_META).map(([cat, meta]) =>
            counts[cat] > 0 ? (
              <span key={cat} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${meta.badge} shadow-sm`}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {meta.label}: <span className="font-bold ml-0.5">{counts[cat]}</span>
              </span>
            ) : null
          )}
        </div>
      )}

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
              <option key={b._id} value={b._id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Категория</label>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">Все категории</option>
            {Object.entries(CATEGORY_META).map(([cat, meta]) => (
              <option key={cat} value={cat}>{meta.label}</option>
            ))}
          </select>
        </div>

        {/* Start date */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Период с</label>
          <input
            type="date"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        {/* End date */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Период по</label>
          <input
            type="date"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Search */}
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-sm font-medium text-gray-700">Поиск</label>
          <input
            type="text"
            placeholder="Стажёр, нарушение, филиал..."
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-600">Дата</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Стажёр</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Филиал</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Нарушение</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Категория</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Заметка</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-12">
                  <div className="flex justify-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                </td>
              </tr>
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <ShieldAlert className="w-10 h-10 opacity-30" />
                    <p className="font-medium text-gray-500">Нарушений не найдено</p>
                    <p className="text-xs">Попробуйте изменить фильтры</p>
                  </div>
                </td>
              </tr>
            ) : (
              displayed.map((v, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(v.date).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {v.internName || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {v.branchName || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-800 max-w-xs">
                    {v.ruleTitle || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={v.category} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate" title={v.notes}>
                    {v.notes || <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!loading && displayed.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 text-right">
            Показано {displayed.length} из {violations.length}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViolationsPage;
