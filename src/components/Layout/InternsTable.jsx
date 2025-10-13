import React, { useState, useMemo } from "react";
import { Trash2, Edit, ArrowUpCircle } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../utils/api";

const InternsTable = ({ interns, onEdit, onDelete, rules, refresh }) => {
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState("strongJunior");

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

  // 🔹 Фильтруем интернов
  const filteredInterns = useMemo(() => {
    if (selectedBranch === "all") return interns;
    return interns.filter((i) => i.branch?._id === selectedBranch);
  }, [interns, selectedBranch]);

  const handleDeleteConfirm = (id) => {
    onDelete(id);
    setShowDeleteModal(null);
  };

  const handleUpgrade = async () => {
    try {
      await api.interns.upgrade(showUpgradeModal, selectedGrade);
      toast.success(`🎉 Грейд повышен до "${selectedGrade}"`);
      setShowUpgradeModal(null);
      refresh();
    } catch (err) {
      toast.error(err.message || "Ошибка при повышении грейда");
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Стажёры</h2>
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
            <th>Уроки</th>
            <th>Грейд</th>
            <th className="text-center">Действия</th>
          </tr>
        </thead>
        <tbody>
          {filteredInterns.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center py-6 text-gray-500">
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
                <td>{intern.name}</td>
                <td>{intern.lastName}</td>
                <td>{intern.branch?.name || "—"}</td>
                <td>{intern?.lessonsVisited?.length || 0}</td>
                <td className="capitalize">{intern.grade}</td>
                <td
                  className="flex justify-center gap-2"
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
                    onClick={() => setShowUpgradeModal(intern._id)}
                    className="btn btn-sm btn-success"
                    title="Повысить грейд"
                  >
                    <ArrowUpCircle className="h-4 w-4" />
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
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowUpgradeModal(null)}
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
    </div>
  );
};

export default InternsTable;
