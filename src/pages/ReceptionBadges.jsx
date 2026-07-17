import React, { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import {
  BadgeCheck, AlertTriangle, DoorClosed, RefreshCw, PackageCheck,
} from "lucide-react";
import BadgeHistoryModal from "../components/BadgeHistoryModal";

// Живая доска ресепшена: кому выдан жёлтый бейджик, кто не сдал, сверка ящика.
// Администратор ресепшена видит свой филиал автоматически; админ выбирает филиал.

const StatCard = ({ label, value, tone = "slate" }) => {
  const tones = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  );
};

const ReceptionBadges = () => {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin === true || user?.role === "admin";

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(""); // только для админа
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null); // {type, text}
  const [busyId, setBusyId] = useState(null);
  const [confirmLostId, setConfirmLostId] = useState(null);
  const [historyFor, setHistoryFor] = useState(null); // {id, name}

  // Закрытие дня
  const [closeOpen, setCloseOpen] = useState(false);
  const [counted, setCounted] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState(null);

  useEffect(() => {
    if (isAdmin) {
      api.branches.getAll().then((d) => setBranches(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [isAdmin]);

  const load = useCallback(async () => {
    // Админ должен выбрать филиал; администратор — берёт свой (branch=undefined).
    if (isAdmin && !branchId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await api.badges.board(isAdmin ? branchId : undefined);
      setData(d);
    } catch (e) {
      setError(e.message || "Не удалось загрузить доску");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, branchId]);

  useEffect(() => { load(); }, [load]);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const doToggle = async (internId, action) => {
    setBusyId(internId);
    setConfirmLostId(null);
    try {
      await api.badges.toggle(internId, {
        action,
        branch: isAdmin ? branchId : undefined,
      });
      await load();
      const label = action === "give" ? "выдан" : action === "return" ? "принят" : "списан";
      flash("success", `Бейджик ${label}.`);
    } catch (e) {
      flash("error", e.message || "Ошибка");
    } finally {
      setBusyId(null);
    }
  };

  const doClose = async () => {
    const n = Number(counted);
    if (!Number.isInteger(n) || n < 0) {
      flash("error", "Введите неотрицательное целое число бейджиков в ящике.");
      return;
    }
    setClosing(true);
    try {
      const res = await api.badges.close({
        branch: isAdmin ? branchId : undefined,
        countedInDrawer: n,
      });
      setCloseResult(res.reconciliation);
      await load();
    } catch (e) {
      flash("error", e.message || "Ошибка при закрытии дня");
    } finally {
      setClosing(false);
    }
  };

  const c = data?.counts;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
          <BadgeCheck className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Жёлтые бейджики</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.branch?.name ? `Ресепшен · ${data.branch.name}` : "Учёт выдачи и возврата"}
          </p>
        </div>
        <button onClick={load} className="btn btn-ghost btn-sm gap-2" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Обновить
        </button>
      </div>

      {/* Admin: выбор филиала */}
      {isAdmin && (
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 mr-2">Филиал:</label>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[200px]"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">— выберите филиал —</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${
          msg.type === "success"
            ? "bg-green-100 text-green-800 border border-green-200"
            : "bg-red-100 text-red-700 border border-red-300"
        }`}>
          {msg.type !== "success" && <AlertTriangle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {isAdmin && !branchId ? (
        <div className="text-center py-16 text-gray-400">Выберите филиал, чтобы открыть доску.</div>
      ) : loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <StatCard label="Всего (запас)" value={c.stock} />
            <StatCard label="На руках" value={c.out} tone="amber" />
            <StatCard label="В ящике" value={c.inDrawer} tone="green" />
            <StatCard label="Активных" value={c.activeInterns} />
            <StatCard label="Утечки" value={c.leaks} tone={c.leaks ? "red" : "slate"} />
          </div>

          {/* Close day */}
          <div className="mb-6">
            {!closeOpen ? (
              <button onClick={() => { setCloseOpen(true); setCloseResult(null); }} className="btn btn-outline btn-sm gap-2">
                <DoorClosed className="w-4 h-4" /> Закрыть день (сверка ящика)
              </button>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                {!closeResult ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Сколько бейджиков в ящике сейчас?
                      </label>
                      <input
                        type="number" min="0"
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm w-40"
                        value={counted}
                        onChange={(e) => setCounted(e.target.value)}
                        placeholder={`ожидается ${c.inDrawer}`}
                      />
                    </div>
                    <button onClick={doClose} disabled={closing} className="btn btn-primary btn-sm gap-2">
                      <PackageCheck className="w-4 h-4" /> {closing ? "..." : "Сверить"}
                    </button>
                    <button onClick={() => setCloseOpen(false)} className="btn btn-ghost btn-sm">Отмена</button>
                  </div>
                ) : (
                  <div className="text-sm">
                    <div className="font-semibold text-gray-800 mb-1">Итог сверки:</div>
                    <div>Ожидалось в ящике: {closeResult.expectedInDrawer}, насчитано: {closeResult.countedInDrawer}.</div>
                    <div className={closeResult.discrepancy === 0 ? "text-green-700 font-medium mt-1" : "text-red-700 font-medium mt-1"}>
                      {closeResult.discrepancy === 0
                        ? "✅ Всё сходится."
                        : `⚠️ Расхождение: ${closeResult.discrepancy} (${closeResult.discrepancy < 0 ? "не хватает" : "лишние"}).`}
                    </div>
                    {closeResult.openAtClose > 0 && (
                      <div className="text-amber-700 mt-1">На руках не сдано: {closeResult.openAtClose} — см. список ниже.</div>
                    )}
                    <button onClick={() => { setCloseOpen(false); setCounted(""); }} className="btn btn-ghost btn-sm mt-2">Закрыть</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Leaks */}
          {data.leaks?.length > 0 && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
                <AlertTriangle className="w-4 h-4" /> Держат бейджик, но НЕ активны ({data.leaks.length})
              </div>
              <ul className="text-sm text-red-700 space-y-1">
                {data.leaks.map((i) => (
                  <li key={i._id} className="flex items-center justify-between">
                    <span>{i.name} {i.lastName} <span className="opacity-70">({i.status})</span></span>
                    <button
                      onClick={() => doToggle(i._id, "return")}
                      disabled={busyId === i._id}
                      className="btn btn-xs btn-outline"
                    >Принять</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Interns list */}
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-600">Интерн</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Логин</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Статус</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.interns.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-12 text-gray-400">Активных интернов нет</td></tr>
                ) : data.interns.map((i) => (
                  <tr key={i._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <button
                        onClick={() => setHistoryFor({ id: i._id, name: `${i.name} ${i.lastName}` })}
                        className="hover:underline text-left"
                      >{i.name} {i.lastName}</button>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{i.username}</td>
                    <td className="px-4 py-3">
                      {i.hasBadge ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                          <BadgeCheck className="w-3 h-3" /> на руках
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">в ящике</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {i.hasBadge ? (
                          <>
                            <button
                              onClick={() => doToggle(i._id, "return")}
                              disabled={busyId === i._id}
                              className="btn btn-xs btn-success"
                            >Принять</button>
                            {confirmLostId === i._id ? (
                              <span className="flex items-center gap-1">
                                <span className="text-xs text-red-600">потерян?</span>
                                <button onClick={() => doToggle(i._id, "lost")} disabled={busyId === i._id} className="btn btn-xs btn-error">Да</button>
                                <button onClick={() => setConfirmLostId(null)} className="btn btn-xs btn-ghost">Нет</button>
                              </span>
                            ) : (
                              <button onClick={() => setConfirmLostId(i._id)} disabled={busyId === i._id} className="btn btn-xs btn-outline btn-error">Потерян</button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => doToggle(i._id, "give")}
                            disabled={busyId === i._id}
                            className="btn btn-xs btn-primary"
                          >Выдать</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {historyFor && (
        <BadgeHistoryModal
          internId={historyFor.id}
          internName={historyFor.name}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
};

export default ReceptionBadges;
