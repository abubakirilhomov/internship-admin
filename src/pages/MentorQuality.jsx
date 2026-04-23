import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Star, ArrowUpDown } from "lucide-react";
import { api } from "../utils/api";

const qualityColor = (score) => {
  if (score === null || score === undefined) return "text-gray-400";
  if (score >= 4) return "text-green-600";
  if (score >= 3) return "text-yellow-600";
  if (score >= 2) return "text-orange-600";
  return "text-red-600";
};

const rangeMeta = {
  active:   { label: "Активен",   dot: "bg-green-500",  bar: "bg-green-500",  text: "text-green-700",  bg: "bg-green-50" },
  onTrack:  { label: "В норме",   dot: "bg-blue-500",   bar: "bg-blue-500",   text: "text-blue-700",   bg: "bg-blue-50" },
  behind:   { label: "Отстаёт",   dot: "bg-yellow-500", bar: "bg-yellow-500", text: "text-yellow-700", bg: "bg-yellow-50" },
  inactive: { label: "Неактивен", dot: "bg-red-500",    bar: "bg-red-500",    text: "text-red-700",    bg: "bg-red-50" },
};

const rangeFromPercent = (p) => {
  if (p >= 80) return "active";
  if (p >= 50) return "onTrack";
  if (p >= 25) return "behind";
  return "inactive";
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

const ActivityBar = ({ percent }) => {
  const range = rangeFromPercent(percent);
  const meta = rangeMeta[range];
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${meta.bar} transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <span className={`text-sm font-semibold tabular-nums ${meta.text}`}>
        {percent}%
      </span>
    </div>
  );
};

const DistributionBadges = ({ distribution, total }) => {
  if (!total) return <span className="text-slate-300 text-xs">—</span>;
  const parts = [
    { key: "active", count: distribution.active },
    { key: "onTrack", count: distribution.onTrack },
    { key: "behind", count: distribution.behind },
    { key: "inactive", count: distribution.inactive },
  ].filter((p) => p.count > 0);
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
        {total}
      </span>
      {parts.map((p) => (
        <span
          key={p.key}
          title={rangeMeta[p.key].label}
          className={`inline-flex items-center gap-1 px-1.5 h-6 rounded text-xs font-medium ${rangeMeta[p.key].bg} ${rangeMeta[p.key].text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${rangeMeta[p.key].dot}`} />
          {p.count}
        </span>
      ))}
    </div>
  );
};

const SortableHeader = ({ label, sortKey, sortState, onSort }) => {
  const active = sortState.key === sortKey;
  return (
    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-slate-700 transition-colors ${
          active ? "text-slate-900" : ""
        }`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? "opacity-100" : "opacity-40"}`} />
      </button>
    </th>
  );
};

const formatDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime()) || dt.getTime() === 0) return "—";
  return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const MentorQuality = () => {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [internsCache, setInternsCache] = useState({});
  const [loadingInterns, setLoadingInterns] = useState({});
  const [sortState, setSortState] = useState({ key: "averageActivity", dir: "desc" });

  const fetchMentors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.mentors.getActivityList();
      setMentors(Array.isArray(list) ? list : []);
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
    if (internsCache[mentorId]) return;

    setLoadingInterns((prev) => ({ ...prev, [mentorId]: true }));
    try {
      const list = await api.mentors.getInternsActivity(mentorId);
      setInternsCache((prev) => ({ ...prev, [mentorId]: Array.isArray(list) ? list : [] }));
    } catch {
      setInternsCache((prev) => ({ ...prev, [mentorId]: null }));
    } finally {
      setLoadingInterns((prev) => ({ ...prev, [mentorId]: false }));
    }
  };

  const handleSort = (key) => {
    setSortState((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" }
    );
  };

  const sortedMentors = useMemo(() => {
    const arr = [...mentors];
    const { key, dir } = sortState;
    const mul = dir === "desc" ? -1 : 1;
    arr.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return mul * av.localeCompare(bv);
      return mul * (av - bv);
    });
    return arr;
  }, [mentors, sortState]);

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Менторы и активность интернов</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Кол-во интернов и их активность за последние 30 дней. Клик по строке — список интернов.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 mb-5 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <SortableHeader label="Ментор" sortKey="name" sortState={sortState} onSort={handleSort} />
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Филиал
              </th>
              <SortableHeader label="Интернов" sortKey="totalInterns" sortState={sortState} onSort={handleSort} />
              <SortableHeader label="Ср. активность (30 дн.)" sortKey="averageActivity" sortState={sortState} onSort={handleSort} />
              <SortableHeader label="Оценка качества" sortKey="qualityScore" sortState={sortState} onSort={handleSort} />
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Детали
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sortedMentors.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-12 text-center text-slate-400 text-sm">
                  Нет менторов для отображения
                </td>
              </tr>
            ) : (
              sortedMentors.map((mentor) => {
                const isExpanded = expandedId === mentor._id;
                const interns = internsCache[mentor._id];
                const isLoadingRow = loadingInterns[mentor._id];
                const score = mentor.qualityScore;
                const feedbackCount = mentor.qualityFeedbackCount;

                return (
                  <React.Fragment key={mentor._id}>
                    <tr
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(mentor._id)}
                    >
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
                            {mentor.role === "branchManager" && (
                              <span className="text-xs text-purple-600 font-medium">Менеджер филиала</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {mentor.branches?.map((b) => b.name || b).filter(Boolean).join(", ") || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <DistributionBadges
                          distribution={mentor.distribution}
                          total={mentor.totalInterns}
                        />
                      </td>

                      <td className="px-4 py-3">
                        {mentor.totalInterns > 0 ? (
                          <ActivityBar percent={mentor.averageActivity} />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {score !== null && score !== undefined ? (
                          <div className="flex items-center gap-2">
                            <StarRating score={score} />
                            <span className={`font-semibold text-sm ${qualityColor(score)}`}>
                              {score.toFixed(2)}
                            </span>
                            {feedbackCount > 0 && (
                              <span className="text-xs text-slate-400">({feedbackCount})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

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

                    {isExpanded && (
                      <tr>
                        <td colSpan="6" className="px-4 py-4 bg-slate-50 border-b border-slate-100">
                          {isLoadingRow ? (
                            <div className="flex justify-center py-6">
                              <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                            </div>
                          ) : interns === null ? (
                            <p className="text-slate-500 text-sm text-center py-2">
                              Не удалось загрузить интернов
                            </p>
                          ) : interns && interns.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-2">
                              У этого ментора нет интернов
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm bg-white rounded-xl border border-slate-100">
                                <thead>
                                  <tr className="bg-slate-100/60">
                                    <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase">Интерн</th>
                                    <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase">Грейд</th>
                                    <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase">Активность</th>
                                    <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase">План</th>
                                    <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase">Посещаем.</th>
                                    <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase">Фидбек</th>
                                    <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase">Уроки (подтв/всего)</th>
                                    <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase">Посл. урок</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {(interns || []).map((i) => {
                                    const meta = rangeMeta[i.activity.range];
                                    return (
                                      <tr key={i.internId}>
                                        <td className="px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            {i.profilePhoto ? (
                                              <img src={i.profilePhoto} alt="" className="w-7 h-7 rounded-full object-cover" />
                                            ) : (
                                              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-600">
                                                {i.name?.[0] ?? ""}
                                                {i.lastName?.[0] ?? ""}
                                              </div>
                                            )}
                                            <div>
                                              <p className="font-medium text-slate-900 leading-tight">
                                                {i.name} {i.lastName}
                                              </p>
                                              {i.sphere && (
                                                <p className="text-[11px] text-slate-400 leading-tight">{i.sphere}</p>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 text-xs">{i.grade || "—"}</td>
                                        <td className="px-3 py-2">
                                          <div className="flex items-center gap-2">
                                            <ActivityBar percent={i.activity.percent} />
                                            <span className={`text-[11px] font-medium ${meta.text}`}>
                                              {meta.label}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 tabular-nums">{i.activity.planCompletion}%</td>
                                        <td className="px-3 py-2 text-slate-600 tabular-nums">{i.activity.attendanceRate}%</td>
                                        <td className="px-3 py-2 text-slate-600 tabular-nums">{i.activity.feedbackRate}%</td>
                                        <td className="px-3 py-2 text-slate-600 tabular-nums">
                                          {i.activity.lessonsConfirmed30d}/{i.activity.lessonsTotal30d}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 text-xs">{formatDate(i.activity.lastLessonDate)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
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
