import React, { useEffect, useMemo, useState } from "react";
import {
  Inbox,
  RefreshCw,
  Search,
  X,
  Copy,
  Check,
  Send,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import { api } from "../utils/api";

const STATUSES = [
  { value: "pending", label: "Новая", chip: "bg-yellow-100 text-yellow-800" },
  { value: "contacted", label: "Связались", chip: "bg-blue-100 text-blue-700" },
  {
    value: "interview_scheduled",
    label: "Собеседование",
    chip: "bg-purple-100 text-purple-700",
  },
  { value: "no_show", label: "Не пришёл", chip: "bg-slate-200 text-slate-700" },
  { value: "accepted", label: "Принят", chip: "bg-green-100 text-green-700" },
  { value: "rejected", label: "Отклонён", chip: "bg-red-100 text-red-700" },
  { value: "duplicate", label: "Дубликат", chip: "bg-orange-100 text-orange-700" },
];

const SPHERE_LABELS = {
  "backend-nodejs": "Backend Node",
  "backend-python": "Backend Python",
  "frontend-react": "Frontend React",
  "frontend-vue": "Frontend Vue",
  "mern-stack": "React + Python",
  "full-stack": "React + Node",
};

const SHIFT_LABELS = {
  morning: "1-смена (утро)",
  evening: "2-смена (вечер)",
};

const PAGE_SIZE = 25;

const statusMeta = (s) => STATUSES.find((x) => x.value === s) || null;

const formatDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const fullName = (entity) => {
  if (!entity) return "—";
  return `${entity.name || ""} ${entity.lastName || ""}`.trim() || "—";
};

// ── StatusChip ──────────────────────────────────────────────────────────────

const StatusChip = ({ status }) => {
  const meta = statusMeta(status);
  if (!meta) return <span className="text-slate-400 text-xs">{status}</span>;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${meta.chip}`}
    >
      {meta.label}
    </span>
  );
};

// ── StatusModal ─────────────────────────────────────────────────────────────

const StatusModal = ({ application, onClose, onSaved }) => {
  const [status, setStatus] = useState(application.status);
  const [notes, setNotes] = useState(application.notes || "");
  const [rejectionReason, setRejectionReason] = useState(
    application.rejectionReason || ""
  );
  const [interviewDate, setInterviewDate] = useState(
    application.interviewDate
      ? new Date(application.interviewDate).toISOString().slice(0, 16)
      : ""
  );
  const [submitting, setSubmitting] = useState(false);

  const showRejection = status === "rejected";
  const showInterviewDate = status === "interview_scheduled";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { status, notes };
      if (showRejection) payload.rejectionReason = rejectionReason;
      if (showInterviewDate && interviewDate) {
        payload.interviewDate = new Date(interviewDate).toISOString();
      }
      await api.applications.updateStatus(application._id, payload);
      toast.success("Статус обновлён");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || "Ошибка при обновлении");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">
            Заявка: {application.firstName} {application.lastName}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-3 text-sm mb-5">
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Телефон</p>
              <p className="font-medium text-slate-800">{application.phone}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Telegram</p>
              <p className="font-medium text-slate-800">
                @{application.telegramUsername}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Возраст</p>
              <p className="font-medium text-slate-800">{application.age}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Подана</p>
              <p className="font-medium text-slate-800">
                {formatDate(application.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Филиал</p>
              <p className="font-medium text-slate-800">
                {application.branch?.name || "—"}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Ментор</p>
              <p className="font-medium text-slate-800">
                {fullName(application.mentor)}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Направление</p>
              <p className="font-medium text-slate-800">
                {SPHERE_LABELS[application.sphere] || application.sphere}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-0.5">Смена</p>
              <p className="font-medium text-slate-800">
                {SHIFT_LABELS[application.shift] || application.shift}
              </p>
            </div>
          </div>

          {application.telegramNotified === false && application.telegramError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg mb-4">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Telegram-уведомление не отправлено</p>
                <p className="opacity-80 break-all">{application.telegramError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Статус
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:border-blue-400 outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {showInterviewDate && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Дата собеседования
                </label>
                <input
                  type="datetime-local"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:border-blue-400 outline-none"
                />
              </div>
            )}

            {showRejection && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Причина отказа
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:border-blue-400 outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Заметка (опционально)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:border-blue-400 outline-none"
              />
            </div>

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
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                {submitting && (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Сохранить
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ── ConvertModal ────────────────────────────────────────────────────────────

const ConvertModal = ({ application, onClose, onSaved }) => {
  const [stage, setStage] = useState("confirm"); // confirm | done
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState({ user: false, pass: false });

  const submit = async () => {
    setSubmitting(true);
    try {
      const data = await api.applications.convert(application._id);
      setResult(data);
      setStage("done");
      toast.success("Стажёр создан");
      onSaved();
    } catch (err) {
      toast.error(err.message || "Не удалось конвертировать");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = (key, value) => {
    navigator.clipboard?.writeText(value);
    setCopied((p) => ({ ...p, [key]: true }));
    setTimeout(() => setCopied((p) => ({ ...p, [key]: false })), 1500);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={stage === "done" ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">
            {stage === "confirm" ? "Конвертировать в стажёра?" : "Стажёр создан"}
          </h3>
          {stage === "confirm" && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-6 py-5">
          {stage === "confirm" ? (
            <>
              <p className="text-sm text-slate-600 mb-4">
                Будет создан новый стажёр (junior) с временным паролем. Пароль
                будет показан один раз — обязательно скопируйте его.
              </p>
              <div className="bg-slate-50 rounded-lg p-3 text-sm mb-5 space-y-1">
                <div>
                  <span className="text-slate-400">Имя: </span>
                  <span className="font-medium">
                    {application.firstName} {application.lastName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Username: </span>
                  <span className="font-mono">{application.telegramUsername}</span>
                </div>
                <div>
                  <span className="text-slate-400">Направление: </span>
                  <span>
                    {SPHERE_LABELS[application.sphere] || application.sphere}
                  </span>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Отмена
                </button>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2 disabled:opacity-60"
                >
                  {submitting && (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  Создать
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg mb-4">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>
                  Этот пароль больше не будет показан. Скопируйте его и
                  отправьте интерну.
                </p>
              </div>

              <div className="mb-3">
                <label className="block text-xs text-slate-500 mb-1">
                  Username
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-slate-100 rounded-lg text-sm font-mono">
                    {result?.intern?.username}
                  </code>
                  <button
                    onClick={() => copy("user", result?.intern?.username || "")}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                  >
                    {copied.user ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-xs text-slate-500 mb-1">
                  Временный пароль
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-slate-100 rounded-lg text-sm font-mono">
                    {result?.tempPassword}
                  </code>
                  <button
                    onClick={() => copy("pass", result?.tempPassword || "")}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                  >
                    {copied.pass ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Готово
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Applications page ───────────────────────────────────────────────────────

const Applications = () => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);

  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [statusModal, setStatusModal] = useState(null);
  const [convertModal, setConvertModal] = useState(null);
  const [retrying, setRetrying] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const queryParams = useMemo(
    () => ({
      status: selectedStatuses.join(","),
      branch: branchId,
      from,
      to,
      q,
      page,
      limit: PAGE_SIZE,
    }),
    [selectedStatuses, branchId, from, to, q, page]
  );

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.applications.getAll(queryParams);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number.isFinite(data?.total) ? data.total : 0);
    } catch (err) {
      toast.error(err.message || "Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const list = await api.branches.getAll();
        setBranches(Array.isArray(list) ? list : []);
      } catch (err) {
        toast.error(err.message || "Не удалось загрузить филиалы");
      }
    })();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams]);

  const toggleStatus = (value) => {
    setPage(1);
    setSelectedStatuses((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  const resetFilters = () => {
    setSelectedStatuses([]);
    setBranchId("");
    setFrom("");
    setTo("");
    setQ("");
    setPage(1);
  };

  const retryNotify = async (app) => {
    setRetrying(app._id);
    try {
      const r = await api.applications.retryNotify(app._id);
      if (r.sent > 0) {
        toast.success(`Отправлено: ${r.sent}, ошибок: ${r.failed}`);
      } else {
        toast.error(`Не отправлено. Ошибок: ${r.failed}. ${r.errors?.[0] || ""}`);
      }
      load();
    } catch (err) {
      toast.error(err.message || "Ошибка повторной отправки");
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <Inbox className="h-7 w-7 text-blue-500" />
            Заявки
            <span className="text-base font-medium text-slate-400">
              ({total})
            </span>
          </h1>
          <p className="text-slate-500">
            Поступающие заявки с лендинга. Триаж, смена статусов, конвертация в
            стажёра.
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

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => {
            const active = selectedStatuses.includes(s.value);
            return (
              <button
                key={s.value}
                onClick={() => toggleStatus(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? s.chip + " ring-2 ring-offset-1 ring-slate-300"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Поиск</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
                placeholder="Имя, телефон, telegram"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:border-blue-400 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Филиал</label>
            <select
              value={branchId}
              onChange={(e) => {
                setPage(1);
                setBranchId(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:border-blue-400 outline-none"
            >
              <option value="">Все</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">С даты</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:border-blue-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">По дату</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:border-blue-400 outline-none"
            />
          </div>
        </div>

        {(selectedStatuses.length > 0 || branchId || from || to || q) && (
          <div>
            <button
              onClick={resetFilters}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-12 text-center text-slate-500">
          Заявок не найдено.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Подана</th>
                  <th className="text-left px-4 py-3 font-medium">ФИО</th>
                  <th className="text-left px-4 py-3 font-medium">Контакты</th>
                  <th className="text-left px-4 py-3 font-medium">Филиал</th>
                  <th className="text-left px-4 py-3 font-medium">Ментор</th>
                  <th className="text-left px-4 py-3 font-medium">Направление</th>
                  <th className="text-left px-4 py-3 font-medium">Смена</th>
                  <th className="text-left px-4 py-3 font-medium">Статус</th>
                  <th className="text-right px-4 py-3 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => {
                  const canConvert =
                    a.status !== "accepted" &&
                    a.status !== "duplicate" &&
                    !a.convertedToIntern;
                  const canRetry = a.telegramNotified === false;
                  return (
                    <tr key={a._id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(a.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-900 font-medium whitespace-nowrap">
                        {a.firstName} {a.lastName}
                        <div className="text-xs text-slate-400">
                          {a.age} лет
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 text-xs">
                        <div>{a.phone}</div>
                        <div className="text-slate-400">
                          @{a.telegramUsername}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {a.branch?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {fullName(a.mentor)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 text-xs">
                        {SPHERE_LABELS[a.sphere] || a.sphere}
                      </td>
                      <td className="px-4 py-3 text-slate-700 text-xs">
                        {SHIFT_LABELS[a.shift] || a.shift}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={a.status} />
                        {a.telegramNotified === false && (
                          <div
                            className="text-[10px] text-red-500 mt-0.5"
                            title={a.telegramError || ""}
                          >
                            tg: error
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setStatusModal(a)}
                            className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                            title="Открыть"
                          >
                            Открыть
                          </button>
                          {canConvert && (
                            <button
                              onClick={() => setConvertModal(a)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                              title="Конвертировать в стажёра"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              В стажёры
                            </button>
                          )}
                          {canRetry && (
                            <button
                              onClick={() => retryNotify(a)}
                              disabled={retrying === a._id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50"
                              title="Повторить Telegram-уведомление"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Retry
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
              <div className="text-slate-500">
                Страница {page} из {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                >
                  Назад
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                >
                  Вперёд
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {statusModal && (
        <StatusModal
          application={statusModal}
          onClose={() => setStatusModal(null)}
          onSaved={load}
        />
      )}

      {convertModal && (
        <ConvertModal
          application={convertModal}
          onClose={() => setConvertModal(null)}
          onSaved={load}
        />
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Applications;
