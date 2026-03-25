import React, { useState, useEffect } from "react";
import {
  User, Lock, Building, Award, Calendar,
  Phone, Send, Image, Plus, Trash2, Eye, EyeOff,
  CheckCircle, Copy, Check, X,
} from "lucide-react";
import { api } from "../../utils/api";

const INTERN_URL = "https://interns-mars.uz";

const Field = ({ label, icon: Icon, error, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
      {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
      {label}
    </label>
    {children}
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

const inputCls = (err) =>
  `w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${
    err
      ? "border-red-300 focus:border-red-400 bg-red-50"
      : "border-slate-200 focus:border-blue-400 bg-white"
  }`;

const CredentialCard = ({ name, username, password, onClose }) => {
  const [copied, setCopied] = useState(false);

  const text = `Ваши данные для входа в стажёрскую систему:\n\nСайт: ${INTERN_URL}\nЛогин: ${username}\nПароль: ${password}`;

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-5 py-4 px-2">
      <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-green-500" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-bold text-slate-900">Стажёр создан!</h3>
        <p className="text-sm text-slate-500 mt-0.5">{name}</p>
      </div>

      <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Данные для входа</p>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Сайт</span>
            <span className="font-medium text-blue-600">{INTERN_URL}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Логин</span>
            <span className="font-mono font-medium text-slate-900">{username}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Пароль</span>
            <span className="font-mono font-medium text-slate-900">{password}</span>
          </div>
        </div>
      </div>

      <button
        onClick={copy}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          copied
            ? "bg-green-500 text-white"
            : "bg-slate-900 hover:bg-slate-800 text-white"
        }`}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? "Скопировано!" : "Скопировать данные"}
      </button>

      <button
        onClick={onClose}
        className="w-full py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
      >
        Закрыть
      </button>
    </div>
  );
};

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
    grade: "junior",
    dateJoined: new Date().toISOString().split("T")[0],
  });

  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [credentials, setCredentials] = useState(null); // set after create

  useEffect(() => {
    const fetchMentors = async () => {
      try {
        const data = await api.mentors.getAll();
        setMentors(Array.isArray(data) ? data : data?.data || []);
      } catch {
        setError("Ошибка при загрузке менторов");
      }
    };
    fetchMentors();
  }, []);

  useEffect(() => {
    if (!initialData) return;
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
      grade: initialData.grade || "junior",
      dateJoined: initialData.dateJoined
        ? new Date(initialData.dateJoined).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    });
  }, [initialData]);

  const set = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    try {
      setUploadingPhoto(true);
      const uploaded = await api.uploads.uploadImage(file, "interns");
      set("profilePhoto", uploaded.url);
    } catch (err) {
      setError(err.message || "Ошибка загрузки фото");
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

  const validate = () => {
    if (!form.name || !form.lastName || !form.username || (!initialData && !form.password) || !form.dateJoined) {
      setError("Заполните все обязательные поля");
      return false;
    }
    if (form.branches.length === 0 || form.branches.some((b) => !b.branch || !b.mentor)) {
      setError("Укажите хотя бы один филиал и ментора");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setLoading(true);
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
        await refresh();
        onClose();
      } else {
        await api.interns.create(payload);
        await refresh();
        setCredentials({
          name: `${form.name} ${form.lastName}`,
          username: form.username,
          password: form.password,
        });
      }
    } catch (err) {
      setError(err.message || "Ошибка при сохранении стажёра");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={credentials ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">
            {credentials ? "Стажёр добавлен" : initialData ? "Редактировать стажёра" : "Добавить стажёра"}
          </h3>
          {!credentials && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-6 py-5">
          {/* Credentials view after creation */}
          {credentials ? (
            <CredentialCard
              name={credentials.name}
              username={credentials.username}
              password={credentials.password}
              onClose={onClose}
            />
          ) : (
            <>
              {error && (
                <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">
                  <span className="flex-1">{error}</span>
                  <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Имя" icon={User}>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Имя"
                      className={inputCls()}
                      required
                    />
                  </Field>
                  <Field label="Фамилия" icon={User}>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => set("lastName", e.target.value)}
                      placeholder="Фамилия"
                      className={inputCls()}
                      required
                    />
                  </Field>
                </div>

                {/* Username */}
                <Field label="Логин (username)" icon={User}>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => set("username", e.target.value)}
                    placeholder="username"
                    className={inputCls()}
                    required
                  />
                </Field>

                {/* Password */}
                <Field label={initialData ? "Пароль (необязательно)" : "Пароль"} icon={Lock}>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      placeholder={initialData ? "Оставьте пустым, чтобы не менять" : "Введите пароль"}
                      className={`${inputCls()} pr-9`}
                      required={!initialData}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>

                {/* Phone + Telegram */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Телефон" icon={Phone}>
                    <input
                      type="text"
                      value={form.phoneNumber}
                      onChange={(e) => set("phoneNumber", e.target.value)}
                      placeholder="+998..."
                      className={inputCls()}
                    />
                  </Field>
                  <Field label="Telegram" icon={Send}>
                    <input
                      type="text"
                      value={form.telegram}
                      onChange={(e) => set("telegram", e.target.value)}
                      placeholder="@username"
                      className={inputCls()}
                    />
                  </Field>
                </div>

                {/* Sphere + Grade */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Сфера" icon={Award}>
                    <select
                      value={form.sphere}
                      onChange={(e) => set("sphere", e.target.value)}
                      className={inputCls()}
                      required
                    >
                      <option value="backend-nodejs">Backend (Node.js)</option>
                      <option value="backend-python">Backend (Python)</option>
                      <option value="frontend-react">Frontend (React)</option>
                      <option value="frontend-vue">Frontend (Vue)</option>
                      <option value="mern-stack">MERN Stack</option>
                      <option value="full-stack">Full Stack</option>
                    </select>
                  </Field>
                  <Field label="Уровень" icon={Award}>
                    <select
                      value={form.grade}
                      onChange={(e) => set("grade", e.target.value)}
                      className={inputCls()}
                      required
                    >
                      <option value="junior">Junior</option>
                      <option value="strongJunior">Strong Junior</option>
                      <option value="middle">Middle</option>
                      <option value="strongMiddle">Strong Middle</option>
                      <option value="senior">Senior</option>
                    </select>
                  </Field>
                </div>

                {/* Photo */}
                <Field label="Фото профиля" icon={Image}>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 transition-colors"
                    onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
                    disabled={uploadingPhoto}
                  />
                  {uploadingPhoto && <p className="text-xs text-blue-500">Загрузка...</p>}
                  {form.profilePhoto && (
                    <div className="flex items-center gap-2 mt-1">
                      <img src={form.profilePhoto} alt="preview" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                      <span className="text-xs text-slate-400 truncate max-w-xs">{form.profilePhoto}</span>
                    </div>
                  )}
                </Field>

                {/* Branches */}
                <Field label="Филиалы и менторы" icon={Building}>
                  <div className="flex flex-col gap-2">
                    {form.branches.map((row, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          value={row.branch}
                          onChange={(e) => {
                            handleBranchRowChange(idx, "branch", e.target.value);
                            handleBranchRowChange(idx, "mentor", "");
                          }}
                          className={`${inputCls()} flex-1`}
                          required
                        >
                          <option value="">Выберите филиал</option>
                          {branches.map((b) => (
                            <option key={b._id} value={b._id}>{b.name}</option>
                          ))}
                        </select>
                        <select
                          value={row.mentor}
                          onChange={(e) => handleBranchRowChange(idx, "mentor", e.target.value)}
                          className={`${inputCls()} flex-1`}
                          required
                        >
                          <option value="">Выберите ментора</option>
                          {mentors
                            .filter((m) =>
                              !row.branch ||
                              m.branches?.some((b) => String(b._id || b) === String(row.branch))
                            )
                            .map((m) => (
                              <option key={m._id} value={m._id}>
                                {m.name} {m.lastName || ""}
                              </option>
                            ))}
                        </select>
                        {form.branches.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, branches: p.branches.filter((_, i) => i !== idx) }))}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, branches: [...p.branches, { branch: "", mentor: "" }] }))}
                      className="self-start flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Добавить филиал
                    </button>
                  </div>
                </Field>

                {/* Lessons + Date */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Уроков (начальное)" icon={null}>
                    <input
                      type="number"
                      value={form.lessonsVisitedFake}
                      onChange={(e) => set("lessonsVisitedFake", e.target.value)}
                      className={inputCls()}
                      min="0"
                    />
                  </Field>
                  <Field label="Дата начала" icon={Calendar}>
                    <input
                      type="date"
                      value={form.dateJoined}
                      onChange={(e) => set("dateJoined", e.target.value)}
                      className={inputCls()}
                      required
                    />
                  </Field>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 mt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60"
                  >
                    {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {initialData ? "Сохранить" : "Добавить стажёра"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InternFormModal;
