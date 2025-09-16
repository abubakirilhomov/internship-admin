import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash2, AlertTriangle, Edit } from "lucide-react";
import { api } from "../utils/api";

const Rules = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    example: "",
    consequence: "",
  });
  
  const categories = useMemo(() => [
    { value: "green", label: "Зелёный", badge: "badge-success" },
    { value: "yellow", label: "Жёлтый", badge: "badge-warning" },
    { value: "red", label: "Красный", badge: "badge-error" },
    { value: "black", label: "Чёрный", badge: "badge-neutral" },
  ], []);
  
  const [grades, setGrades] = useState({});
  const [gradesError, setGradesError] = useState(null);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setGradesError(null);
      
      const data = await api.rules.getAll();
      setGrades(data.grades || {});
      setRules(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Ошибка при загрузке правил";
      setError(errorMessage);
      console.error("Error fetching rules:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const validateForm = useCallback(() => {
    if (!formData.title.trim()) return "Название правила обязательно";
    if (formData.title.length > 100) return "Название не должно превышать 100 символов";
    if (!formData.category) return "Категория обязательна";
    if (!categories.find(cat => cat.value === formData.category)) {
      return "Недопустимая категория";
    }
    return null;
  }, [formData, categories]);

  const resetForm = useCallback(() => {
    setFormData({ title: "", category: "", example: "", consequence: "" });
    setError(null);
    setEditingRule(null);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setShowDeleteModal(null);
    resetForm();
  }, [resetForm]);

  const handleEdit = useCallback((rule) => {
    setEditingRule(rule._id);
    setFormData({
      title: rule.title,
      category: rule.category,
      example: rule.example || "",
      consequence: rule.consequence || "",
    });
    setShowModal(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingRule) {
        await api.rules.update(editingRule, formData);
      } else {
        await api.rules.create(formData);
      }
      setShowModal(false);
      resetForm();
      await fetchRules();
    } catch (error) {
      const action = editingRule ? "обновлении" : "создании";
      setError(error.response?.data?.message || `Ошибка при ${action} правила`);
      console.error(`Error ${editingRule ? 'updating' : 'creating'} rule:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = useCallback((id) => {
    setShowDeleteModal(id);
  }, []);

  const confirmDelete = async () => {
    if (!showDeleteModal) return;
    
    try {
      await api.rules.delete(showDeleteModal);
      setShowDeleteModal(null);
      await fetchRules();
    } catch (error) {
      setError(error.response?.data?.message || "Ошибка при удалении правила");
      console.error("Error deleting rule:", error);
    }
  };

  const getCategoryBadge = useCallback((categoryValue) => {
    const category = categories.find(cat => cat.value === categoryValue);
    return category ? category.badge : "badge-ghost";
  }, [categories]);

  const getCategoryLabel = useCallback((categoryValue) => {
    const category = categories.find(cat => cat.value === categoryValue);
    return category ? category.label : categoryValue;
  }, [categories]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {error && (
        <div className="alert alert-error mb-4 shadow-lg">
          <AlertTriangle className="h-5 w-5" />
          <span>{error}</span>
          <button
            className="btn btn-sm btn-circle btn-ghost"
            onClick={() => setError(null)}
            aria-label="Закрыть уведомление об ошибке"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-base-content mb-2">Правила</h1>
          <p className="text-base-content/70">
            Управление правилами и предупреждениями ({rules.length} правил)
          </p>
        </div>
        <button
          className="btn btn-primary gap-2 shadow-lg"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          disabled={isSubmitting}
        >
          <Plus className="h-4 w-4" />
          Добавить правило
        </button>
      </div>

      {/* Rules Table */}
      <div className="card bg-base-100 shadow-xl mb-8">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Категория</th>
                  <th>Пример</th>
                  <th>Последствие</th>
                  <th>Дата создания</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-base-content/50">
                      Нет правил для отображения
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule._id} className="hover">
                      <td className="font-medium">{rule.title}</td>
                      <td>
                        <div className={`badge ${getCategoryBadge(rule.category)} gap-2`}>
                          {getCategoryLabel(rule.category)}
                        </div>
                      </td>
                      <td className="max-w-xs truncate" title={rule.example}>
                        {rule.example || <span className="text-base-content/50">—</span>}
                      </td>
                      <td className="max-w-xs truncate" title={rule.consequence}>
                        {rule.consequence || <span className="text-base-content/50">—</span>}
                      </td>
                      <td>
                        {new Date(rule.createdAt).toLocaleDateString("ru-RU", {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-sm btn-ghost btn-square text-info hover:bg-info/20"
                            onClick={() => handleEdit(rule)}
                            title="Редактировать правило"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            className="btn btn-sm btn-ghost btn-square text-error hover:bg-error/20"
                            onClick={() => handleDelete(rule._id)}
                            title="Удалить правило"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Grades Table */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="text-2xl font-bold mb-4">Уровни</h2>
          {gradesError ? (
            <div className="alert alert-warning">
              <AlertTriangle className="h-5 w-5" />
              <span>Ошибка при загрузке уровней: {gradesError}</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Класс</th>
                    <th>Уроки за месяц</th>
                    <th>Пробный период</th>
                    <th>Дополнительные возможности</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(grades).length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-8 text-base-content/50">
                        Нет уровней для отображения
                      </td>
                    </tr>
                  ) : (
                    Object.entries(grades).map(([key, value]) => (
                      <tr key={key} className="hover">
                        <td className="font-medium">{key}</td>
                        <td>
                          <div className="badge badge-outline">
                            {value.lessonsPerMonth || 0}
                          </div>
                        </td>
                        <td>{value.trialPeriod || 0} мес</td>
                        <td>
                          {value.plus && value.plus.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {value.plus.map((feature, index) => (
                                <div key={index} className="badge badge-secondary badge-sm">
                                  {feature}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-base-content/50">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <dialog className={`modal ${showModal ? "modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">
            {editingRule ? "Редактировать правило" : "Добавить правило"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Название*</span>
              </label>
              <input
                type="text"
                className="input input-bordered focus:input-primary"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                maxLength="100"
                required
                autoFocus
              />
              <label className="label">
                <span className="label-text-alt text-base-content/50">
                  {formData.title.length}/100
                </span>
              </label>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Категория*</span>
              </label>
              <select
                className="select select-bordered focus:select-primary"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                required
              >
                <option value="" disabled>
                  Выберите категорию
                </option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Пример</span>
              </label>
              <textarea
                className="textarea textarea-bordered focus:textarea-primary"
                value={formData.example}
                onChange={(e) =>
                  setFormData({ ...formData, example: e.target.value })
                }
                rows="2"
                maxLength="500"
              />
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Последствие</span>
              </label>
              <textarea
                className="textarea textarea-bordered focus:textarea-primary"
                value={formData.consequence}
                onChange={(e) =>
                  setFormData({ ...formData, consequence: e.target.value })
                }
                rows="2"
                maxLength="500"
              />
            </div>
            
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleCloseModal}
                disabled={isSubmitting}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    {editingRule ? "Обновление..." : "Создание..."}
                  </>
                ) : (
                  editingRule ? "Обновить" : "Создать"
                )}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={handleCloseModal}>закрыть</button>
        </form>
      </dialog>

      {/* Delete Confirmation Modal */}
      <dialog className={`modal ${showDeleteModal ? "modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg text-error">Подтверждение удаления</h3>
          <p className="py-4">
            Вы уверены, что хотите удалить это правило? Это действие нельзя отменить.
          </p>
          <div className="modal-action">
            <button 
              className="btn btn-ghost" 
              onClick={() => setShowDeleteModal(null)}
            >
              Отмена
            </button>
            <button 
              className="btn btn-error" 
              onClick={confirmDelete}
            >
              <Trash2 className="h-4 w-4" />
              Удалить
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setShowDeleteModal(null)}>закрыть</button>
        </form>
      </dialog>
    </div>
  );
};

export default Rules;