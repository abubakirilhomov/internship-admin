import React, { useState, useEffect } from "react";
import {
  User,
  Lock,
  Building,
  UserCheck,
  Star,
  Award,
  Calendar,
} from "lucide-react";
import { api } from "../../utils/api";

const InternFormModal = ({ onClose, branches, initialData, refresh }) => {
  const [form, setForm] = useState({
    name: "",
    lastName: "",
    username: "",
    password: "",
    branch: "",
    mentor: "",
    lessonsVisitedFake: 0,
    rating: 0,
    grade: "junior",
    dateJoined: new Date().toISOString().split("T")[0],
  });

  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMentors();
  }, []);

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || "",
        lastName: initialData.lastName || "",
        username: initialData.username || "",
        password: "",
        branch: initialData.branch?._id || "",
        mentor: initialData.mentor?._id || "",
        lessonsVisitedFake: initialData.lessonsVisited?.length || 0, // <-- здесь
        rating: initialData.score || 0,
        grade: initialData.grade || "junior",
        dateJoined: initialData.dateJoined
          ? new Date(initialData.dateJoined).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      });
    }
  }, [initialData]);

  const fetchMentors = async () => {
    try {
      setLoading(true);
      const data = await api.mentors.getAll();
      setMentors(data);
    } catch (error) {
      setError("Ошибка при загрузке менторов");
      console.error("Error fetching mentors:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (
      !form.name ||
      !form.lastName ||
      !form.username ||
      (!initialData && !form.password) ||
      !form.branch ||
      !form.mentor ||
      !form.grade ||
      !form.dateJoined
    ) {
      setError("Пожалуйста, заполните все обязательные поля");
      return false;
    }
    if (form.rating < 0 || form.rating > 5) {
      setError("Рейтинг должен быть от 0 до 5");
      return false;
    }
    if (form.lessonsVisitedFake < 0) {
      setError("Количество уроков не может быть отрицательным");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      const payload = {
        name: form.name,
        lastName: form.lastName,
        username: form.username,
        password: form.password,
        branch: form.branch,
        mentor: form.mentor,
        grade: form.grade,
        dateJoined: form.dateJoined,
        lessonsVisitedFake: Number(form.lessonsVisitedFake), // <-- передаём на бэк
      };

      if (initialData) {
        await api.interns.update(initialData._id, payload);
      } else {
        await api.interns.create(payload);
      }
      await refresh();
      onClose();
    } catch (error) {
      setError(
        error.message || "Ошибка при сохранении стажёра. Попробуйте снова."
      );
      console.error("Error submitting intern:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">
          {initialData ? "Редактировать стажёра" : "Добавить стажёра"}
        </h3>
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Имя */}
          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <User className="h-4 w-4" /> Имя
              </span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Введите имя"
              className="input input-bordered w-full"
              required
            />
          </div>

          {/* Фамилия */}
          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <User className="h-4 w-4" /> Фамилия
              </span>
            </label>
            <input
              type="text"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              placeholder="Введите фамилию"
              className="input input-bordered w-full"
              required
            />
          </div>

          {/* Username */}
          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <User className="h-4 w-4" /> Имя пользователя
              </span>
            </label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Введите имя пользователя"
              className="input input-bordered w-full"
              required
            />
          </div>

          {/* Password */}
          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <Lock className="h-4 w-4" /> Пароль
              </span>
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Введите пароль"
              className="input input-bordered w-full"
              required={!initialData}
            />
          </div>

          {/* Branch */}
          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <Building className="h-4 w-4" /> Филиал
              </span>
            </label>
            <select
              name="branch"
              value={form.branch}
              onChange={handleChange}
              className="select select-bordered w-full"
              required
            >
              <option value="">Выбери филиал</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mentor */}
          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <UserCheck className="h-4 w-4" /> Ментор
              </span>
            </label>
            <select
              name="mentor"
              value={form.mentor}
              onChange={handleChange}
              className="select select-bordered w-full"
              required
              disabled={loading}
            >
              <option value="">Выбери ментора</option>
              {mentors.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Grade */}
          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <Award className="h-4 w-4" /> Уровень
              </span>
            </label>
            <select
              name="grade"
              value={form.grade}
              onChange={handleChange}
              className="select select-bordered w-full"
              required
            >
              <option value="junior">Junior</option>
              <option value="strongJunior">Strong Junior</option>
              <option value="middle">Middle</option>
              <option value="strongMiddle">Strong Middle</option>
              <option value="senior">Senior</option>
            </select>
          </div>

          {/* Количество уроков */}
          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <Star className="h-4 w-4" /> Количество уроков
              </span>
            </label>
            <input
              type="number"
              name="lessonsVisitedFake"
              value={form.lessonsVisitedFake}
              onChange={handleChange}
              placeholder="Введите количество уроков"
              className="input input-bordered w-full"
              min="0"
            />
          </div>

          {/* Rating */}
          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <Star className="h-4 w-4" /> Рейтинг (0–5)
              </span>
            </label>
            <input
              type="number"
              name="rating"
              value={form.rating}
              onChange={handleChange}
              placeholder="Введите рейтинг"
              className="input input-bordered w-full"
              min="0"
              max="5"
            />
          </div>

          {/* Date joined */}
          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Дата присоединения
              </span>
            </label>
            <input
              type="date"
              name="dateJoined"
              value={form.dateJoined}
              onChange={handleChange}
              className="input input-bordered w-full"
              required
            />
          </div>

          <div className="modal-action">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-success"
              disabled={loading}
            >
              {loading ? (
                <span className="loading loading-spinner"></span>
              ) : initialData ? (
                "Сохранить"
              ) : (
                "Добавить"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InternFormModal;
