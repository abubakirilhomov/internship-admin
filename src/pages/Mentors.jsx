import React, { useState, useEffect } from "react";
import {
  Plus, Pencil, Trash2, User, Lock, Building, Shield,
  X, Check, Image, Eye, EyeOff, CheckCircle, Copy,
  KeyRound, RefreshCw, MessageSquare,
} from "lucide-react";
import { api } from "../utils/api";

const MENTOR_URL = "https://mentors-mars.uz";

// ── helpers ──────────────────────────────────────────────────────────────────

const inputCls = (err) =>
  `w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${
    err
      ? "border-red-300 focus:border-red-400 bg-red-50"
      : "border-slate-200 focus:border-blue-400 bg-white"
  }`;

const Field = ({ label, icon: Icon, error, hint, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
      {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
      {label}
    </label>
    {children}
    {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

// ── CredentialCard ────────────────────────────────────────────────────────────

const CredentialCard = ({ mentorName, password, onClose }) => {
  const [copied, setCopied] = useState(false);

  const [firstName, ...lastParts] = mentorName.split(" ");
  const lastNameStr = lastParts.join(" ");
  const text = `Ваши данные для входа в систему MARS:\n\nСайт: ${MENTOR_URL}\nИмя: ${firstName}\nФамилия: ${lastNameStr}\nПароль: ${password}`;

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
        <h3 className="text-lg font-bold text-slate-900">Данные сохранены!</h3>
        <p className="text-sm text-slate-500 mt-0.5">{mentorName}</p>
      </div>

      <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Данные для входа</p>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Сайт</span>
            <span className="font-medium text-blue-600">{MENTOR_URL}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Имя</span>
            <span className="font-mono font-medium text-slate-900">{firstName}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Фамилия</span>
            <span className="font-mono font-medium text-slate-900">{lastNameStr}</span>
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
          copied ? "bg-green-500 text-white" : "bg-slate-900 hover:bg-slate-800 text-white"
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

// ── MentorFormModal ───────────────────────────────────────────────────────────

const MentorFormModal = ({ branches, editData, onClose, onSaved }) => {
  const isEditing = !!editData;
  const [form, setForm] = useState({
    name: editData?.name || "",
    lastName: editData?.lastName || "",
    password: "",
    profilePhoto: editData?.profilePhoto || "",
    branches: editData
      ? (editData.branches || []).map((b) => (typeof b === "object" ? b._id : b))
      : [],
    role: editData?.role || "mentor",
    telegramChatId: editData?.telegramChatId || "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [credentials, setCredentials] = useState(null);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Имя обязательно";
    if (!form.lastName.trim()) e.lastName = "Фамилия обязательна";
    if (!isEditing && !form.password) e.password = "Пароль обязателен";
    if (form.password && form.password.length < 6) e.password = "Минимум 6 символов";
    if (!form.branches.length) e.branches = "Выберите хотя бы один филиал";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    try {
      setUploadingPhoto(true);
      const uploaded = await api.uploads.uploadImage(file, "mentors");
      set("profilePhoto", uploaded.url);
    } catch (err) {
      setErrors((p) => ({ ...p, photo: err.message || "Ошибка загрузки" }));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (isEditing) {
        const res = await api.mentors.update(editData._id, form);
        if (res?.error || res?.message?.includes?.("error")) throw new Error(res.message || "Ошибка");
        if (form.password) {
          setCredentials({
            mentorName: `${form.name} ${form.lastName}`,
            password: form.password,
          });
        } else {
          onSaved();
          onClose();
        }
      } else {
        const res = await api.mentors.create(form);
        if (res?.error || res?.message?.includes?.("error")) throw new Error(res.message || "Ошибка");
        setCredentials({
          mentorName: `${form.name} ${form.lastName}`,
          password: form.password,
        });
      }
    } catch (err) {
      setErrors((p) => ({ ...p, submit: err.message || "Произошла ошибка" }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCredentialClose = () => {
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={credentials ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">
            {credentials ? (isEditing ? "Ментор обновлён" : "Ментор добавлен") : isEditing ? "Редактировать ментора" : "Добавить ментора"}
          </h3>
          {!credentials && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-6 py-5">
          {credentials ? (
            <CredentialCard
              mentorName={credentials.mentorName}
              password={credentials.password}
              onClose={handleCredentialClose}
            />
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {errors.submit && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">
                  <span className="flex-1">{errors.submit}</span>
                  <button type="button" onClick={() => setErrors((p) => ({ ...p, submit: null }))} className="text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Имя" icon={User} error={errors.name}>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => { set("name", e.target.value); setErrors((p) => ({ ...p, name: null })); }}
                    placeholder="Имя"
                    className={inputCls(errors.name)}
                    required
                  />
                </Field>
                <Field label="Фамилия" icon={User} error={errors.lastName}>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => { set("lastName", e.target.value); setErrors((p) => ({ ...p, lastName: null })); }}
                    placeholder="Фамилия"
                    className={inputCls(errors.lastName)}
                    required
                  />
                </Field>
              </div>

              <Field
                label={isEditing ? "Пароль (необязательно)" : "Пароль"}
                icon={Lock}
                error={errors.password}
                hint={!isEditing ? "Минимум 6 символов" : "Оставьте пустым, чтобы не менять"}
              >
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => { set("password", e.target.value); setErrors((p) => ({ ...p, password: null })); }}
                    placeholder={isEditing ? "Не менять" : "Введите пароль"}
                    className={`${inputCls(errors.password)} pr-9`}
                    required={!isEditing}
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

              <Field label="Фото профиля" icon={Image} error={errors.photo}>
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

              <div className="grid grid-cols-2 gap-3">
                <Field label="Филиалы" icon={Building} error={errors.branches} hint="Ctrl+click для нескольких">
                  <select
                    multiple
                    value={form.branches}
                    onChange={(e) => {
                      const sel = Array.from(e.target.selectedOptions).map((o) => o.value);
                      set("branches", sel);
                      setErrors((p) => ({ ...p, branches: null }));
                    }}
                    className={`${inputCls(errors.branches)} h-28`}
                  >
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Роль" icon={Shield} error={errors.role}>
                  <select
                    value={form.role}
                    onChange={(e) => set("role", e.target.value)}
                    className={inputCls(errors.role)}
                  >
                    <option value="mentor">Ментор</option>
                    <option value="branchManager">Branch Manager</option>
                    <option value="admin">Администратор</option>
                  </select>
                </Field>
              </div>

              <Field
                label="Telegram Chat ID"
                icon={MessageSquare}
                hint="Для BM-уведомлений по заявкам (числовой ID Telegram)"
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.telegramChatId}
                  onChange={(e) => set("telegramChatId", e.target.value)}
                  placeholder="Напр. 1844909205"
                  className={inputCls(false)}
                />
              </Field>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60 ${
                    isEditing ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {submitting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {isEditing ? "Сохранить" : "Создать ментора"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ── PasswordResetModal ────────────────────────────────────────────────────────

const PasswordResetModal = ({ mentorName, tempPassword, onClose }) => {
  const [copied, setCopied] = useState(false);
  const loginName = mentorName.split(" ")[0];
  const text = `Ваши данные для входа в систему MARS:\n\nСайт: ${MENTOR_URL}\nЛогин: ${loginName}\nПароль: ${tempPassword}`;

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Пароль сброшен</h3>
            <p className="text-sm text-slate-500">{mentorName}</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 mb-4">
          Этот пароль больше не будет показан. Передайте его ментору.
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Сайт</span>
            <span className="font-medium text-blue-600">{MENTOR_URL}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Логин</span>
            <span className="font-mono font-medium text-slate-900">{loginName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Пароль</span>
            <span className="font-mono font-medium text-slate-900">{tempPassword}</span>
          </div>
        </div>

        <button
          onClick={copy}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors mb-2 ${
            copied ? "bg-green-500 text-white" : "bg-slate-900 hover:bg-slate-800 text-white"
          }`}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Скопировано!" : "Скопировать данные"}
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const Mentors = () => {
  const [mentors, setMentors] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(null); // { mentorName, tempPassword }
  const [searchTerm, setSearchTerm] = useState("");
  const [marsFilter, setMarsFilter] = useState("all"); // all | linked | unlinked
  const [showCredentialsModal, setShowCredentialsModal] = useState(null); // { mentor, tempPassword? }
  const [credCopied, setCredCopied] = useState(false);
  const [credResetLoading, setCredResetLoading] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [m, b] = await Promise.all([api.mentors.getAll(), api.branches.getAll()]);
      setMentors(Array.isArray(m) ? m : m?.data || []);
      setBranches(Array.isArray(b) ? b : b?.data || []);
    } catch {
      // errors are visible from empty state
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.mentors.delete(id);
      setShowDeleteModal(null);
      fetchAll();
    } catch (err) {
      alert(err.message || "Ошибка при удалении");
    }
  };

  const confirmResetPassword = async () => {
    const mentor = showResetConfirmModal;
    try {
      const result = await api.mentors.resetPassword(mentor._id);
      setShowResetConfirmModal(null);
      setShowPasswordModal({
        mentorName: `${mentor.name} ${mentor.lastName || ""}`.trim(),
        tempPassword: result.tempPassword,
      });
    } catch (err) {
      alert(err.message || "Ошибка при сбросе пароля");
      setShowResetConfirmModal(null);
    }
  };

  const filteredMentors = mentors.filter((m) => {
    if (marsFilter === "linked" && !m.marsId?.sub) return false;
    if (marsFilter === "unlinked" && m.marsId?.sub) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.lastName?.toLowerCase().includes(q) ||
      m.marsId?.handle?.toLowerCase().includes(q)
    );
  });

  const linkedCount = mentors.filter((m) => m.marsId?.sub).length;
  const unlinkedCount = mentors.length - linkedCount;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3 text-slate-400">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-sm">Загрузка данных...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Менторы</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {mentors.length} {mentors.length === 1 ? "ментор" : "менторов"} в системе
          </p>
        </div>
        <button
          onClick={() => { setEditData(null); setShowFormModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить ментора
        </button>
      </div>

      {/* Search + Mars ID filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 max-w-sm flex-1 min-w-[220px]">
          <input
            type="text"
            placeholder="Поиск по имени или Mars ID handle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="text-slate-400 hover:text-slate-600 text-sm px-2">✕</button>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => setMarsFilter("all")}
            className={`px-2.5 py-1.5 rounded-lg border ${marsFilter === "all" ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            Все ({mentors.length})
          </button>
          <button
            onClick={() => setMarsFilter("linked")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${marsFilter === "linked" ? "border-green-400 bg-green-50 text-green-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            С Mars ID ({linkedCount})
          </button>
          <button
            onClick={() => setMarsFilter("unlinked")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${marsFilter === "unlinked" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            Без Mars ID ({unlinkedCount})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500">Имя</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Фамилия</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Филиал</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Роль</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Mars ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Дата</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Фото</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredMentors.map((mentor) => (
                <tr key={mentor._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{mentor.name}</td>
                  <td className="px-4 py-3 text-slate-600">{mentor.lastName || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(mentor.branches || []).map((b, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs">
                          {typeof b === "object" ? b.name : branches.find((br) => br._id === b)?.name || "N/A"}
                        </span>
                      ))}
                      {!mentor.branches?.length && <span className="text-slate-300">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                      mentor.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : mentor.role === "branchManager"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {mentor.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {mentor.marsId?.sub ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200"
                        title={`Привязан ${mentor.marsId.linkedAt ? new Date(mentor.marsId.linkedAt).toLocaleDateString("ru-RU") : ""}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        {mentor.marsId.handle ? `@${mentor.marsId.handle}` : "привязан"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs text-slate-400 bg-slate-50 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        не привязан
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(mentor.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-4 py-3">
                    {mentor.profilePhoto ? (
                      <img src={mentor.profilePhoto} alt={mentor.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-300" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => { setShowCredentialsModal({ mentor, tempPassword: null }); setCredCopied(false); }}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Реквизиты"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setEditData(mentor); setShowFormModal(true); }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Редактировать"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowResetConfirmModal(mentor)}
                        className="p-1.5 text-amber-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Сбросить пароль"
                      >
                        <Lock className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteModal(mentor)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMentors.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">
                    {searchTerm ? "Ничего не найдено" : "Нет менторов"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form modal */}
      {showFormModal && (
        <MentorFormModal
          branches={branches}
          editData={editData}
          onClose={() => setShowFormModal(false)}
          onSaved={fetchAll}
        />
      )}

      {/* Credentials modal */}
      {showCredentialsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCredentialsModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <KeyRound className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-bold text-slate-900">Реквизиты</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {showCredentialsModal.mentor.name} {showCredentialsModal.mentor.lastName || ""}
                  </p>
                </div>

                <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Сайт</span>
                    <span className="font-medium text-blue-600">mentors-mars.uz</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Имя</span>
                    <span className="font-mono font-medium text-slate-900">{showCredentialsModal.mentor.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Фамилия</span>
                    <span className="font-mono font-medium text-slate-900">{showCredentialsModal.mentor.lastName || "—"}</span>
                  </div>
                  {showCredentialsModal.tempPassword && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Новый пароль</span>
                      <span className="font-mono font-medium text-slate-900">{showCredentialsModal.tempPassword}</span>
                    </div>
                  )}
                </div>

                <div className="w-full flex flex-col gap-2">
                  <button
                    onClick={async () => {
                      const m = showCredentialsModal;
                      const text = m.tempPassword
                        ? `Ваши данные для входа:\n\nСайт: https://mentors-mars.uz\nИмя: ${m.mentor.name}\nФамилия: ${m.mentor.lastName || ""}\nПароль: ${m.tempPassword}`
                        : `Ваши данные для входа:\n\nСайт: https://mentors-mars.uz\nИмя: ${m.mentor.name}\nФамилия: ${m.mentor.lastName || ""}`;
                      await navigator.clipboard.writeText(text);
                      setCredCopied(true);
                      setTimeout(() => setCredCopied(false), 2000);
                    }}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      credCopied ? "bg-green-500 text-white" : "bg-slate-900 hover:bg-slate-800 text-white"
                    }`}
                  >
                    {credCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {credCopied ? "Скопировано!" : "Скопировать"}
                  </button>

                  <button
                    disabled={credResetLoading}
                    onClick={async () => {
                      setCredResetLoading(true);
                      try {
                        const res = await api.mentors.resetPassword(showCredentialsModal.mentor._id);
                        setShowCredentialsModal((prev) => ({ ...prev, tempPassword: res.tempPassword }));
                        setCredCopied(false);
                      } catch (err) {
                        alert(err.message || "Ошибка сброса пароля");
                      } finally {
                        setCredResetLoading(false);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${credResetLoading ? "animate-spin" : ""}`} />
                    Сбросить пароль
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-1">Удалить ментора?</h3>
            <p className="text-sm text-slate-500 mb-6">
              <strong>{showDeleteModal.name} {showDeleteModal.lastName || ""}</strong> будет удалён без возможности восстановления.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(null)} className="flex-1 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Отмена</button>
              <button onClick={() => handleDelete(showDeleteModal._id)} className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors">Удалить</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password confirm */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowResetConfirmModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-1">Сбросить пароль?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Будет создан временный пароль для <strong>{showResetConfirmModal.name} {showResetConfirmModal.lastName || ""}</strong>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowResetConfirmModal(null)} className="flex-1 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Отмена</button>
              <button onClick={confirmResetPassword} className="flex-1 px-4 py-2.5 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors">Сбросить</button>
            </div>
          </div>
        </div>
      )}

      {/* Password reset result */}
      {showPasswordModal && (
        <PasswordResetModal
          mentorName={showPasswordModal.mentorName}
          tempPassword={showPasswordModal.tempPassword}
          onClose={() => setShowPasswordModal(null)}
        />
      )}
    </div>
  );
};

export default Mentors;
