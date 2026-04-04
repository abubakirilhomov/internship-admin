import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { api } from "../utils/api";
import { Save } from "lucide-react";

const Settings = () => {
  const [lookbackDays, setLookbackDays] = useState(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await api.settings.getAll();
        if (data.lessonLookbackDays) setLookbackDays(data.lessonLookbackDays);
      } catch {
        toast.error("Ошибка загрузки настроек");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.settings.update({ lessonLookbackDays: Number(lookbackDays) });
      toast.success("Настройки сохранены");
    } catch (err) {
      toast.error(err.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3 text-slate-400">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-sm">Загрузка настроек...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Настройки</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Общие настройки системы
        </p>
      </div>

      <div className="max-w-md">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Макс. дней назад для отправки урока
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={lookbackDays}
              onChange={(e) => setLookbackDays(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400 bg-white"
            />
            <p className="text-xs text-slate-400 mt-1">
              Интерны смогут добавлять уроки за последние {lookbackDays} дн. По умолчанию: 2
            </p>
          </div>

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
      </div>
    </div>
  );
};

export default Settings;
