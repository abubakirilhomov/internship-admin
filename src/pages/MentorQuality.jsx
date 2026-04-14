import React, { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Star } from "lucide-react";
import { api } from "../utils/api";

const qualityColor = (score) => {
  if (score === null || score === undefined) return "text-gray-400";
  if (score >= 4) return "text-green-600";
  if (score >= 3) return "text-yellow-600";
  if (score >= 2) return "text-orange-600";
  return "text-red-600";
};

const StarRating = ({ score, max = 5 }) => {
  const filled = Math.round(score ?? 0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < filled
              ? "text-yellow-400 fill-yellow-400"
              : "text-slate-200 fill-slate-200"
          }`}
        />
      ))}
    </div>
  );
};

const MentorQuality = () => {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [statsCache, setStatsCache] = useState({});
  const [loadingStats, setLoadingStats] = useState({});

  const fetchMentors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.mentors.getAll();
      const list = Array.isArray(result) ? result : result?.data || [];
      setMentors(list);
    } catch (err) {
      setError(err.message || "Ошибка загрузки менторов");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMentors();
  }, [fetchMentors]);

  const handleRowClick = async (mentorId) => {
    if (expandedId === mentorId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(mentorId);
    if (statsCache[mentorId]) return;

    setLoadingStats((prev) => ({ ...prev, [mentorId]: true }));
    try {
      const result = await api.mentors.getStats(mentorId);
      const stats = result?.data || result || {};
      setStatsCache((prev) => ({ ...prev, [mentorId]: stats }));
    } catch {
      setStatsCache((prev) => ({ ...prev, [mentorId]: null }));
    } finally {
      setLoadingStats((prev) => ({ ...prev, [mentorId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3 text-slate-400">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-sm">Загрузка менторов...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Качество менторов</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Оценки уроков по критериям интернов — нажмите на строку для деталей
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 mb-5 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Ментор
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Филиал
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Оценка качества
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Кол-во оценок
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Детали
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {mentors.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-4 py-12 text-center text-slate-400 text-sm">
                  Нет менторов для отображения
                </td>
              </tr>
            ) : (
              mentors.map((mentor) => {
                const isExpanded = expandedId === mentor._id;
                const stats = statsCache[mentor._id];
                const isLoadingRow = loadingStats[mentor._id];
                const score = stats?.qualityScore ?? null;
                const feedbackCount = stats?.qualityFeedbackCount ?? null;

                return (
                  <React.Fragment key={mentor._id}>
                    <tr
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(mentor._id)}
                    >
                      {/* Mentor name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {mentor.profilePhoto ? (
                            <img
                              src={mentor.profilePhoto}
                              alt={mentor.name}
                              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-blue-700">
                                {mentor.name?.[0] ?? ""}
                                {mentor.lastName?.[0] ?? ""}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900">
                              {mentor.name} {mentor.lastName}
                            </p>
                            {mentor.role === "admin" && (
                              <span className="text-xs text-blue-600 font-medium">Администратор</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3 text-slate-600">
                        {mentor.branches?.map(b => b.name || b).filter(Boolean).join(", ") || "—"}
                      </td>

                      {/* Quality score */}
                      <td className="px-4 py-3">
                        {isLoadingRow ? (
                          <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                        ) : score !== null ? (
                          <div className="flex items-center gap-2">
                            <StarRating score={score} />
                            <span className={`font-semibold text-sm ${qualityColor(score)}`}>
                              {score.toFixed(2)}
                            </span>
                          </div>
                        ) : isExpanded ? (
                          <span className="text-gray-400 text-xs">Нет данных</span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Feedback count */}
                      <td className="px-4 py-3">
                        {isLoadingRow ? (
                          <span className="text-slate-300 text-xs">...</span>
                        ) : feedbackCount !== null ? (
                          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                            {feedbackCount}
                          </span>
                        ) : isExpanded ? (
                          <span className="text-gray-400 text-xs">—</span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Expand toggle */}
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRowClick(mentor._id); }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          {isExpanded ? (
                            <>Скрыть <ChevronUp className="w-3.5 h-3.5" /></>
                          ) : (
                            <>Показать <ChevronDown className="w-3.5 h-3.5" /></>
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan="5" className="px-4 py-4 bg-slate-50 border-b border-slate-100">
                          {isLoadingRow ? (
                            <div className="flex justify-center py-4">
                              <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                            </div>
                          ) : stats === null ? (
                            <p className="text-slate-500 text-sm text-center py-2">
                              Не удалось загрузить статистику
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-6 text-sm">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                                  Оценка качества
                                </span>
                                <span className={`text-lg font-bold ${qualityColor(stats.qualityScore)}`}>
                                  {stats.qualityScore !== null && stats.qualityScore !== undefined
                                    ? `${stats.qualityScore.toFixed(2)} / 5`
                                    : "Нет данных"}
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                                  Количество оценённых уроков
                                </span>
                                <span className="text-lg font-bold text-slate-900">
                                  {stats.qualityFeedbackCount ?? "—"}
                                </span>
                              </div>
                              {stats.totalLessons !== undefined && (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                                    Всего уроков
                                  </span>
                                  <span className="text-lg font-bold text-slate-900">
                                    {stats.totalLessons}
                                  </span>
                                </div>
                              )}
                              {stats.totalInterns !== undefined && (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                                    Интернов
                                  </span>
                                  <span className="text-lg font-bold text-slate-900">
                                    {stats.totalInterns}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MentorQuality;
