import React from "react";

const ViolationsModal = ({ intern, onClose, violations }) => {

  return (
    <>
      <input type="checkbox" checked readOnly className="modal-toggle" />
      <div className="modal">
        <div className="modal-box max-w-2xl">
          <h3 className="font-bold text-lg mb-4">
            Нарушения: {intern.name}
          </h3>

          {intern.violations?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-compact w-full">
                <thead>
                  <tr>
                    <th>Правило</th>
                    <th>Дата</th>
                    <th>Заметки</th>
                    <th>Последствие</th>
                  </tr>
                </thead>
                <tbody>
                  {intern.violations.map((v) => (
                    <tr key={v._id}>
                      <td>{v.ruleId}</td>
                      <td>{new Date(v.date).toLocaleDateString()}</td>
                      <td>{v.notes || "-"}</td>
                      <td>{v.consequenceApplied || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">Нарушений нет</p>
          )}

          <div className="modal-action">
            <button onClick={onClose} className="btn">
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ViolationsModal;
