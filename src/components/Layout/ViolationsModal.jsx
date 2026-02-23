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
      <div className="modal-box w-11/12 max-w-3xl">
        <h3 className="font-bold text-lg mb-4">Детали: {intern.name} {intern.lastName}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Violations Section */}
          <div>
            <h4 className="font-bold mb-2">Нарушения ({intern.violations?.length || 0})</h4>
            {intern.violations?.length > 0 ? (
              <ul className="space-y-2">
                {intern.violations.map((violation, index) => {
                  const rule = rules.find((r) => r._id === violation.ruleId);
                  return (
                    <li key={index} className="bg-base-200 p-2 rounded-lg text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge badge-sm ${getCategoryColor(rule?.category)}`}>
                          {rule?.category || "N/A"}
                        </span>
                        <span className="font-semibold">{rule?.title || violation.ruleId}</span>
                        {violation.issuedBy === "headIntern" && (
                          <span className="badge badge-sm badge-warning gap-1">
                            👑 Head Intern
                          </span>
                        )}
                        {violation.issuedBy === "admin" && (
                          <span className="badge badge-sm badge-error gap-1">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs opacity-75">{new Date(violation.date).toLocaleDateString()}</p>
                      {violation.notes && <p className="mt-1 italic">"{violation.notes}"</p>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Нет нарушений</p>
            )}
          </div>

          {/* Feedbacks Section */}
          <div>
            <h4 className="font-bold mb-2">Отзывы менторов ({intern.feedbacks?.length || 0})</h4>
            {intern.feedbacks?.length > 0 ? (
              <ul className="space-y-2 h-96 overflow-y-auto">
                {intern.feedbacks.slice().reverse().map((fb, index) => {
                  const mentor = fb.mentorId
                    ? (typeof fb.mentorId === 'object' ? `${fb.mentorId.name} ${fb.mentorId.lastName || ''}` : 'Ментор')
                    : 'Ментор';

                  return (
                    <li key={index} className="bg-base-200 p-2 rounded-lg text-sm">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-primary">{mentor}</span>
                        <div className="rating rating-xs">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <input
                              key={star}
                              type="radio"
                              className="mask mask-star-2 bg-orange-400"
                              checked={star <= fb.stars}
                              readOnly
                            />
                          ))}
                        </div>
                      </div>
                      <p className="mt-1">"{fb.feedback}"</p>
                      <p className="text-xs opacity-50 text-right mt-1">
                        {new Date(fb.date).toLocaleDateString()}
                      </p>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Нет отзывов</p>
            )}
          </div>
        </div>

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