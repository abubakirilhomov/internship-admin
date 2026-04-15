import React, { useEffect, useState } from "react";
import { AlertTriangle, Unlock, RefreshCw } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import { api } from "../utils/api";

const StuckFeedbacks = () => {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [confirmLesson, setConfirmLesson] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.lessons.getStuckFeedbacks();
      setLessons(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || "Не удалось загрузить список");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const forceClose = async () => {
    if (!confirmLesson) return;
    setResolving(confirmLesson._id);
    try {
      await api.lessons.forceCloseFeedback(confirmLesson._id, noteDraft);
      toast.success("Фидбек закрыт, интерн разблокирован");
      setLessons((prev) => prev.filter((l) => l._id !== confirmLesson._id));
      setConfirmLesson(null);
      setNoteDraft("");
    } catch (err) {
      toast.error(err.message || "Ошибка при закрытии");
    } finally {
      setResolving(null);
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
            <AlertTriangle className="h-7 w-7 text-orange-500" />
            Застрявшие фидбеки
          </h1>
          <p className="text-slate-500">
            Уроки, для которых интерн не отправил фидбек. Эти интерны
            заблокированы от добавления новых уроков.
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
      ) : lessons.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-12 text-center text-slate-500">
          Нет застрявших фидбеков. Все интерны оценили свои уроки.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Интерн</th>
                <th className="text-left px-4 py-3 font-medium">Ментор</th>
                <th className="text-left px-4 py-3 font-medium">Тема</th>
                <th className="text-left px-4 py-3 font-medium">Дата урока</th>
                <th className="text-left px-4 py-3 font-medium">Создан</th>
                <th className="text-right px-4 py-3 font-medium">Действие</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((l) => {
                const internName = l.intern
                  ? `${l.intern.name || ""} ${l.intern.lastName || ""}`.trim()
                  : "—";
                const mentorName = l.mentor
                  ? `${l.mentor.name || ""} ${l.mentor.lastName || ""}`.trim()
                  : "—";
                return (
                  <tr key={l._id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-900 font-medium">
                      {internName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{mentorName}</td>
                    <td className="px-4 py-3 text-slate-700">{l.topic || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(l.date)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {formatDate(l.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setConfirmLesson(l)}
                        disabled={resolving === l._id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50"
                      >
                        <Unlock className="h-3.5 w-3.5" />
                        Закрыть
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmLesson && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmLesson(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Закрыть фидбек?
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Урок{" "}
                <span className="font-medium">
                  {confirmLesson.intern
                    ? `${confirmLesson.intern.name} ${confirmLesson.intern.lastName || ""}`.trim()
                    : "?"}
                </span>{" "}
                будет помечен как «фидбек отправлен» без реальных данных от
                интерна. Используйте это только если интерн не может сам
                закрыть модалку.
              </p>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Заметка (опционально)
              </label>
              <textarea
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
                rows={3}
                maxLength={200}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Например: интерн не мог сабмитить, URL был сломан"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setConfirmLesson(null);
                    setNoteDraft("");
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Отмена
                </button>
                <button
                  onClick={forceClose}
                  disabled={resolving === confirmLesson._id}
                  className="px-4 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-700 text-white rounded-xl disabled:opacity-50"
                >
                  {resolving === confirmLesson._id ? "Закрываю..." : "Закрыть фидбек"}
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

export default StuckFeedbacks;
