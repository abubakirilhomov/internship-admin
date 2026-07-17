import React, { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api";
import { BadgeCheck, AlertTriangle, RefreshCw, Save } from "lucide-react";
import BadgeHistoryModal from "../components/BadgeHistoryModal";

// Сводный отчёт по жёлтым бейджикам (для админа): расчёт по филиалам,
// утечки (держат бейджик, но не активны) и история посуточных сверок.

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

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const BadgeReport = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [stockEdits, setStockEdits] = useState({}); // branchId -> value
  const [savingId, setSavingId] = useState(null);
  const [historyFor, setHistoryFor] = useState(null); // {id, name}

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.badges.report();
      setData(d);
      setStockEdits({});
    } catch (e) {
      setError(e.message || "Не удалось загрузить отчёт");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const saveStock = async (branchId) => {
    const raw = stockEdits[branchId];
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      flash("error", "Запас должен быть неотрицательным целым числом.");
      return;
    }
    setSavingId(branchId);
    try {
      await api.badges.setStock({ branch: branchId, badgeStock: n });
      await load();
      flash("success", "Запас сохранён.");
    } catch (e) {
      flash("error", e.message || "Ошибка");
    } finally {
      setSavingId(null);
    }
  };

  const t = data?.totals;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
          <BadgeCheck className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Бейджики — отчёт</h1>
          <p className="text-sm text-gray-500 mt-0.5">Расчёт по филиалам, утечки, сверки</p>
        </div>
        <button onClick={load} className="btn btn-ghost btn-sm gap-2" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Обновить
        </button>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${
          msg.type === "success"
            ? "bg-green-100 text-green-800 border border-green-200"
            : "bg-red-100 text-red-700 border border-red-300"
        }`}>{msg.text}</div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatCard label="Всего бейджиков" value={t.stock} />
            <StatCard label="На руках" value={t.out} tone="amber" />
            <StatCard label="В ящиках" value={t.inDrawer} tone="green" />
            <StatCard label="Утечки" value={t.leaks} tone={t.leaks ? "red" : "slate"} />
          </div>

          {/* Per-branch */}
          <h2 className="text-lg font-semibold text-gray-800 mb-2">По филиалам</h2>
          <div className="overflow-x-auto bg-white rounded-lg shadow mb-8">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-600">Филиал</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Запас</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">На руках</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">В ящике</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Утечки</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.perBranch.map((p) => {
                  const bid = p.branch._id;
                  const edited = stockEdits[bid] !== undefined;
                  return (
                    <tr key={bid} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.branch.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min="0"
                            className="border border-gray-300 rounded-md px-2 py-1 text-sm w-20"
                            value={edited ? stockEdits[bid] : p.stock}
                            onChange={(e) => setStockEdits((s) => ({ ...s, [bid]: e.target.value }))}
                          />
                          {edited && Number(stockEdits[bid]) !== p.stock && (
                            <button
                              onClick={() => saveStock(bid)}
                              disabled={savingId === bid}
                              className="btn btn-xs btn-primary gap-1"
                            >
                              <Save className="w-3 h-3" /> {savingId === bid ? "..." : "OK"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-amber-700">{p.out}</td>
                      <td className={`px-4 py-3 ${p.inDrawer < 0 ? "text-red-600 font-semibold" : "text-green-700"}`}>{p.inDrawer}</td>
                      <td className="px-4 py-3">
                        {p.leaks > 0
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{p.leaks}</span>
                          : <span className="text-gray-300">0</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Leaks */}
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Утечки — держат бейджик, но не активны ({data.leaks.length})
          </h2>
          {data.leaks.length === 0 ? (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-8 text-sm">
              ✅ Утечек нет.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-lg shadow mb-8">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-600">Интерн</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Логин</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Статус</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Филиал</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">На руках с</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.leaks.map((i) => (
                    <tr key={i._id} className="hover:bg-red-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <button
                          onClick={() => setHistoryFor({ id: i._id, name: `${i.name} ${i.lastName}` })}
                          className="hover:underline text-left"
                        >{i.name} {i.lastName}</button>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{i.username}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">{i.status}</span></td>
                      <td className="px-4 py-3 text-gray-600">{i.branch?.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{fmtDate(i.since)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Reconciliations */}
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Последние сверки</h2>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-600">Дата</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Филиал</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Запас</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Не сдано</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Ожидалось</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Насчитано</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Расхождение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentReconciliations.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-10 text-gray-400">Сверок пока нет</td></tr>
                ) : data.recentReconciliations.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3 text-gray-700">{r.branch?.name || "—"}</td>
                    <td className="px-4 py-3">{r.stock}</td>
                    <td className="px-4 py-3">{r.openAtClose}</td>
                    <td className="px-4 py-3">{r.expectedInDrawer}</td>
                    <td className="px-4 py-3">{r.countedInDrawer}</td>
                    <td className={`px-4 py-3 font-semibold ${r.discrepancy === 0 ? "text-green-700" : "text-red-600"}`}>
                      {r.discrepancy > 0 ? `+${r.discrepancy}` : r.discrepancy}
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

export default BadgeReport;
