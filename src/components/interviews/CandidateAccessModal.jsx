import React, { useState } from "react";
import { toast } from "react-toastify";
import { X, Copy, Check, Clock, ArrowRight, ExternalLink } from "lucide-react";
import { credentialsText, windowText } from "../../pages/live/liveFormat";

// a2: логин и пароль кандидата. Пароль приходит один раз — после закрытия
// остаётся только «Сбросить пароль» на живом экране.
export default function CandidateAccessModal({ credentials, candidate, subtitle, onOpenLive }) {
  const [copied, setCopied] = useState("");
  const site = String(credentials.appUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

  const copy = async (lang) => {
    try {
      await navigator.clipboard.writeText(credentialsText(credentials, lang));
      setCopied(lang);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };
  const btn = "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-green-200 bg-white text-green-700 hover:bg-green-50";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Доступ кандидата</h2>
            <p className="text-xs text-slate-400">{candidate}{subtitle ? ` · ${subtitle}` : ""}</p>
          </div>
          <button onClick={onOpenLive} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Закрыть"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-2">
            <p className="text-sm text-slate-600">Сайт:{" "}
              {site ? (
                <a href={credentials.appUrl} target="_blank" rel="noreferrer" className="font-mono text-slate-900 hover:underline inline-flex items-center gap-1">
                  {site} <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              ) : (
                <span className="text-xs text-amber-700">адрес сайта не задан на сервере (CANDIDATE_APP_URL)</span>
              )}
            </p>
            <p className="text-sm text-slate-600">Логин: <span className="font-mono text-base text-slate-900">{credentials.username}</span></p>
            <p className="text-sm text-slate-600">Пароль: <span className="font-mono text-base text-slate-900">{credentials.password}</span></p>
            <div className="flex flex-wrap gap-2 pt-1">
              {["uz", "ru"].map((l) => (
                <button key={l} onClick={() => copy(l)} className={btn}>
                  {copied === l ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied === l ? "Скопировано" : `Скопировать (${l})`}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">Пароль показывается один раз. Потеряли — «Сбросить пароль» на живом экране.</p>
          </div>

          <div className="text-xs text-slate-500 space-y-1.5">
            <p className="flex items-start gap-2"><Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Действует {windowText(credentials)} (Ташкент), отключится по «Завершить».</p>
            <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-1 mr-0.5" /> Кандидат ещё не вошёл</p>
          </div>

          <pre className="text-xs font-mono bg-slate-50 border border-slate-100 rounded-lg p-3 text-slate-600 whitespace-pre-wrap">{credentialsText(credentials, "uz")}</pre>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
          <button onClick={onOpenLive} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
            Открыть живой экран <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
