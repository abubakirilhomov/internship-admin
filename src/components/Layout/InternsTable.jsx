import React, { useState } from "react";
import ViolationsModal from "./ViolationsModal";

const InternsTable = ({ interns, onEdit, onDelete, rules }) => {
  const [selectedIntern, setSelectedIntern] = useState(null);
    console.log(rules)
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
              <td>{intern.branch?.name}</td>
              <td>{intern?.lessonsVisited?.length}</td>
              <td>{intern?.score}</td>
              <td
                className="flex justify-center gap-2"
                onClick={(e) => e.stopPropagation()} // чтобы не открывалась модалка при нажатии на кнопки
              >
                <button
                  onClick={() => onEdit(intern)}
                  className="btn btn-sm btn-primary"
                >
                  Ред.
                </button>
                <button
                  onClick={() => onDelete(intern._id)}
                  className="btn btn-sm btn-error"
                >
                  Удл.
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Модалка с нарушениями */}
      {selectedIntern && (
        <ViolationsModal
          intern={selectedIntern}
          onClose={() => setSelectedIntern(null)}
        />
      )}
    </div>
  );
};

export default InternsTable;
