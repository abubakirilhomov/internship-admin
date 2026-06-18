import React, { useEffect, useState } from "react";
import { UserPlus, RefreshCw, Check, X, Copy } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import { api } from "../utils/api";

const SPHERES = [
  { value: "backend-nodejs", label: "Backend (Node.js)" },
  { value: "backend-python", label: "Backend (Python)" },
  { value: "frontend-react", label: "Frontend (React)" },
  { value: "frontend-vue", label: "Frontend (Vue)" },
  { value: "mern-stack", label: "MERN Stack" },
  { value: "full-stack", label: "Full Stack" },
];

const emptyForm = {
  name: "",
  lastName: "",
  username: "",
  sphere: "backend-nodejs",
  mentor: "",
  phoneNumber: "",
  telegram: "",
  profilePhoto: "",
};

const InternRequests = () => {
  const [requests, setRequests] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // request under review
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approved, setApproved] = useState(null); // { name, username, tempPassword }

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.internRequests.getAll("pending");
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch (err) {
      toast.error(err.message || "Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    (async () => {
      try {
        const data = await api.mentors.getAll();
        setMentors(Array.isArray(data) ? data : data?.data || []);
      } catch {
        /* mentors optional for display */
      }
    })();
  }, []);

  const openReview = (req) => {
    setEditing(req);
    setRejectMode(false);
    setRejectionReason("");
    setForm({
      name: req.name || "",
      lastName: req.lastName || "",
      username: req.username || "",
      sphere: req.sphere || "backend-nodejs",
      mentor: req.mentor?._id || req.mentor || "",
      phoneNumber: req.phoneNumber || "",
      telegram: req.telegram || "",
      profilePhoto: req.profilePhoto || "",
    });
  };

  const closeReview = () => {
    setEditing(null);
    setRejectMode(false);
    setRejectionReason("");
  };

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const branchId = editing?.branch?._id || editing?.branch;
  const branchMentors = mentors.filter(
    (m) =>
      m.role === "mentor" &&
      m.branches?.some((b) => String(b._id || b) === String(branchId))
  );

  const approve = async () => {
    if (!editing) return;
    if (!form.name || !form.lastName || !form.username || !form.mentor) {
      toast.error("Заполните обязательные поля (имя, фамилия, логин, ментор)");
      return;
    }
    setSaving(true);
    try {
      const res = await api.internRequests.approve(editing._id, form);
      setRequests((prev) => prev.filter((r) => r._id !== editing._id));
      setApproved({
        name: `${res.intern.name} ${res.intern.lastName}`.trim(),
        username: res.intern.username,
        tempPassword: res.tempPassword,
      });
      closeReview();
    } catch (err) {
      toast.error(err.message || "Ошибка при одобрении");
    } finally {
      setSaving(false);
    }
  };

  const reject = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.internRequests.reject(editing._id, rejectionReason);
      setRequests((prev) => prev.filter((r) => r._id !== editing._id));
      toast.success("Заявка отклонена");
      closeReview();
    } catch (err) {
      toast.error(err.message || "Ошибка при отклонении");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <UserPlus className="h-7 w-7 text-indigo-500" />
            Заявки на создание интернов
          </h1>
          <p className="text-slate-500">
            Хед-интерны подают заявки на создание новых интернов в своём филиале.
            Проверьте данные и одобрите — интерн будет создан (грейд junior,
            пароль сгенерируется автоматически).
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-12 text-center text-slate-500">
          Нет заявок на рассмотрении.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Новый интерн</th>
                <th className="text-left px-4 py-3 font-medium">Логин</th>
                <th className="text-left px-4 py-3 font-medium">Филиал</th>
                <th className="text-left px-4 py-3 font-medium">Ментор</th>
                <th className="text-left px-4 py-3 font-medium">От хеда</th>
                <th className="text-left px-4 py-3 font-medium">Дата</th>
                <th className="text-right px-4 py-3 font-medium">Действие</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r._id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {r.name} {r.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-700">@{r.username}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.branch?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.mentor
                      ? `${r.mentor.name || ""} ${r.mentor.lastName || ""}`.trim()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.requestedByName ||
                      (r.requestedBy
                        ? `${r.requestedBy.name || ""} ${r.requestedBy.lastName || ""}`.trim()
                        : "—")}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openReview(r)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"
                    >
                      Рассмотреть
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review / edit modal */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeReview}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-1">
                Заявка на интерна
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Филиал: <span className="font-medium">{editing.branch?.name || "—"}</span>{" "}
                · От: {editing.requestedByName || "—"} · Грейд: junior
              </p>

              {!rejectMode ? (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Имя *</label>
                      <input name="name" value={form.name} onChange={handleChange}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Фамилия *</label>
                      <input name="lastName" value={form.lastName} onChange={handleChange}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Логин *</label>
                    <input name="username" value={form.username} onChange={handleChange}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Направление</label>
                      <select name="sphere" value={form.sphere} onChange={handleChange}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        {SPHERES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Ментор *</label>
                      <select name="mentor" value={form.mentor} onChange={handleChange}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Выберите ментора</option>
                        {branchMentors.map((m) => (
                          <option key={m._id} value={m._id}>{m.name} {m.lastName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Телефон</label>
                      <input name="phoneNumber" value={form.phoneNumber} onChange={handleChange}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Telegram</label>
                      <input name="telegram" value={form.telegram} onChange={handleChange}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-between">
                    <button
                      onClick={() => setRejectMode(true)}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-50 text-red-700 rounded-xl hover:bg-red-100 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" /> Отклонить
                    </button>
                    <div className="flex gap-3">
                      <button onClick={closeReview}
                        className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">
                        Отмена
                      </button>
                      <button
                        onClick={approve}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-xl disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {saving ? "Создаю..." : "Одобрить и создать"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Причина отклонения
                  </label>
                  <textarea
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Например: дубликат, неверные данные..."
                  />
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setRejectMode(false)}
                      className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">
                      Назад
                    </button>
                    <button
                      onClick={reject}
                      disabled={saving}
                      className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-50"
                    >
                      {saving ? "Отклоняю..." : "Отклонить заявку"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approved → temp password (one-time) */}
      {approved && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setApproved(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Интерн создан ✅
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                {approved.name} (@{approved.username}). Передайте логин и
                временный пароль — интерн сменит его при первом входе.
              </p>
              <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mb-4">
                <span className="font-mono text-sm font-semibold">
                  {approved.tempPassword}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(approved.tempPassword);
                    toast.success("Скопировано");
                  }}
                  className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                >
                  <Copy className="h-3.5 w-3.5" /> Копировать
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setApproved(null)}
                  className="px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-xl"
                >
                  Готово
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default InternRequests;
