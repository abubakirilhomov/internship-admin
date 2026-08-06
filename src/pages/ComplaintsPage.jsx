import React, { useState, useEffect, useMemo } from "react";
import { api } from "../utils/api";
import { MessageSquareWarning, AlertTriangle, UserCircle, Check, RotateCcw } from "lucide-react";
import ViolationsTabs from "../components/Layout/ViolationsTabs";

const CATEGORY_META = {
  red:    { label: "Красные",  dot: "bg-red-500",    badge: "bg-red-100 text-red-700 border-red-200" },
  yellow: { label: "Жёлтые",   dot: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  green:  { label: "Зелёные",  dot: "bg-green-500",  badge: "bg-green-100 text-green-700 border-green-200" },
  black:  { label: "Чёрные",   dot: "bg-gray-800",   badge: "bg-gray-100 text-gray-800 border-gray-300" },
  other:  { label: "Без правила", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600 border-slate-200" },
};

const ROLE_LABELS = {
  branchManager: "Branch Manager",
  admin: "Админ",
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

const ComplaintRow = ({ c, onToggleStatus, busy }) => {
  const [expanded, setExpanded] = useState(false);
  const isReviewed = c.status === "reviewed";
  const rules = Array.isArray(c.ruleTitles) ? c.ruleTitles.filter(Boolean) : [];
  const authorLabel = c.createdByName?.trim() || ROLE_LABELS[c.createdByRole] || "—";

  return (
    <tr className={`transition-colors align-top ${isReviewed ? "bg-gray-50/60" : "hover:bg-gray-50"}`}>
      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-sm">
        {new Date(c.date).toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}
      </td>
      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
        {c.internName || "—"}
      </td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-sm">
        {c.branchName || "—"}
      </td>
      <td className="px-4 py-3 text-sm text-gray-800 max-w-[280px]">
        <p className={expanded ? "" : "line-clamp-2"}>{c.text}</p>
        {c.text?.length > 90 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-blue-500 hover:underline mt-0.5"
          >
            {expanded ? "Свернуть" : "Показать всё"}
          </button>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px]">
        {rules.length > 0 ? (
          <ul className="space-y-0.5">
            {rules.map((title, i) => (
              <li key={i} className="text-xs leading-snug">• {title}</li>
            ))}
          </ul>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <CategoryBadge category={c.category} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-sm text-gray-700">
          <UserCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span>{authorLabel}</span>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <button
          onClick={() => onToggleStatus(c)}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
            isReviewed
              ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
          }`}
          title={isReviewed ? "Вернуть в «Новые»" : "Отметить разобранной"}
        >
          {isReviewed ? <Check className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
          {isReviewed ? "Разобрана" : "Новая"}
        </button>
      </td>
    </tr>
  );
};

const ComplaintsPage = () => {
  const defaults = getDefaultDates();

  const [complaints, setComplaints] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.branches.getAll()
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [selectedBranch, selectedCategory, selectedStatus, startDate, endDate]);

  const fetchComplaints = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedBranch !== "all") params.branch = selectedBranch;
      if (selectedCategory !== "all") params.category = selectedCategory;
      if (selectedStatus !== "all") params.status = selectedStatus;
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.endDate = end.toISOString();
      }

      const data = await api.complaints.getAll(params);
      setComplaints(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Не удалось загрузить жалобы.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (c) => {
    const next = c.status === "reviewed" ? "new" : "reviewed";
    setBusyId(c.complaintId);
    // Оптимистично: список часто отфильтрован по статусу, и перезагрузка
    // всего отчёта ради одной строки заметно моргает.
    setComplaints((prev) =>
      prev.map((item) =>
        item.complaintId === c.complaintId ? { ...item, status: next } : item
      )
    );
    try {
      await api.complaints.setStatus(c.internId, c.complaintId, next);
    } catch (err) {
      setComplaints((prev) =>
        prev.map((item) =>
          item.complaintId === c.complaintId ? { ...item, status: c.status } : item
        )
      );
      setError(err.message || "Не удалось обновить статус жалобы.");
    } finally {
      setBusyId(null);
    }
  };

  const displayed = useMemo(() => {
    if (!search.trim()) return complaints;
    const q = search.toLowerCase();
    return complaints.filter(
      (c) =>
        c.internName?.toLowerCase().includes(q) ||
        c.text?.toLowerCase().includes(q) ||
        c.branchName?.toLowerCase().includes(q) ||
        c.createdByName?.toLowerCase().includes(q)
    );
  }, [complaints, search]);

  const newCount = useMemo(
    () => complaints.filter((c) => c.status !== "reviewed").length,
    [complaints]
  );

  const counts = useMemo(() =>
    Object.keys(CATEGORY_META).reduce((acc, cat) => {
      acc[cat] = complaints.filter((c) => c.category === cat).length;
      return acc;
    }, {}),
    [complaints]
  );

  return (
    <div className="p-6">
      <ViolationsTabs />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
          <MessageSquareWarning className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Жалобы</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Обращения branch manager'ов и админов на стажёров
          </p>
        </div>
      </div>

      {/* Summary pills */}
      {!loading && complaints.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 shadow-sm">
            Всего: <span className="font-bold text-gray-900">{complaints.length}</span>
          </span>
          {newCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-amber-100 text-amber-700 border-amber-200 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Не разобрано: <span className="font-bold ml-0.5">{newCount}</span>
            </span>
          )}
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

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Статус</label>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">Все</option>
            <option value="new">Новые</option>
            <option value="reviewed">Разобранные</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Период с</label>
          <input
            type="date"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

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

        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-sm font-medium text-gray-700">Поиск</label>
          <input
            type="text"
            placeholder="Стажёр, текст, филиал, автор..."
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

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
              <th className="px-4 py-3 font-semibold text-gray-600">Жалоба</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Правила</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Категория</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Автор</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Статус</th>
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
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <MessageSquareWarning className="w-10 h-10 opacity-30" />
                    <p className="font-medium text-gray-500">Жалоб не найдено</p>
                    <p className="text-xs">Попробуйте изменить фильтры</p>
                  </div>
                </td>
              </tr>
            ) : (
              displayed.map((c) => (
                <ComplaintRow
                  key={c.complaintId}
                  c={c}
                  busy={busyId === c.complaintId}
                  onToggleStatus={handleToggleStatus}
                />
              ))
            )}
          </tbody>
        </table>

        {!loading && displayed.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 text-right">
            Показано {displayed.length} из {complaints.length}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplaintsPage;
