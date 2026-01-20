import React from "react";

const PromotionHistoryModal = ({ intern, onClose }) => {
    if (!intern) return null;

    const promotionHistory = intern.promotionHistory || [];

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                <h3 className="font-bold text-lg mb-4">
                    История повышений: {intern.name} {intern.lastName}
                </h3>

                {promotionHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>📜 Нет истории повышений</p>
                        <p className="text-sm mt-2">Текущий грейд: {intern.grade}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr>
                                    <th>Дата</th>
                                    <th>Из</th>
                                    <th>В</th>
                                    <th>% выполнения</th>
                                    <th>Тип</th>
                                </tr>
                            </thead>
                            <tbody>
                                {promotionHistory
                                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                                    .map((h, idx) => (
                                        <tr key={idx}>
                                            <td>{new Date(h.date).toLocaleDateString('ru-RU')}</td>
                                            <td>
                                                <span className="badge badge-sm badge-ghost">
                                                    {h.fromGrade}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="badge badge-sm badge-primary">
                                                    {h.toGrade}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`font-semibold ${h.percentage >= 100 ? 'text-success' :
                                                        h.percentage >= 70 ? 'text-warning' :
                                                            'text-error'
                                                    }`}>
                                                    {h.percentage || 0}%
                                                </span>
                                            </td>
                                            <td>
                                                {h.withConcession ? (
                                                    <span className="badge badge-warning gap-1">
                                                        🎁 С уступкой
                                                    </span>
                                                ) : (
                                                    <span className="badge badge-success">
                                                        ✅ Обычное
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>

                        {/* Показать последнее повышение отдельно */}
                        {promotionHistory.length > 0 && promotionHistory[0].withConcession && (
                            <div className="alert alert-warning mt-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <span>
                                    Последнее повышение было с уступкой
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <div className="modal-action">
                    <button className="btn" onClick={onClose}>
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PromotionHistoryModal;
