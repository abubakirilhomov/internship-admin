import React from "react";

const InternsCardList = ({ interns, onEdit, onDelete }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {interns.map((intern) => (
        <div
          key={intern._id}
          className="card bg-base-100 shadow-md hover:shadow-lg transition"
        >
          <div className="card-body">
            <h2 className="card-title">{intern.name}</h2>
            <p>Филиал: {intern.branch?.name}</p>
            <p>Уроки: {intern.attendedLessons}</p>
            <p>Оценка: {intern.rating}</p>
            <div className="card-actions justify-end mt-2">
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
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default InternsCardList;
