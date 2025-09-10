import React, { useState } from "react";
import ViolationsModal from "./ViolationsModal";
import { Trash2, Edit } from "lucide-react";

const InternsTable = ({ interns, onEdit, onDelete, rules }) => {
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null); // Store intern ID for deletion

  const handleDeleteConfirm = (id) => {
    onDelete(id);
    setShowDeleteModal(null); // Close modal after confirmation
  };

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>Имя</th>
            <th>Филиал</th>
            <th>Уроки</th>
            <th>Оценка</th>
            <th className="text-center">Действия</th>
          </tr>
        </thead>
        <tbody>
          {interns.map((intern) => (
            <tr
              key={intern._id}
              className="cursor-pointer hover:bg-base-200"
              onClick={() => setSelectedIntern(intern)}
            >
              <td>{intern.name}</td>
              <td>{intern.branch?.name || "Не указан"}</td>
              <td>{intern?.lessonsVisited?.length || 0}</td>
              <td>{intern?.score || 0}</td>
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
                  onClick={() => setShowDeleteModal(intern._id)}
                  className="btn btn-sm btn-error"
                  title="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Violations Modal */}
      {selectedIntern && (
        <ViolationsModal
          intern={selectedIntern}
          rules={rules}
          onClose={() => setSelectedIntern(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Подтверждение удаления</h3>
            <p className="mb-4">
              Вы уверены, что хотите удалить стажёра? Это действие нельзя отменить.
            </p>
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