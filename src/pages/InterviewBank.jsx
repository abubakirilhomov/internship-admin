import React, { useEffect, useState, useCallback } from "react";
import { api } from "../utils/api";
import { toast, ToastContainer } from "react-toastify";
import { Plus, Edit, Trash2, Power, PowerOff, X, ListChecks } from "lucide-react";

const TRACKS = [
  { value: "frontend-react", label: "Frontend (React)" },
  { value: "backend-nodejs", label: "Backend (Node.js)" },
];
const CATEGORIES = [
  { value: "html-css", label: "HTML / CSS" },
  { value: "javascript", label: "JavaScript" },
  { value: "react", label: "React" },
  { value: "practical", label: "Практика / ТЗ" },
];
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

const fieldCls =
  "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400 bg-white";
const labelCls = "text-xs font-medium text-slate-600 mb-1 block";

function TopicModal({ initial, track, onClose, onSaved }) {
  const editing = !!initial?._id;
  const [form, setForm] = useState({
    label: initial?.label || "",
    labelRu: initial?.labelRu || "",
    category: initial?.category || "javascript",
    track: initial?.track || track,
    weight: initial?.weight ?? 1,
    order: initial?.order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.label.trim()) return toast.error("Укажите тему");
    setSaving(true);
    try {
      const payload = { ...form, weight: Number(form.weight) || 1, order: Number(form.order) || 0 };
      if (editing) await api.interviewTopics.update(initial._id, payload);
      else await api.interviewTopics.create(payload);
      toast.success(editing ? "Сохранено" : "Тема добавлена");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{editing ? "Редактировать тему" : "Новая тема"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div><label className={labelCls}>Тема (осн.) *</label>
            <input value={form.label} onChange={(e) => set("label", e.target.value)} className={fieldCls} /></div>
          <div><label className={labelCls}>Перевод (RU)</label>
            <input value={form.labelRu} onChange={(e) => set("labelRu", e.target.value)} className={fieldCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Категория</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className={fieldCls}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select></div>
            <div><label className={labelCls}>Направление</label>
              <select value={form.track} onChange={(e) => set("track", e.target.value)} className={fieldCls}>
                {TRACKS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
            <div><label className={labelCls}>Вес (макс. балл)</label>
              <input type="number" step="0.5" value={form.weight} onChange={(e) => set("weight", e.target.value)} className={fieldCls} /></div>
            <div><label className={labelCls}>Порядок</label>
              <input type="number" value={form.order} onChange={(e) => set("order", e.target.value)} className={fieldCls} /></div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Отмена</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60">
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InterviewBank() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState("frontend-react");
  const [modal, setModal] = useState(null); // {topic} | "new" | null

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.interviewTopics.getAll({ all: "true", track });
      setTopics(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message || "Не удалось загрузить");
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, [track]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (t) => {
    try {
      await api.interviewTopics.update(t._id, { isActive: !t.isActive });
      load();
    } catch (e) { toast.error(e.message || "Ошибка"); }
  };
  const remove = async (t) => {
    if (!window.confirm(`Деактивировать тему «${t.label}»?`)) return;
    try { await api.interviewTopics.remove(t._id); toast.success("Деактивирована"); load(); }
    catch (e) { toast.error(e.message || "Ошибка"); }
  };

  const activeCount = topics.filter((t) => t.isActive).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-blue-500" /> Банк вопросов
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Темы для собеседований. Активных: {activeCount} из {topics.length}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={track} onChange={(e) => setTrack(e.target.value)} className={fieldCls + " w-auto"}>
            {TRACKS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button onClick={() => setModal("new")} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Тема
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm">Загрузка…</p>
        </div>
      ) : topics.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">Банк пуст. Засей: <code className="text-slate-500">node scripts/seed-interview-bank.js --apply</code> или добавь вручную.</p>
        </div>
      ) : (
        CATEGORIES.map((cat) => {
          const items = topics.filter((t) => t.category === cat.value);
          if (!items.length) return null;
          return (
            <div key={cat.value} className="mb-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">{cat.label} <span className="text-slate-400 font-normal">({items.length})</span></h2>
              <div className="bg-white rounded-2xl shadow divide-y divide-slate-50">
                {items.map((t) => (
                  <div key={t._id} className={`flex items-center gap-3 px-4 py-2.5 ${!t.isActive ? "opacity-40" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 truncate">{t.label}</p>
                      {t.labelRu && <p className="text-xs text-slate-400 truncate">{t.labelRu}</p>}
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">×{t.weight}</span>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => toggleActive(t)} className="p-1.5 rounded-lg hover:bg-slate-100" title={t.isActive ? "Деактивировать" : "Активировать"}>
                        {t.isActive ? <Power className="w-4 h-4 text-green-500" /> : <PowerOff className="w-4 h-4 text-slate-400" />}
                      </button>
                      <button onClick={() => setModal({ topic: t })} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-blue-600"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => remove(t)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {modal && (
        <TopicModal
          initial={modal === "new" ? null : modal.topic}
          track={track}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
      <ToastContainer position="top-right" />
    </div>
  );
}
