import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../utils/api";
import {
  RULE_LEVELS, RULE_SIZES, RULE_SOURCE, levelSums, quotaSums, ruleErrors, setLevel, setRowCount, toRuleBody, toRuleForm,
} from "./ruleForm";

// «Правило набора» направления (только админ): квоты по темам (JS) или модулям (Python) для 15/18/20,
// уровни oson/o'rta/qiyin, минимум amaliy, мини-задание, для Python — extras (HTML/CSS из JS-банка).
// Сохранение → PUT /question-bank/rules/:track; сервер не даст сломать активные наборы (422).
const LEVEL_LABEL = { oson: "oson", orta: "o'rta", qiyin: "qiyin" };
const num = "w-14 px-1.5 py-1 rounded-md border border-slate-200 text-sm text-center focus:outline-none focus:border-blue-400";
const sumCls = (ok) => (ok ? "text-slate-700" : "text-red-600 font-semibold");

export default function RulePanel({ track, onSaved }) {
  const [resp, setResp] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [brokenSets, setBrokenSets] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); setBrokenSets([]); setSaved(false);
    api.questionBank.getRules(track)
      .then((r) => { if (!cancelled) { setResp(r); setForm(toRuleForm(r)); } })
      .catch((e) => { if (!cancelled) { setResp(null); setForm(null); setError(e.message || "Не удалось загрузить правило"); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [track]);

  const original = useMemo(() => (resp ? toRuleForm(resp) : null), [resp]);
  const body = useMemo(() => (form && original ? toRuleBody(form, original, resp) : {}), [form, original, resp]);
  const errors = useMemo(() => (form && original ? ruleErrors(form, original) : []), [form, original]);
  const dirty = Object.keys(body).length > 0;

  if (loading) return <p className="text-sm text-slate-400">Загрузка правила…</p>;
  if (!form) return error ? <p className="text-sm text-red-700">{error}</p> : null;

  const rules = resp.rules || {};
  const unitWord = rules.unit === "module" ? "Модуль" : "Тема";
  const qs = quotaSums(form.rows);
  const ls = levelSums(form.levels);
  const touch = (next) => { setForm(next); setSaved(false); };

  const save = async () => {
    setBusy(true); setError(""); setBrokenSets([]);
    try {
      const r = await api.questionBank.updateRules(track, body);
      setResp(r); setForm(toRuleForm(r)); setSaved(true);
      onSaved?.(r);
    } catch (e) {
      setError(e.message || "Не удалось сохранить");
      setBrokenSets(e.status === 422 ? e.details?.sets || [] : []);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="rule-panel">
      <p className="text-xs text-slate-500" data-testid="rule-source">
        Источник: {RULE_SOURCE[rules.source] || rules.source || "—"}
        {rules.updatedAt && rules.source === "admin" && ` · ${new Date(rules.updatedAt).toLocaleDateString("ru-RU")}`}
      </p>

      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
              <th className="py-1.5 pr-4 font-medium">{unitWord}</th>
              {RULE_SIZES.map((s) => <th key={s} className="py-1.5 px-1 font-medium text-center">{s}</th>)}
              <th className="py-1.5 pl-3 font-medium" title="активных в банке / +неактивных (архив, ещё не пройдено)">в банке</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {form.rows.map((r) => (
              <tr key={r.key}>
                <td className="py-1 pr-4 text-slate-800 whitespace-nowrap">{r.label}</td>
                {RULE_SIZES.map((s) => (
                  <td key={s} className="py-1 px-1 text-center">
                    <input type="number" min={0} max={20} className={num} value={r.counts[s]} aria-label={`${r.label} · ${s}`}
                      onChange={(e) => touch(setRowCount(form, r.key, s, e.target.value))} />
                  </td>
                ))}
                <td className="py-1 pl-3 text-xs text-slate-500 whitespace-nowrap">
                  {r.inBank.active}{r.inBank.inactive > 0 && <span className="text-slate-400"> +{r.inBank.inactive}</span>}
                </td>
              </tr>
            ))}
            <tr className="border-t border-slate-200">
              <td className="py-1.5 pr-4 text-xs font-medium text-slate-500">Сумма</td>
              {RULE_SIZES.map((s) => (
                <td key={s} className={`py-1.5 px-1 text-center text-sm ${sumCls(qs[s] === s || qs[s] === 0)}`} data-testid={`quota-sum-${s}`}>
                  {qs[s]}{qs[s] !== s && qs[s] !== 0 && <span className="text-xs"> ≠ {s}</span>}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-6">
        <div>
          <p className="text-xs font-medium text-slate-600 mb-1">Уровни (oson / o'rta / qiyin)</p>
          <table className="text-sm">
            <tbody>
              {RULE_SIZES.map((s) => (
                <tr key={s}>
                  <td className="pr-2 text-xs text-slate-500">{s}</td>
                  {RULE_LEVELS.map((l) => (
                    <td key={l} className="px-0.5 py-0.5">
                      <input type="number" min={0} max={20} className={num} value={form.levels[s][l]} aria-label={`${LEVEL_LABEL[l]} · ${s}`}
                        onChange={(e) => touch(setLevel(form, s, l, e.target.value))} />
                    </td>
                  ))}
                  <td className={`pl-2 text-xs ${sumCls(ls[s] === s)}`}>{ls[s] === s ? "✓" : `${ls[s]} ≠ ${s}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            Минимум amaliy
            <input type="number" min={0} max={20} className={num} value={form.minPractical}
              onChange={(e) => touch({ ...form, minPractical: e.target.value })} />
          </label>
          <label className="flex items-center gap-2">
            Для 20 вопросов
            <input type="number" min={0} max={20} className={num} value={form.minPractical20} placeholder="—"
              onChange={(e) => touch({ ...form, minPractical20: e.target.value })} />
            <span className="text-xs text-slate-400">пусто — как общий</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.requireMiniTask}
              onChange={(e) => touch({ ...form, requireMiniTask: e.target.checked })} /> нужно мини-задание
          </label>
        </div>

        {form.extras && (
          <div className="space-y-2 text-sm text-slate-700 max-w-xs" data-testid="rule-extras">
            <p className="text-xs font-medium text-slate-600">HTML/CSS из JS-банка сверх основного набора</p>
            <p className="text-xs text-slate-500 font-mono break-words">{form.extras.codes.join(", ") || "коды не заданы"}</p>
            <label className="flex items-center gap-2">
              не больше
              <input type="number" min={0} max={5} className={num} value={form.extras.max}
                onChange={(e) => touch({ ...form, extras: { ...form.extras, max: e.target.value } })} />
            </label>
            <label className="flex items-center gap-2">
              всего вопросов ≤
              <input type="number" min={15} max={25} className={num} value={form.extras.maxTotal}
                onChange={(e) => touch({ ...form, extras: { ...form.extras, maxTotal: e.target.value } })} />
            </label>
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div className="text-xs text-red-700 space-y-0.5" data-testid="rule-errors">
          {errors.map((e) => <p key={e}>✖ {e}</p>)}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm space-y-1" role="alert" data-testid="rule-save-error">
          <p>{error}</p>
          {brokenSets.length > 0 && (
            <ul className="list-disc pl-5 text-xs">
              {brokenSets.map((s) => <li key={s._id || s.number}>набор №{s.number}: {s.reason}</li>)}
            </ul>
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={!dirty || busy || errors.length > 0} data-testid="save-rule"
          className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {busy ? "Сохраняю…" : "Сохранить"}
        </button>
        {dirty && <button type="button" onClick={() => { setForm(original); setError(""); setBrokenSets([]); }}
          className="text-xs text-slate-500 hover:text-slate-800">сбросить</button>}
        <span className="text-xs text-slate-400">
          {saved ? "✓ сохранено" : dirty ? `изменено: ${Object.keys(body).join(", ")}` : "без изменений"}
        </span>
      </div>
    </div>
  );
}
