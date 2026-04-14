import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit, X, AlertCircle, PowerOff, Power } from "lucide-react";
import { api } from "../utils/api";

const CATEGORY_LABELS = {
  communication: "Коммуникация",
  tempo: "Темп",
  discipline: "Дисциплина",
  content: "Содержание",
  other: "Прочее",
};

const EMPTY_FORM = {
  label: "",
  labelRu: "",
  type: "positive",
  weight: 1,
  category: "communication",
};

const LessonCriteria = () => {
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCriteria = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.lessonCriteria.getAll();
      const list = Array.isArray(result) ? result : result?.data || [];
      setCriteria(list);
    } catch (err) {
      setError(err.message || "Ошибка загрузки критериев");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCriteria();
  }, [fetchCriteria]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const openCreate = () => {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      label: item.label || "",
      labelRu: item.labelRu || "",
      type: item.type || "positive",
      weight: item.weight ?? 1,
      category: item.category || "communication",
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
  };

  const handleTypeChange = (type) => {
    setFormData((prev) => ({
      ...prev,
      type,
      weight: type === "positive" ? 1 : prev.weight,
    }));
  };

  const validate = () => {
    if (!formData.label.trim()) return "Критерий (узбекский) обязателен";
    if (!formData.labelRu.trim()) return "Критерий (русский) обязателен";
    if (!formData.category) return "Категория обязательна";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setFormError(err); return; }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        label: formData.label.trim(),
        labelRu: formData.labelRu.trim(),
        type: formData.type,
        weight: formData.type === "positive" ? 1 : Number(formData.weight),
        category: formData.category,
      };
      if (editingItem) {
        await api.lessonCriteria.update(editingItem._id, payload);
      } else {
        await api.lessonCriteria.create(payload);
      }
      closeModal();
      await fetchCriteria();
    } catch (err) {
      setFormError(err.message || "Ошибка сохранения");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (item) => {
    try {
      if (item.isActive) {
        await api.lessonCriteria.deactivate(item._id);
      } else {
        await api.lessonCriteria.update(item._id, { isActive: true });
      }
      await fetchCriteria();
    } catch (err) {
      setError(err.message || "Ошибка изменения статуса");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3 text-slate-400">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-sm">Загрузка критериев...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Критерии оценки уроков</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Управление критериями, по которым интерны оценивают уроки менторов ({criteria.length})
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Добавить критерий
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 mb-5 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Критерий (uz)
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Критерий (ru)
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Тип
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Вес
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Категория
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Статус
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {criteria.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-12 text-center text-slate-400 text-sm">
                  Нет критериев для отображения
                </td>
              </tr>
            ) : (
              criteria.map((item) => (
                <tr
                  key={item._id}
                  className={`hover:bg-slate-50 transition-colors ${!item.isActive ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-3 max-w-xs">
                    <span className="line-clamp-2">{item.label || "—"}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <span className="line-clamp-2">{item.labelRu || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.type === "negative"
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {item.type === "negative" ? "Негативный" : "Позитивный"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                      {item.weight ?? 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {CATEGORY_LABELS[item.category] || item.category || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {item.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Активен
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                        Неактивен
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        title="Редактировать"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(item)}
                        title={item.isActive ? "Деактивировать" : "Активировать"}
                        className={`p-1.5 rounded-lg transition-colors ${
                          item.isActive
                            ? "text-slate-400 hover:text-red-600 hover:bg-red-50"
                            : "text-slate-400 hover:text-green-600 hover:bg-green-50"
                        }`}
                      >
                        {item.isActive ? (
                          <PowerOff className="w-4 h-4" />
                        ) : (
                          <Power className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editingItem ? "Редактировать критерий" : "Добавить критерий"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              {/* Uzbek text */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Критерий (узбекский) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData((p) => ({ ...p, label: e.target.value }))}
                  placeholder="Matnni kiriting..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
                />
              </div>

              {/* Russian text */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Критерий (русский) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.labelRu}
                  onChange={(e) => setFormData((p) => ({ ...p, labelRu: e.target.value }))}
                  placeholder="Введите текст..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
                />
              </div>

              {/* Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Тип <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
                >
                  <option value="positive">Позитивный</option>
                  <option value="negative">Негативный</option>
                </select>
              </div>

              {/* Weight — only for negative */}
              {formData.type === "negative" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                    Вес
                  </label>
                  <select
                    value={formData.weight}
                    onChange={(e) => setFormData((p) => ({ ...p, weight: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>
              )}

              {/* Category */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Категория <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </form>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {isSubmitting && (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {editingItem ? "Сохранить" : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LessonCriteria;
