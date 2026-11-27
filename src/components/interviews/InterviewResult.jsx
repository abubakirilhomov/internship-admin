import React, { useState } from "react";
import { toast } from "react-toastify";
import { Copy, Check, X } from "lucide-react";
import { api } from "../../utils/api";

// Экран «Результат»: процент, «Создать аккаунт интерна», письмо uz/ru.
// Общий для «Оценить по чек-листу» (ScoringModal) и «Завершить» живого собеседования.
// result — Interview (percentage, scoreEarned, scoreTotal, passed, application), letter — {ru, uz}.
export function InterviewResultBody({ result, letter, onSaved, onClose }) {
  const [lang, setLang] = useState("ru");
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [account, setAccount] = useState(null);
  const [accCopied, setAccCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter?.[lang] || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  // Создать аккаунт интерна из прошедшей заявки (reuse convert).
  const createAccount = async () => {
    const appId = result?.application?._id;
    if (!appId) return toast.error("Нет заявки кандидата");
    setCreating(true);
    try {
      const r = await api.applications.convert(appId);
      setAccount({ username: r.intern?.username || "", tempPassword: r.tempPassword || "" });
      toast.success("Аккаунт создан");
      onSaved?.();
    } catch (e) {
      toast.error(e.message || "Не удалось создать аккаунт");
    } finally {
      setCreating(false);
    }
  };
  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(`Логин: ${account.username}\nПароль: ${account.tempPassword}`);
      setAccCopied(true);
      setTimeout(() => setAccCopied(false), 1500);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <div className="overflow-y-auto flex-1 p-5 space-y-4">
      <div className={`rounded-xl p-4 text-center ${result?.passed ? "bg-green-50" : "bg-red-50"}`}>
        <p className={`text-3xl font-bold ${result?.passed ? "text-green-600" : "text-red-500"}`}>{result?.percentage}%</p>
        <p className="text-sm text-slate-600 mt-1">{result?.scoreEarned}/{result?.scoreTotal} · {result?.passed ? "Прошёл ✅" : "Не прошёл ❌"}</p>
      </div>

      {result?.passed && (
        account ? (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-1.5">
            <p className="text-sm font-semibold text-green-800">Аккаунт интерна создан ✅</p>
            <p className="text-sm"><span className="text-slate-500">Логин:</span> <code className="font-mono">{account.username}</code></p>
            <p className="text-sm"><span className="text-slate-500">Пароль:</span> <code className="font-mono">{account.tempPassword}</code></p>
            <button onClick={copyAccount} className="mt-1 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-white border border-green-200 text-green-700 hover:bg-green-50">
              {accCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {accCopied ? "Скопировано" : "Скопировать"}
            </button>
            <p className="text-xs text-slate-400">Пароль показывается один раз — передай кандидату.</p>
          </div>
        ) : (
          <button onClick={createAccount} disabled={creating} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-60">
            {creating ? "Создание…" : "Создать аккаунт интерна"}
          </button>
        )
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase">Письмо кандидату</p>
          <div className="flex items-center gap-1">
            {["ru", "uz"].map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`px-2 py-0.5 rounded text-xs font-medium ${lang === l ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>{l.toUpperCase()}</button>
            ))}
            <button onClick={copy} className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
        </div>
        <textarea readOnly value={letter?.[lang] || ""} rows={10} className="w-full text-sm p-3 rounded-lg border border-slate-200 bg-slate-50 resize-none" />
      </div>
      <div className="flex justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Готово</button>
      </div>
    </div>
  );
}

// Самостоятельная модалка «Результат» (после «Завершить» на живом экране).
export default function InterviewResultModal({ name, trackLabel, result, letter, onSaved, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-xl">
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Результат</h2>
            <p className="text-xs text-slate-400">{name}{trackLabel ? ` · ${trackLabel}` : ""}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <InterviewResultBody result={result} letter={letter} onSaved={onSaved} onClose={onClose} />
      </div>
    </div>
  );
}
