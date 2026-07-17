import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import { X, ArrowRightCircle, ArrowLeftCircle, AlertTriangle } from "lucide-react";

// История бейджика одного интерна (given / returned / lost, когда, кем).
// Именно этого следа не хватало в кейсе "отдал бейджик другу на 5 месяцев".

const ACTION_META = {
  given: { label: "Выдан", cls: "text-amber-700", Icon: ArrowRightCircle },
  returned: { label: "Принят", cls: "text-green-700", Icon: ArrowLeftCircle },
  lost: { label: "Потерян", cls: "text-red-700", Icon: AlertTriangle },
};

const fmt = (d) =>
  d ? new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const BadgeHistoryModal = ({ internId, internName, onClose }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await api.badges.history(internId);
        if (!cancelled) setEvents(Array.isArray(d) ? d : []);
      } catch (e) {
        if (!cancelled) setError(e.message || "Не удалось загрузить историю");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [internId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">История бейджика</h3>
            <p className="text-sm text-gray-500">{internName}</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-red-600 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</div>
          ) : events.length === 0 ? (
            <div className="text-center text-gray-400 py-10 text-sm">Событий пока нет</div>
          ) : (
            <ul className="space-y-3">
              {events.map((e) => {
                const meta = ACTION_META[e.action] || { label: e.action, cls: "text-gray-600", Icon: ArrowRightCircle };
                const Icon = meta.Icon;
                return (
                  <li key={e._id} className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${meta.cls}`} />
                    <div className="flex-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${meta.cls}`}>{meta.label}</span>
                        <span className="text-gray-400 text-xs">{fmt(e.at)}</span>
                      </div>
                      <div className="text-gray-500 text-xs">
                        {e.branch?.name || ""}{e.byName ? ` · ${e.byName}` : ""}
                      </div>
                      {e.note && <div className="text-gray-600 text-xs mt-0.5">{e.note}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default BadgeHistoryModal;
