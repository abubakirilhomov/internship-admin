import React, { useState, useEffect } from "react";
import {
  User,
  Lock,
  Building,
  UserCheck,
  Star,
  Award,
  Calendar,
  Phone,
  Send,
  Image,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "../../utils/api";

const InternFormModal = ({ onClose, branches, initialData, refresh }) => {
  const [form, setForm] = useState({
    name: "",
    lastName: "",
    username: "",
    password: "",
    phoneNumber: "",
    telegram: "",
    sphere: "backend-nodejs",
    profilePhoto: "",
    branches: [{ branch: "", mentor: "" }],
    lessonsVisitedFake: 0,
    rating: 0,
    grade: "junior",
    dateJoined: new Date().toISOString().split("T")[0],
  });

  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMentors();
  }, []);

  useEffect(() => {
    if (initialData) {
      const branchList = initialData.branches?.length
        ? initialData.branches.map((b) => ({
            branch: b.branch?._id || b.branch || "",
            mentor: b.mentor?._id || b.mentor || "",
          }))
        : [{ branch: initialData.branch?._id || "", mentor: initialData.mentor?._id || "" }];

      setForm({
        name: initialData.name || "",
        lastName: initialData.lastName || "",
        username: initialData.username || "",
        password: "",
        phoneNumber: initialData.phoneNumber || "",
        telegram: initialData.telegram || "",
        sphere: initialData.sphere || "backend-nodejs",
        profilePhoto: initialData.profilePhoto || "",
        branches: branchList,
        lessonsVisitedFake: (initialData.lessonsVisited || []).reduce((s, lv) => s + (lv.count || 0), 0),
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

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    try {
      setUploadingPhoto(true);
      const uploaded = await api.uploads.uploadImage(file, "interns");
      setForm((prev) => ({ ...prev, profilePhoto: uploaded.url }));
    } catch (uploadError) {
      setError(uploadError.message || "Ошибка загрузки фото");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleBranchRowChange = (idx, field, value) => {
    setForm((prev) => {
      const updated = [...prev.branches];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, branches: updated };
    });
  };

  const addBranchRow = () =>
    setForm((prev) => ({ ...prev, branches: [...prev.branches, { branch: "", mentor: "" }] }));

  const removeBranchRow = (idx) =>
    setForm((prev) => ({ ...prev, branches: prev.branches.filter((_, i) => i !== idx) }));

  const validateForm = () => {
    if (
      !form.name ||
      !form.lastName ||
      !form.username ||
      (!initialData && !form.password) ||
      !form.grade ||
      !form.dateJoined
    ) {
      setError("Пожалуйста, заполните все обязательные поля");
      return false;
    }
    if (form.branches.length === 0 || form.branches.some((b) => !b.branch || !b.mentor)) {
      setError("Укажите хотя бы один филиал и ментора");
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
        ...(form.password ? { password: form.password } : {}),
        phoneNumber: form.phoneNumber,
        telegram: form.telegram,
        sphere: form.sphere,
        profilePhoto: form.profilePhoto,
        branches: form.branches,
        grade: form.grade,
        dateJoined: form.dateJoined,
        lessonsVisitedFake: Number(form.lessonsVisitedFake),
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

          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <Phone className="h-4 w-4" /> Номер телефона
              </span>
            </label>
            <input
              type="text"
              name="phoneNumber"
              value={form.phoneNumber}
              onChange={handleChange}
              placeholder="+998..."
              className="input input-bordered w-full"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <Send className="h-4 w-4" /> Telegram
              </span>
            </label>
            <input
              type="text"
              name="telegram"
              value={form.telegram}
              onChange={handleChange}
              placeholder="@username"
              className="input input-bordered w-full"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <Award className="h-4 w-4" /> Сфера
              </span>
            </label>
            <select
              name="sphere"
              value={form.sphere}
              onChange={handleChange}
              className="select select-bordered w-full"
              required
            >
              <option value="backend-nodejs">Backend (Node.js)</option>
              <option value="backend-python">Backend (Python)</option>
              <option value="frontend-react">Frontend (React)</option>
              <option value="frontend-vue">Frontend (Vue)</option>
              <option value="mern-stack">MERN Stack</option>
              <option value="full-stack">Full Stack</option>
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <Image className="h-4 w-4" /> Фото профиля
              </span>
            </label>
            <input
              type="file"
              accept="image/*"
              className="file-input file-input-bordered w-full"
              onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
              disabled={uploadingPhoto}
            />
            <input
              type="text"
              name="profilePhoto"
              value={form.profilePhoto}
              onChange={handleChange}
              placeholder="URL фото появится после загрузки"
              className="input input-bordered w-full mt-2"
            />
            {uploadingPhoto && (
              <span className="text-sm text-info mt-1">Загрузка фото...</span>
            )}
            {form.profilePhoto && (
              <img
                src={form.profilePhoto}
                alt="preview"
                className="w-16 h-16 rounded-full object-cover mt-2 border"
              />
            )}
          </div>

          {/* Branches — dynamic list */}
          <div className="form-control">
            <label className="label">
              <span className="label-text flex items-center gap-2">
                <Building className="h-4 w-4" /> Филиалы и менторы
              </span>
            </label>
            <div className="flex flex-col gap-2">
              {form.branches.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={row.branch}
                    onChange={(e) => handleBranchRowChange(idx, "branch", e.target.value)}
                    className="select select-bordered flex-1"
                    required
                  >
                    <option value="">Филиал</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                  <select
                    value={row.mentor}
                    onChange={(e) => handleBranchRowChange(idx, "mentor", e.target.value)}
                    className="select select-bordered flex-1"
                    required
                    disabled={loading}
                  >
                    <option value="">Ментор</option>
                    {mentors.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name} {m.lastName || ""}
                      </option>
                    ))}
                  </select>
                  {form.branches.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBranchRow(idx)}
                      className="btn btn-ghost btn-sm text-error"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addBranchRow}
                className="btn btn-ghost btn-sm self-start gap-1 text-primary"
              >
                <Plus className="h-4 w-4" /> Добавить филиал
              </button>
            </div>
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
