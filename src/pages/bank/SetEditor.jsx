import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../utils/api";
import { TOPICS } from "./bankForm";

// Редактор набора вопросов (только админ): состав проверяется по правилу уровней на сервере
// (одинаковая сложность собеседований) — неверный набор не сохраняется.
const LEVEL_CLS = { oson: "bg-green-100 text-green-700", orta: "bg-yellow-100 text-yellow-700", qiyin: "bg-red-100 text-red-700" };
const LEVEL_SHORT = { oson: "oson", orta: "o'rta", qiyin: "qiyin" };
const TOPIC_LABEL = Object.fromEntries(TOPICS.map((t) => [t.value, t.label]));
const fmtLevels = (c) => (c ? `${c.oson}/${c.orta}/${c.qiyin}` : "—");

export default function SetEditor({ set, track, onClose, onSaved }) {
  const isNew = !set;
  const [bank, setBank] = useState(null);
  const [codes, setCodes] = useState(set ? [...set.questionCodes] : []);
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    api.questionBank.questions({ track })
      .then((r) => setBank(r.questions || []))
      .catch((e) => setError(e.message));
  }, [track]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  // Проверка состава на сервере (то же правило, что при сохранении), с небольшой паузой.
  useEffect(() => {
    if (!codes.length) { setCheck(null); return undefined; }
    const my = (seq.current += 1);
    const id = setTimeout(() => {
      api.questionBank.checkSet({ track, questionCodes: codes, setId: set?._id })
        .then((r) => { if (my === seq.current) setCheck(r); })
        .catch((e) => { if (my === seq.current) setError(e.message); });
    }, 250);
    return () => clearTimeout(id);
  }, [codes, track, set]);

  const byCode = useMemo(() => new Map((bank || []).map((q) => [q.code, q])), [bank]);
  const groups = useMemo(() => {
    const m = new Map();
    (bank || []).forEach((q) => m.set(q.topic, [...(m.get(q.topic) || []), q]));
    return [...m.entries()];
  }, [bank]);
  const toggle = (code) => setCodes((c) => (c.includes(code) ? c.filter((x) => x !== code) : [...c, code]));
  const got = useMemo(() => {
    const g = { oson: 0, orta: 0, qiyin: 0 };
    codes.forEach((c) => { const l = byCode.get(c)?.level; if (l in g) g[l] += 1; });
    return g;
  }, [codes, byCode]);

  const save = async () => {
    setBusy(true); setError("");
    try {
      const r = isNew
        ? await api.questionBank.createSet({ track, questionCodes: codes })
        : await api.questionBank.updateSet(set._id, { questionCodes: codes });
      onSaved(r.set);
    } catch (e) {
      setError(e.message);
      if (e.details?.check) setCheck(e.details.check);
    } finally {
      setBusy(false);
    }
  };

  const unchanged = !isNew && JSON.stringify(codes) === JSON.stringify(set.questionCodes);
  const can = check?.ok && !unchanged && !busy;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-full overflow-auto" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={isNew ? "Новый набор" : `Набор №${set.number}`} data-testid="set-editor">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3 flex items-center gap-2 z-10">
          <h2 className="text-base font-semibold text-slate-900">{isNew ? "Новый набор" : `Набор №${set.number}`} · {track}</h2>
          <button type="button" onClick={onClose} className="ml-auto px-3 py-1 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Закрыть ✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="sticky top-[53px] z-10 rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-1 text-sm shadow-sm" data-testid="set-check">
            <p className="text-slate-700">
              Выбрано <b>{codes.length}</b>: oson {got.oson} · o'rta {got.orta} · qiyin {got.qiyin}
              {check?.levels?.want && <span className="text-slate-500"> — по правилу {fmtLevels(check.levels.want)}</span>}
            </p>
            {check?.ok && <p className="text-green-700">✓ состав соответствует правилу, набор можно сохранить</p>}
            {check && !check.ok && check.block.map((b, i) => <p key={i} className="text-red-700">✖ {b}</p>)}
            {check?.warn?.map((w, i) => <p key={i} className="text-amber-700">⚠ {w}</p>)}
            {!codes.length && <p className="text-slate-400">Отметьте вопросы ниже.</p>}
          </div>

          {codes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {codes.map((c, i) => {
                const q = byCode.get(c);
                return (
                  <button key={c} type="button" onClick={() => toggle(c)} title="Убрать из набора"
                    className={`px-2 py-1 rounded-lg text-xs font-mono ${LEVEL_CLS[q?.level] || "bg-slate-100 text-slate-600"}`}>
                    {i + 1}. {c} ✕
                  </button>
                );
              })}
            </div>
          )}

          {!bank ? <p className="text-sm text-slate-400">Загрузка вопросов…</p> : (
            <div className="space-y-3">
              {groups.map(([topic, list]) => (
                <div key={topic}>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{TOPIC_LABEL[topic] || topic}</p>
                  <div className="grid sm:grid-cols-2 gap-1">
                    {list.map((q) => {
                      const on = codes.includes(q.code);
                      return (
                        <label key={q.code} className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 text-sm cursor-pointer ${on ? "border-blue-300 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                          <input type="checkbox" className="mt-1" checked={on} onChange={() => toggle(q.code)} data-testid={`pick-${q.code}`} />
                          <span className="min-w-0">
                            <span className="font-mono text-xs text-slate-900">{q.code}</span>{" "}
                            <span className={`px-1.5 rounded text-[10px] ${LEVEL_CLS[q.level]}`}>{LEVEL_SHORT[q.level]}</span>
                            {q.isPractical && <span className="ml-1 text-[10px] text-slate-500">amaliy</span>}
                            <span className="block text-xs text-slate-500 truncate">{q.promptShort || q.prompt.replace(/\s+/g, " ").slice(0, 70)}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm" role="alert">{error}</div>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex items-center gap-2">
          <span className={`ml-auto text-xs truncate ${check && !check.ok ? "text-red-600" : "text-slate-400"}`} data-testid="set-footer-status">
            {unchanged ? "без изменений" : check && !check.ok ? `✕ ${check.block[0]}` : check?.ok ? "✓ состав по правилу" : ""}
          </span>
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Отмена</button>
          <button type="button" onClick={save} disabled={!can} data-testid="save-set"
            className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Сохраняю…" : isNew ? "Создать набор" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
