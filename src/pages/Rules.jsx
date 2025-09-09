import React, { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../utils/api";

const Rules = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    example: "",
    consequence: "",
  });
  const categories = ["green", "yellow", "red", "black"];

  useEffect(() => {
    fetchRules();
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        setShowModal(false);
        setShowDeleteModal(null);
        resetForm();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const data = await api.rules.getAll();
      setRules(data.data);
    } catch (error) {
      setError(error.response?.data?.message || "Ошибка при загрузке правил");
      console.error("Error fetching rules:", error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!formData.title) return "Название правила обязательно";
    if (!formData.category) return "Категория обязательна";
    if (!categories.includes(formData.category))
      return "Недопустимая категория";
    return null;
  };

  const resetForm = () => {
    setFormData({ title: "", category: "", example: "", consequence: "" });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    console.log(formData)
    setIsSubmitting(true);
    try {
      await api.rules.create(formData);
      setShowModal(false);
      resetForm();
      fetchRules();
    } catch (error) {
      setError(error.response?.data?.message || "Ошибка при создании правила");
      console.error("Error creating rule:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    setShowDeleteModal(id);
  };

  const confirmDelete = async () => {
    try {
      await api.rules.delete(showDeleteModal);
      setShowDeleteModal(null);
      fetchRules();
    } catch (error) {
      setError(error.response?.data?.message || "Ошибка при удалении правила");
      console.error("Error deleting rule:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  const categoryColors = {
    green: "bg-green-500 text-white",
    yellow: "bg-yellow-500 text-black",
    red: "bg-red-500 text-white",
    black: "bg-black text-white",
  };
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
        <div>
          <h1 className="text-3xl font-bold text-base-content mb-2">Правила</h1>
          <p className="text-base-content opacity-70">
            Управление правилами и предупреждениями
          </p>
        </div>
        <button
          className="btn btn-primary gap-2"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Добавить правило
        </button>
      </div>

      <div className="card bg-base-100 shadow-xl">
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
                {rules.map((rule) => (
                  <tr key={rule._id}>
                    <td>{rule.title}</td>
                    <td>
                      <div className={`w-8 h-8 rounded-full ${categoryColors[rule.category] || "bg-gray-300"}`}>
                      </div>
                    </td>
                    <td>{rule.example || "Нет"}</td>
                    <td>{rule.consequence || "Нет"}</td>
                    <td>
                      {new Date(rule.createdAt).toLocaleDateString("ru-RU")}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-ghost text-error"
                        onClick={() => handleDelete(rule._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <dialog
        className={`modal ${showModal ? "modal-open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowModal(false);
            resetForm();
          }
        }}
      >
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Добавить правило</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Название</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Категория</span>
              </label>
              <select
                className="select select-bordered"
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
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Пример (необязательно)</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={formData.example}
                onChange={(e) =>
                  setFormData({ ...formData, example: e.target.value })
                }
              />
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Последствие (необязательно)</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={formData.consequence}
                onChange={(e) =>
                  setFormData({ ...formData, consequence: e.target.value })
                }
              />
            </div>
            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Сохранение..." : "Создать"}
              </button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog className={`modal ${showDeleteModal ? "modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg">Подтверждение удаления</h3>
          <p>Вы уверены, что хотите удалить это правило?</p>
          <div className="modal-action">
            <button className="btn" onClick={() => setShowDeleteModal(null)}>
              Отмена
            </button>
            <button className="btn btn-error" onClick={confirmDelete}>
              Удалить
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default Rules;
