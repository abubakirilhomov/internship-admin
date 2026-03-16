import React, { useState, useMemo } from "react";
import { Trash2, Edit, ArrowUpCircle, History, Gift, Crown, Unlock, Lock } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../utils/api";
import PromotionHistoryModal from "./PromotionHistoryModal";

const InternsTable = ({ interns, onEdit, onDelete, onViolations, rules, refresh }) => {
  const [selectedIntern, setSelectedIntern] = useState(null);
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

  // 🔹 Получаем список всех уникальных филиалов
  const branches = useMemo(() => {
    const list = interns
      .map((i) => i.branch)
      .filter((b) => b && b.name)
      .reduce((acc, branch) => {
        if (!acc.find((x) => x._id === branch._id)) acc.push(branch);
        return acc;
      }, []);
    return list;
  }, [interns]);

  // 🔹 Для фильтрации по филиалу
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sphereFilter, setSphereFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  // 🔹 Фильтруем интернов
  const filteredInterns = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    return interns.filter((intern) => {
      const byBranch =
        selectedBranch === "all" || intern.branch?._id === selectedBranch;
      const bySphere = sphereFilter === "all" || intern.sphere === sphereFilter;
      const byPlan =
        planFilter === "all" ||
        (planFilter === "blocked" && intern.isPlanBlocked) ||
        (planFilter === "active" && !intern.isPlanBlocked);

      const bySearch =
        !normalizedQuery ||
        `${intern.name} ${intern.lastName}`.toLowerCase().includes(normalizedQuery) ||
        (intern.username || "").toLowerCase().includes(normalizedQuery) ||
        (intern.phoneNumber || "").toLowerCase().includes(normalizedQuery) ||
        (intern.telegram || "").toLowerCase().includes(normalizedQuery);

      return byBranch && bySphere && byPlan && bySearch;
    });
  }, [interns, selectedBranch, searchTerm, sphereFilter, planFilter]);

  const handleDeleteConfirm = (id) => {
    onDelete(id);
    setShowDeleteModal(null);
  };

  const handleUpgrade = async () => {
    try {
      const result = await api.interns.upgrade(showUpgradeModal, {
        grade: selectedGrade,
        withConcession: upgradeWithConcession,
        percentage: internStats?.percentage || 0,
      });

      if (upgradeWithConcession) {
        toast.success(`🎁 Грейд повышен до "${selectedGrade}" с уступкой`);
      } else {
        toast.success(`🎉 Грейд повышен до "${selectedGrade}"`);
      }

      setShowUpgradeModal(null);
      setUpgradeWithConcession(false);
      setInternStats(null);
      refresh();
    } catch (err) {
      toast.error(err.message || "Ошибка при повышении грейда");
    }
  };

  const handleOpenUpgradeModal = async (internId) => {
    setShowUpgradeModal(internId);
    setUpgradeWithConcession(false);

    // Получаем статистику интерна из родительского компонента Interns.jsx
    // Для этого нужно передать stats как пропс или получить через API
    try {
      const statsResponse = await api.lessons.getAttendanceStats({ period: 'month' });
      const stats = statsResponse.stats || statsResponse;
      const stat = stats.find(s => s.internId === internId);
      setInternStats(stat || null);
    } catch (err) {
      console.error('Ошибка получения статистики:', err);
      setInternStats(null);
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
      toast.success(`🎁 Бонус +${bonusCount} уроков успешно добавлен!`);
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
      await api.interns.setHeadIntern(intern._id, makeHead);
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
      const note = enable
        ? prompt("Причина ручной активации (необязательно):", "") || ""
        : "";
      await api.interns.setActivation(intern._id, enable, note);
      toast.success(enable ? "Аккаунт активирован" : "Ручная активация отключена");
      refresh();
    } catch (err) {
      toast.error(err.message || "Ошибка при изменении статуса");
    }
  };

  const gradeOptions = [
    "junior",
    "strongJunior",
    "middle",
    "strongMiddle",
    "senior",
  ];

  return (
    <div className="overflow-x-auto">
      {/* 🔹 Фильтр по филиалу */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-xl font-bold">Стажёры</h2>
        <input
          className="input input-bordered w-72"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Поиск: ФИО, username, телефон, telegram"
        />
        <select
          className="select select-bordered w-56"
          value={sphereFilter}
          onChange={(e) => setSphereFilter(e.target.value)}
        >
          <option value="all">Все сферы</option>
          <option value="backend-nodejs">Backend (Node.js)</option>
          <option value="backend-python">Backend (Python)</option>
          <option value="frontend-react">Frontend (React)</option>
          <option value="frontend-vue">Frontend (Vue)</option>
          <option value="mern-stack">MERN Stack</option>
          <option value="full-stack">Full Stack</option>
        </select>
        <select
          className="select select-bordered w-56"
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
        >
          <option value="all">Все статусы плана</option>
          <option value="blocked">Только заблокированные</option>
          <option value="active">Только активные</option>
        </select>
        <select
          className="select select-bordered w-64"
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
        >
          <option value="all">Все филиалы</option>
          {branches.map((b) => (
            <option key={b._id} value={b._id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>Имя</th>
            <th>Фамилия</th>
            <th>Филиал</th>
            <th>Контакты</th>
            <th>Сфера</th>
            <th>Уроки</th>
            <th>Грейд</th>
            <th>Статус</th>
            <th className="text-center">Действия</th>
          </tr>
        </thead>
        <tbody>
          {filteredInterns.length === 0 ? (
            <tr>
              <td colSpan="9" className="text-center py-6 text-gray-500">
                Нет стажёров для выбранного филиала
              </td>
            </tr>
          ) : (
            filteredInterns.map((intern) => (
              <tr
                key={intern._id}
                className="hover:bg-base-200 transition"
                onClick={() => setSelectedIntern(intern)}
              >
                <td>
                  <div className="flex items-center gap-1">
                    {intern.isHeadIntern && (
                      <span title="Head Intern" className="text-yellow-500">
                        <Crown className="h-4 w-4 inline" />
                      </span>
                    )}
                    {intern.name}
                  </div>
                </td>
                <td>{intern.lastName}</td>
                <td>{intern.branch?.name || "—"}</td>
                <td>
                  <div className="text-xs">
                    <div>{intern.phoneNumber || "—"}</div>
                    <div>{intern.telegram || "—"}</div>
                  </div>
                </td>
                <td>{intern.sphere || "—"}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <span>{intern?.lessonsVisited?.length || 0}</span>
                    {intern.bonusLessons?.length > 0 && (
                      <span
                        className="badge badge-sm badge-warning"
                        title={`Бонус: +${intern.bonusLessons.reduce((s, b) => s + b.count, 0)} уроков`}
                      >
                        +{intern.bonusLessons.reduce((s, b) => s + b.count, 0)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="capitalize">{intern.grade}</td>
                <td>
                  <div className="flex flex-col gap-2">
                    {intern.isPlanBlocked ? (
                      <span className="badge badge-error">Заблокирован</span>
                    ) : (
                      <span className="badge badge-success">Активен</span>
                    )}
                    {intern.manualActivation?.isEnabled ? (
                      <button
                        className="btn btn-xs btn-outline btn-warning gap-1"
                        onClick={() => handleToggleActivation(intern, false)}
                        title="Отключить ручную активацию"
                      >
                        <Lock className="h-3 w-3" />
                        Отключить активацию
                      </button>
                    ) : intern.isPlanBlocked ? (
                      <button
                        className="btn btn-xs btn-success gap-1"
                        onClick={() => handleToggleActivation(intern, true)}
                        title="Активировать аккаунт вручную"
                      >
                        <Unlock className="h-3 w-3" />
                        Активировать
                      </button>
                    ) : null}
                  </div>
                </td>
                <td
                  className="flex justify-center gap-2 flex-wrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onEdit(intern)}
                    className="btn btn-sm btn-primary"
                    title="Редактировать"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onViolations(intern)}
                    className="btn btn-sm btn-warning relative"
                    title="Нарушения и отзывы"
                  >
                    <div className="flex">
                      ⚠️
                      {(intern.violations?.length > 0 || intern.feedbacks?.length > 0) && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setShowBonusModal(intern._id)}
                    className="btn btn-sm btn-accent"
                    title="Добавить бонусные уроки"
                  >
                    <Gift className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowHeadInternModal(intern)}
                    className={`btn btn-sm ${intern.isHeadIntern ? "btn-warning" : "btn-ghost border border-yellow-400"}`}
                    title={intern.isHeadIntern ? "Снять с должности Head Intern" : "Назначить Head Intern"}
                  >
                    <Crown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleOpenUpgradeModal(intern._id)}
                    className="btn btn-sm btn-success"
                    title="Повысить грейд"
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowHistoryModal(intern)}
                    className="btn btn-sm btn-info"
                    title="История повышений"
                  >
                    <History className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(intern._id)}
                    className="btn btn-sm btn-error"
                    title="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* --- Upgrade Modal --- */}
      {showUpgradeModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Повысить грейд</h3>

            {/* Показать статистику интерна */}
            {internStats && (
              <div className="mb-4">
                <div className="stats stats-vertical lg:stats-horizontal shadow w-full">
                  <div className="stat">
                    <div className="stat-title">Процент выполнения</div>
                    <div className={`stat-value text-2xl ${internStats.percentage >= 100 ? 'text-success' :
                      internStats.percentage >= 70 ? 'text-warning' :
                        'text-error'
                      }`}>
                      {internStats.percentage}%
                    </div>
                    <div className="stat-desc">{internStats.confirmedCount} / {internStats.norm} уроков</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Срок грейда</div>
                    <div className="stat-value text-2xl">{internStats.daysWorking}</div>
                    <div className="stat-desc">из {internStats.trialPeriodDays} дней</div>
                  </div>
                </div>

                {/* Предупреждение если процент низкий */}
                {internStats.percentage < 100 && (
                  <div className="alert alert-warning mt-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>⚠️ Интерн выполнил только {internStats.percentage}% плана</span>
                  </div>
                )}

                {/* Подсказка об уступке */}
                {internStats.canPromoteWithConcession && (
                  <div className="alert alert-info mt-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>🎁 Интерн подходит под критерии повышения с уступкой</span>
                  </div>
                )}
              </div>
            )}

            <p className="mb-2">Выберите новый уровень:</p>
            <select
              className="select select-bordered w-full mb-4"
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
            >
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            {/* Чекбокс для уступки */}
            {internStats && internStats.percentage >= 50 && internStats.percentage < 100 && (
              <div className="form-control mb-4">
                <label className="label cursor-pointer">
                  <span className="label-text">
                    🎁 Повысить с уступкой (текущий % выполнения: {internStats.percentage}%)
                  </span>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-warning"
                    checked={upgradeWithConcession}
                    onChange={(e) => setUpgradeWithConcession(e.target.checked)}
                  />
                </label>
                {upgradeWithConcession && (
                  <p className="text-xs text-warning mt-2">
                    ℹ️ Это повышение будет отмечено как "с уступкой" в истории
                  </p>
                )}
              </div>
            )}

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowUpgradeModal(null);
                  setUpgradeWithConcession(false);
                  setInternStats(null);
                }}
              >
                Отмена
              </button>
              <button className="btn btn-success" onClick={handleUpgrade}>
                Повысить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Delete Modal --- */}
      {showDeleteModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Удалить стажёра?</h3>
            <p className="mb-4">Это действие нельзя отменить.</p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowDeleteModal(null)}
              >
                Отмена
              </button>
              <button
                className="btn btn-error"
                onClick={() => handleDeleteConfirm(showDeleteModal)}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- History Modal --- */}
      {showHistoryModal && (
        <PromotionHistoryModal
          intern={showHistoryModal}
          onClose={() => setShowHistoryModal(null)}
        />
      )}

      {/* --- Bonus Lessons Modal --- */}
      {showBonusModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-2">🎁 Добавить бонусные уроки</h3>
            <p className="text-sm text-gray-500 mb-4">
              Бонус за помощь в делах филиала или работу на Event Day
            </p>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-semibold">Количество уроков</span>
              </label>
              <div className="flex gap-3">
                {[5, 10, 15].map((n) => (
                  <button
                    key={n}
                    className={`btn flex-1 ${bonusCount === n ? "btn-accent" : "btn-outline btn-accent"}`}
                    onClick={() => setBonusCount(n)}
                  >
                    +{n}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-semibold">Причина</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={bonusReason}
                onChange={(e) => setBonusReason(e.target.value)}
              >
                <option value="branch_help">Помощь в делах филиала</option>
                <option value="event_day">Работа на Event Day</option>
                <option value="other">Другое</option>
              </select>
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Дополнительные заметки</span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full"
                placeholder="Опционально..."
                value={bonusNotes}
                onChange={(e) => setBonusNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="alert alert-info py-2 mb-4">
              <span className="text-sm">
                Бонус <strong>+{bonusCount} уроков</strong> будет добавлен к текущему прогрессу интерна
              </span>
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowBonusModal(null);
                  setBonusNotes("");
                  setBonusCount(5);
                  setBonusReason("branch_help");
                }}
              >
                Отмена
              </button>
              <button
                className="btn btn-accent"
                onClick={handleAddBonus}
                disabled={bonusLoading}
              >
                {bonusLoading ? <span className="loading loading-spinner loading-sm" /> : `Добавить +${bonusCount}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Head Intern Modal --- */}
      {showHeadInternModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            {showHeadInternModal.isHeadIntern ? (
              <>
                <h3 className="font-bold text-lg mb-2">Снять с должности Head Intern</h3>
                <p className="mb-4">
                  Снять <strong>{showHeadInternModal.name} {showHeadInternModal.lastName}</strong> с должности Head Intern?
                </p>
                <div className="modal-action">
                  <button className="btn btn-ghost" onClick={() => setShowHeadInternModal(null)}>
                    Отмена
                  </button>
                  <button
                    className="btn btn-error"
                    onClick={() => handleSetHeadIntern(showHeadInternModal, false)}
                  >
                    Снять
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold text-lg mb-2">👑 Назначить Head Intern</h3>
                <p className="mb-2">
                  Назначить <strong>{showHeadInternModal.name} {showHeadInternModal.lastName}</strong> Head Intern?
                </p>
                <div className="alert alert-warning py-2 mb-4">
                  <span className="text-sm">
                    Предыдущий Head Intern в филиале <strong>{showHeadInternModal.branch?.name}</strong> будет снят с должности автоматически
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Head Intern может выдавать предупреждения другим интернам своего филиала без необходимости привязки к уроку
                </p>
                <div className="modal-action">
                  <button className="btn btn-ghost" onClick={() => setShowHeadInternModal(null)}>
                    Отмена
                  </button>
                  <button
                    className="btn btn-warning"
                    onClick={() => handleSetHeadIntern(showHeadInternModal, true)}
                  >
                    <Crown className="h-4 w-4 mr-1" /> Назначить
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InternsTable;
