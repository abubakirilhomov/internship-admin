import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Trash2, Edit, ArrowUpCircle, History, Gift, Crown,
  Unlock, Lock, MoreVertical, AlertTriangle, X, Search,
} from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../utils/api";
import PromotionHistoryModal from "./PromotionHistoryModal";

// ─── Shared Modal Shell ───────────────────────────────────────────────────────
const Modal = ({ children, onClose, maxWidth = "max-w-lg" }) => (
  <div
    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div
      className={`bg-white rounded-2xl w-full ${maxWidth} shadow-xl`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

// ─── Lookup Tables ────────────────────────────────────────────────────────────
const GRADE_LABELS = {
  junior: "Junior",
  strongJunior: "Strong Junior",
  middle: "Middle",
  strongMiddle: "Strong Middle",
  senior: "Senior",
};

const SPHERE_LABELS = {
  "backend-nodejs": "Backend (Node.js)",
  "backend-python": "Backend (Python)",
  "frontend-react": "Frontend (React)",
  "frontend-vue": "Frontend (Vue)",
  "mern-stack": "MERN Stack",
  "full-stack": "Full Stack",
};

const GRADE_OPTIONS = ["junior", "strongJunior", "middle", "strongMiddle", "senior"];

// ─── Main Component ───────────────────────────────────────────────────────────
const InternsTable = ({ interns, onEdit, onDelete, onViolations, refresh }) => {
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [sphereFilter, setSphereFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");

  // Row dropdown menu
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);

  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState("strongJunior");
  const [upgradeWithConcession, setUpgradeWithConcession] = useState(false);
  const [internStats, setInternStats] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(null);
  const [showBonusModal, setShowBonusModal] = useState(null);
  const [bonusCount, setBonusCount] = useState(5);
  const [bonusReason, setBonusReason] = useState("branch_help");
  const [bonusNotes, setBonusNotes] = useState("");
  const [bonusLoading, setBonusLoading] = useState(false);
  const [showHeadInternModal, setShowHeadInternModal] = useState(null);
  const [headInternBranch, setHeadInternBranch] = useState("");
  const [showActivationModal, setShowActivationModal] = useState(null);
  const [activationNote, setActivationNote] = useState("");

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Unique branches from interns list
  const branches = useMemo(() => {
    const all = interns.flatMap((i) => i.branches?.map((b) => b.branch).filter(Boolean) || []);
    return all.reduce((acc, b) => {
      if (b?._id && !acc.find((x) => x._id === b._id)) acc.push(b);
      return acc;
    }, []);
  }, [interns]);

  const filteredInterns = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return interns.filter((intern) => {
      const byBranch = selectedBranch === "all" ||
        intern.branches?.some((b) => b.branch?._id === selectedBranch || b.branch === selectedBranch);
      const bySphere = sphereFilter === "all" || intern.sphere === sphereFilter;
      const byPlan =
        planFilter === "all" ||
        (planFilter === "blocked" && intern.isPlanBlocked) ||
        (planFilter === "active" && !intern.isPlanBlocked);
      const bySearch =
        !q ||
        `${intern.name} ${intern.lastName}`.toLowerCase().includes(q) ||
        (intern.username || "").toLowerCase().includes(q) ||
        (intern.phoneNumber || "").toLowerCase().includes(q) ||
        (intern.telegram || "").toLowerCase().includes(q);
      return byBranch && bySphere && byPlan && bySearch;
    });
  }, [interns, selectedBranch, searchTerm, sphereFilter, planFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sphereFilter, planFilter, selectedBranch]);

  const totalPages = Math.ceil(filteredInterns.length / PAGE_SIZE);
  const paginatedInterns = filteredInterns.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const hasFilters =
    searchTerm || sphereFilter !== "all" || planFilter !== "all" || selectedBranch !== "all";

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleOpenUpgradeModal = async (internId) => {
    setShowUpgradeModal(internId);
    setUpgradeWithConcession(false);
    try {
      const res = await api.lessons.getAttendanceStats({ period: "month" });
      const arr = res.stats || res;
      setInternStats(arr.find((s) => s.internId === internId) || null);
    } catch {
      setInternStats(null);
    }
  };

  const handleUpgrade = async () => {
    try {
      await api.interns.upgrade(showUpgradeModal, {
        grade: selectedGrade,
        withConcession: upgradeWithConcession,
        percentage: internStats?.percentage || 0,
      });
      toast.success(
        upgradeWithConcession
          ? `🎁 Грейд повышен до "${GRADE_LABELS[selectedGrade]}" с уступкой`
          : `🎉 Грейд повышен до "${GRADE_LABELS[selectedGrade]}"`
      );
      setShowUpgradeModal(null);
      setUpgradeWithConcession(false);
      setInternStats(null);
      refresh();
    } catch (err) {
      toast.error(err.message || "Ошибка при повышении грейда");
    }
  };

  const handleAddBonus = async () => {
    if (!showBonusModal) return;
    setBonusLoading(true);
    try {
      const reasonLabels = {
        branch_help: "Помощь в делах филиала",
        event_day: "Работа на Event Day",
        other: bonusNotes || "Другое",
      };
      await api.interns.addBonus(showBonusModal, {
        count: bonusCount,
        reason: reasonLabels[bonusReason] || bonusReason,
        notes: bonusNotes,
      });
      toast.success(`🎁 Бонус +${bonusCount} уроков добавлен!`);
      setShowBonusModal(null);
      setBonusNotes("");
      setBonusCount(5);
      setBonusReason("branch_help");
      refresh();
    } catch (err) {
      toast.error(err.message || "Ошибка при добавлении бонуса");
    } finally {
      setBonusLoading(false);
    }
  };

  const handleSetHeadIntern = async (intern, makeHead) => {
    try {
      await api.interns.setHeadIntern(intern._id, makeHead, headInternBranch || undefined);
      toast.success(
        makeHead
          ? `👑 ${intern.name} ${intern.lastName} назначен Head Intern`
          : `${intern.name} ${intern.lastName} снят с должности Head Intern`
      );
      setShowHeadInternModal(null);
      refresh();
    } catch (err) {
      toast.error(err.message || "Ошибка при обновлении статуса");
    }
  };

  const handleToggleActivation = async (intern, enable) => {
    try {
      await api.interns.setActivation(intern._id, enable, enable ? activationNote : "");
      toast.success(enable ? "Аккаунт активирован" : "Ручная активация отключена");
      setShowActivationModal(null);
      setActivationNote("");
      refresh();
    } catch (err) {
      toast.error(err.message || "Ошибка при изменении статуса");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск по имени, username, телефону, Telegram..."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              {
                value: sphereFilter, onChange: setSphereFilter,
                options: [
                  ["all", "Все сферы"],
                  ["backend-nodejs", "Backend Node.js"],
                  ["backend-python", "Backend Python"],
                  ["frontend-react", "Frontend React"],
                  ["frontend-vue", "Frontend Vue"],
                  ["mern-stack", "MERN Stack"],
                  ["full-stack", "Full Stack"],
                ],
              },
              {
                value: planFilter, onChange: setPlanFilter,
                options: [
                  ["all", "Все статусы"],
                  ["blocked", "Заблокированные"],
                  ["active", "Активные"],
                ],
              },
              {
                value: selectedBranch, onChange: setSelectedBranch,
                options: [
                  ["all", "Все филиалы"],
                  ...branches.map((b) => [b._id, b.name]),
                ],
              },
            ].map(({ value, onChange, options }, idx) => (
              <select
                key={idx}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              >
                {options.map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            ))}
          </div>
        </div>
        {hasFilters && (
          <div className="mt-2.5 flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Показано {filteredInterns.length} из {interns.length}
            </span>
            <button
              onClick={() => {
                setSearchTerm("");
                setSphereFilter("all");
                setPlanFilter("all");
                setSelectedBranch("all");
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["Интерн", "Филиал", "Контакты", "Сфера · Грейд", "Уроки", "Статус", ""].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${i === 6 ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedInterns.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Search className="w-8 h-8 opacity-30" />
                      <p className="text-sm">Стажёры не найдены</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedInterns.map((intern) => {
                  const bonusTotal =
                    intern.bonusLessons?.reduce((s, b) => s + b.count, 0) || 0;
                  const hasActivity =
                    (intern.violations?.length || 0) + (intern.feedbacks?.length || 0) > 0;

                  return (
                    <tr key={intern._id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Интерн */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center font-semibold text-slate-600 text-xs shrink-0 overflow-hidden">
                            {intern.profilePhoto ? (
                              <img src={intern.profilePhoto} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{intern.name?.[0]}{intern.lastName?.[0]}</span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              {intern.isHeadIntern && (
                                <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                              )}
                              <span className="font-semibold text-slate-900 text-sm whitespace-nowrap">
                                {intern.name} {intern.lastName}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">@{intern.username}</p>
                          </div>
                        </div>
                      </td>

                      {/* Филиал */}
                      <td className="px-4 py-3 text-sm text-slate-700">
                        <div className="flex flex-wrap gap-1">
                          {intern.branches?.length
                            ? intern.branches.map((b, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 rounded-full px-2 py-0.5">
                                  {b.branch?.name || "—"}
                                  {b.mentor?.name && (
                                    <span className="text-slate-400">· {b.mentor.name} {b.mentor.lastName || ""}</span>
                                  )}
                                  {b.isHeadIntern && <span title="Head Intern">👑</span>}
                                </span>
                              ))
                            : <span className="text-slate-400 text-xs">—</span>
                          }
                        </div>
                      </td>

                      {/* Контакты */}
                      <td className="px-4 py-3">
                        <div className="space-y-0.5 text-xs">
                          <p className="text-slate-700">{intern.phoneNumber || "—"}</p>
                          <p className="text-slate-400">{intern.telegram || "—"}</p>
                        </div>
                      </td>

                      {/* Сфера · Грейд */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="text-xs text-slate-500 whitespace-nowrap">
                            {SPHERE_LABELS[intern.sphere] || intern.sphere || "—"}
                          </p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                            {GRADE_LABELS[intern.grade] || intern.grade || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Уроки */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-900">
                            {intern.lessonsVisited?.length || 0}
                          </span>
                          {bonusTotal > 0 && (
                            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                              +{bonusTotal}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Статус */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          {intern.isPlanBlocked ? (
                            <span className="inline-flex items-center text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 w-fit whitespace-nowrap">
                              Заблокирован
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 w-fit">
                              Активен
                            </span>
                          )}
                          {intern.manualActivation?.isEnabled ? (
                            <button
                              onClick={() => setShowActivationModal({ intern, enable: false })}
                              className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 w-fit hover:bg-amber-100 transition-colors whitespace-nowrap"
                            >
                              <Lock className="w-3 h-3" /> Деактивировать
                            </button>
                          ) : intern.isPlanBlocked ? (
                            <button
                              onClick={() => setShowActivationModal({ intern, enable: true })}
                              className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 w-fit hover:bg-green-100 transition-colors whitespace-nowrap"
                            >
                              <Unlock className="w-3 h-3" /> Активировать
                            </button>
                          ) : null}
                        </div>
                      </td>

                      {/* Действия */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEdit(intern)}
                            title="Редактировать"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onViolations(intern)}
                            title="Нарушения и отзывы"
                            className="relative p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            {hasActivity && (
                              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
                            )}
                          </button>

                          {/* ••• dropdown */}
                          <div
                            className="relative"
                            ref={openMenu === intern._id ? menuRef : null}
                          >
                            <button
                              onClick={() =>
                                setOpenMenu(openMenu === intern._id ? null : intern._id)
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {openMenu === intern._id && (
                              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                                {[
                                  {
                                    icon: <Gift className="w-4 h-4 text-purple-500" />,
                                    label: "Добавить бонус",
                                    onClick: () => { setShowBonusModal(intern._id); setOpenMenu(null); },
                                  },
                                  {
                                    icon: <Crown className="w-4 h-4 text-yellow-500" />,
                                    label: intern.isHeadIntern ? "Снять Head Intern" : "Назначить Head Intern",
                                    onClick: () => {
                                      setShowHeadInternModal(intern);
                                      setHeadInternBranch(intern.branches?.[0]?.branch?._id || intern.branches?.[0]?.branch || "");
                                      setOpenMenu(null);
                                    },
                                  },
                                  {
                                    icon: <ArrowUpCircle className="w-4 h-4 text-green-500" />,
                                    label: "Повысить грейд",
                                    onClick: () => { handleOpenUpgradeModal(intern._id); setOpenMenu(null); },
                                  },
                                  {
                                    icon: <History className="w-4 h-4 text-blue-500" />,
                                    label: "История повышений",
                                    onClick: () => { setShowHistoryModal(intern); setOpenMenu(null); },
                                  },
                                ].map(({ icon, label, onClick }) => (
                                  <button
                                    key={label}
                                    onClick={onClick}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                  >
                                    {icon} {label}
                                  </button>
                                ))}
                                <div className="my-1 border-t border-slate-100" />
                                <button
                                  onClick={() => { setShowDeleteModal(intern._id); setOpenMenu(null); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" /> Удалить
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2 pt-4 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              {filteredInterns.length} стажёров · стр. {currentPage} из {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ←
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '...' ? (
                    <span key={i} className="px-2 py-1.5 text-sm text-slate-400">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        p === currentPage
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Upgrade Modal ────────────────────────────────────────────────────── */}
      {showUpgradeModal && (
        <Modal
          onClose={() => { setShowUpgradeModal(null); setInternStats(null); }}
        >
          <div className="px-5 pt-5 pb-4 border-b border-slate-100">
            <h3 className="font-bold text-lg text-slate-900">Повысить грейд</h3>
          </div>
          <div className="p-5 space-y-4">
            {internStats && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Выполнение плана</p>
                  <p
                    className={`text-2xl font-bold ${
                      internStats.percentage >= 100
                        ? "text-green-600"
                        : internStats.percentage >= 70
                        ? "text-amber-500"
                        : "text-red-500"
                    }`}
                  >
                    {internStats.percentage}%
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {internStats.confirmedCount} / {internStats.norm} уроков
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Срок грейда</p>
                  <p className="text-2xl font-bold text-slate-900">{internStats.daysWorking}</p>
                  <p className="text-xs text-slate-400 mt-0.5">из {internStats.trialPeriodDays} дней</p>
                </div>
              </div>
            )}
            {internStats?.percentage < 100 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                Интерн выполнил только {internStats.percentage}% плана
              </div>
            )}
            {internStats?.canPromoteWithConcession && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
                <Gift className="w-4 h-4 shrink-0 mt-0.5" />
                Подходит под критерии повышения с уступкой
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Новый грейд</label>
              <select
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{GRADE_LABELS[g]}</option>
                ))}
              </select>
            </div>
            {internStats && internStats.percentage >= 50 && internStats.percentage < 100 && (
              <label className="flex items-center gap-3 cursor-pointer bg-amber-50 border border-amber-200 rounded-xl p-3">
                <input
                  type="checkbox"
                  checked={upgradeWithConcession}
                  onChange={(e) => setUpgradeWithConcession(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500"
                />
                <div>
                  <p className="text-sm font-medium text-amber-800">Повысить с уступкой</p>
                  <p className="text-xs text-amber-600">
                    Текущее выполнение: {internStats.percentage}%
                  </p>
                </div>
              </label>
            )}
          </div>
          <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button
              onClick={() => { setShowUpgradeModal(null); setUpgradeWithConcession(false); setInternStats(null); }}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleUpgrade}
              className="px-4 py-2 text-sm font-medium bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors"
            >
              Повысить
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete Modal ─────────────────────────────────────────────────────── */}
      {showDeleteModal && (
        <Modal onClose={() => setShowDeleteModal(null)} maxWidth="max-w-sm">
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-1">Удалить стажёра?</h3>
            <p className="text-sm text-slate-500 mb-6">Это действие нельзя отменить</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => { onDelete(showDeleteModal); setShowDeleteModal(null); }}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── History Modal ────────────────────────────────────────────────────── */}
      {showHistoryModal && (
        <PromotionHistoryModal
          intern={showHistoryModal}
          onClose={() => setShowHistoryModal(null)}
        />
      )}

      {/* ── Bonus Modal ──────────────────────────────────────────────────────── */}
      {showBonusModal && (
        <Modal onClose={() => setShowBonusModal(null)}>
          <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-900">Добавить бонусные уроки</h3>
            <button
              onClick={() => setShowBonusModal(null)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Количество уроков</p>
              <div className="flex gap-2">
                {[5, 10, 15].map((n) => (
                  <button
                    key={n}
                    onClick={() => setBonusCount(n)}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
                      bonusCount === n
                        ? "bg-purple-500 text-white border-purple-500"
                        : "text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    +{n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Причина</label>
              <select
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                value={bonusReason}
                onChange={(e) => setBonusReason(e.target.value)}
              >
                <option value="branch_help">Помощь в делах филиала</option>
                <option value="event_day">Работа на Event Day</option>
                <option value="other">Другое</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Заметки <span className="font-normal text-slate-400">(необязательно)</span>
              </label>
              <textarea
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                rows={2}
                placeholder="Дополнительная информация..."
                value={bonusNotes}
                onChange={(e) => setBonusNotes(e.target.value)}
              />
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-700">
              Будет добавлено <strong>+{bonusCount} уроков</strong> к прогрессу интерна
            </div>
          </div>
          <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button
              onClick={() => setShowBonusModal(null)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleAddBonus}
              disabled={bonusLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {bonusLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Gift className="w-4 h-4" />
              )}
              Добавить +{bonusCount}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Head Intern Modal ────────────────────────────────────────────────── */}
      {showHeadInternModal && (
        <Modal onClose={() => { setShowHeadInternModal(null); setHeadInternBranch(""); }} maxWidth="max-w-sm">
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown className="w-6 h-6 text-yellow-500" />
            </div>
            {showHeadInternModal.isHeadIntern ? (
              <>
                <h3 className="font-bold text-lg text-slate-900 mb-1">Снять с должности</h3>
                <p className="text-sm text-slate-500 mb-6">
                  <strong>{showHeadInternModal.name} {showHeadInternModal.lastName}</strong>{" "}
                  будет снят с должности Head Intern
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowHeadInternModal(null); setHeadInternBranch(""); }}
                    className="flex-1 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => handleSetHeadIntern(showHeadInternModal, false)}
                    className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
                  >
                    Снять
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold text-lg text-slate-900 mb-1">Назначить Head Intern</h3>
                <p className="text-sm text-slate-700 font-semibold mb-3">
                  {showHeadInternModal.name} {showHeadInternModal.lastName}
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 text-left mb-3">
                  Предыдущий Head Intern в этом филиале будет снят автоматически
                </div>
                <p className="text-xs text-slate-400 mb-6">
                  Head Intern может выдавать предупреждения другим интернам без привязки к уроку
                </p>
                {showHeadInternModal.branches?.length > 1 && (
                  <div className="mb-4 text-left">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Выберите филиал</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      value={headInternBranch}
                      onChange={(e) => setHeadInternBranch(e.target.value)}
                    >
                      {showHeadInternModal.branches.map((b) => (
                        <option key={b.branch?._id || b.branch} value={b.branch?._id || b.branch}>
                          {b.branch?.name || "Филиал"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowHeadInternModal(null); setHeadInternBranch(""); }}
                    className="flex-1 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => handleSetHeadIntern(showHeadInternModal, true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-yellow-400 hover:bg-yellow-500 text-white rounded-xl transition-colors"
                  >
                    <Crown className="w-4 h-4" /> Назначить
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── Activation Modal ─────────────────────────────────────────────────── */}
      {showActivationModal && (
        <Modal
          onClose={() => { setShowActivationModal(null); setActivationNote(""); }}
          maxWidth="max-w-sm"
        >
          <div className="p-6">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                showActivationModal.enable ? "bg-green-100" : "bg-amber-100"
              }`}
            >
              {showActivationModal.enable ? (
                <Unlock className="w-6 h-6 text-green-500" />
              ) : (
                <Lock className="w-6 h-6 text-amber-500" />
              )}
            </div>
            <h3 className="font-bold text-lg text-slate-900 text-center mb-1">
              {showActivationModal.enable ? "Активировать аккаунт" : "Деактивировать"}
            </h3>
            <p className="text-sm text-slate-500 text-center mb-4">
              {showActivationModal.intern.name} {showActivationModal.intern.lastName}
            </p>
            {showActivationModal.enable && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Причина <span className="font-normal text-slate-400">(необязательно)</span>
                </label>
                <input
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  placeholder="Укажите причину..."
                  value={activationNote}
                  onChange={(e) => setActivationNote(e.target.value)}
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowActivationModal(null); setActivationNote(""); }}
                className="flex-1 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() =>
                  handleToggleActivation(showActivationModal.intern, showActivationModal.enable)
                }
                className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors ${
                  showActivationModal.enable
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-amber-500 hover:bg-amber-600"
                }`}
              >
                {showActivationModal.enable ? "Активировать" : "Деактивировать"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default InternsTable;
