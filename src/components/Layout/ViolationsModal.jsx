import React from "react";

const ViolationsModal = ({ intern, rules, onClose }) => {
  const getCategoryColor = (category) => {
    switch (category) {
      case "black":
        return "bg-gray-800 text-white";
      case "red":
        return "bg-red-500 text-white";
      case "yellow":
        return "bg-yellow-500 text-black";
      case "green":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-200 text-black";
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">Нарушения: {intern.name}</h3>
        {intern.violations?.length > 0 ? (
          <ul className="list-disc pl-5 space-y-2">
            {intern.violations.map((violation, index) => {
              const rule = rules.find((r) => r._id === violation.ruleId);
              return (
                <li key={index} className="flex items-center gap-2">
                  <span
                    className={`badge ${getCategoryColor(rule?.category)}`}
                  >
                    {rule?.category || "Неизвестно"}
                  </span>
                  <span>{rule?.title || violation.ruleId}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Нет нарушений</p>
        )}
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViolationsModal;