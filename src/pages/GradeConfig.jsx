import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { api } from "../utils/api";
import { X, Plus, Save } from "lucide-react";

const GRADE_META = {
  junior:       { label: "Junior",        color: "bg-green-100 text-green-700 border-green-200" },
  strongJunior: { label: "Strong Junior", color: "bg-blue-100 text-blue-700 border-blue-200" },
  middle:       { label: "Middle",        color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  strongMiddle: { label: "Strong Middle", color: "bg-orange-100 text-orange-700 border-orange-200" },
  senior:       { label: "Senior",        color: "bg-red-100 text-red-700 border-red-200" },
};

const GRADE_ORDER = ["junior", "strongJunior", "middle", "strongMiddle", "senior"];

const GradeCard = ({ config, onSaved }) => {
  const [form, setForm] = useState({
    lessonsPerMonth: config.lessonsPerMonth,
    trialPeriod: config.trialPeriod,
    perks: config.perks || [],
  });
  const [newPerk, setNewPerk] = useState("");
  const [saving, setSaving] = useState(false);

  const meta = GRADE_META[config.grade] || { label: config.grade, color: "bg-gray-100 text-gray-700 border-gray-200" };

  const addPerk = () => {
    const trimmed = newPerk.trim();
    if (!trimmed) return;
    setForm((p) => ({ ...p, perks: [...p.perks, trimmed] }));
    setNewPerk("");
  };

  const removePerk = (idx) => {
    setForm((p) => ({ ...p, perks: p.perks.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.lessonsPerMonth || !form.trialPeriod) {
      toast.error("Заполните все обязательные поля");
      return;
    }
    setSaving(true);
    try {
      await api.gradeConfig.update(config.grade, {
        lessonsPerMonth: Number(form.lessonsPerMonth),
        trialPeriod: Number(form.trialPeriod),
        perks: form.perks,
      });
      toast.success(`${meta.label} — сохранено`);
      onSaved();
    } catch (err) {
      toast.error(err.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 rounded-lg text-sm font-semibold border ${meta.color}`}>
          {meta.label}
        </span>
      </div>

      {/* Lessons per month */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Уроков в месяц
        </label>
        <input
          type="number"
          min={1}
          value={form.lessonsPerMonth}
          onChange={(e) => setForm((p) => ({ ...p, lessonsPerMonth: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
        />
      </div>

      {/* Trial period */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Испытательный срок (мес.)
        </label>
        <input
          type="number"
          min={1}
          value={form.trialPeriod}
          onChange={(e) => setForm((p) => ({ ...p, trialPeriod: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
        />
      </div>

      {/* Perks */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Привилегии
        </label>
        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
          {form.perks.map((perk, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs"
            >
              {perk}
              <button
                type="button"
                onClick={() => removePerk(idx)}
                className="text-slate-400 hover:text-slate-600 ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {form.perks.length === 0 && (
            <span className="text-xs text-slate-300 italic">Нет привилегий</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPerk}
            onChange={(e) => setNewPerk(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPerk(); } }}
            placeholder="Добавить привилегию..."
            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-400 bg-white"
          />
          <button
            type="button"
            onClick={addPerk}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить
          </button>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60"
      >
        {saving ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saving ? "Сохранение..." : "Сохранить"}
      </button>
    </div>
  );
};

const GradeConfig = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const result = await api.gradeConfig.getAll();
      const data = Array.isArray(result) ? result : result?.data || [];
      // Sort by GRADE_ORDER
      const sorted = GRADE_ORDER
        .map((grade) => data.find((c) => c.grade === grade))
        .filter(Boolean);
      setConfigs(sorted);
    } catch (err) {
      toast.error("Ошибка загрузки конфигурации");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3 text-slate-400">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-sm">Загрузка конфигурации...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Конфигурация Грейдов</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Настройте требования и привилегии для каждого грейда. Изменения автоматически применяются ко всем стажёрам данного грейда.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {configs.map((config) => (
          <GradeCard key={config.grade} config={config} onSaved={fetchConfigs} />
        ))}
        {configs.length === 0 && (
          <p className="col-span-full text-center text-slate-400 py-10 text-sm">
            Нет данных конфигурации
          </p>
        )}
      </div>
    </div>
  );
};

export default GradeConfig;
