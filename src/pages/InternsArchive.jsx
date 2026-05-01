import React, { useEffect, useMemo, useState } from "react";
import { Archive, RotateCcw, Search } from "lucide-react";
import { api } from "../utils/api";

const reasonLabel = {
  promoted_to_tutor: "Повысился до тьютора",
  left: "Ушёл",
  other: "Другое",
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getFullName = (intern) =>
  `${intern?.name || ""} ${intern?.lastName || ""}`.trim() || "Без имени";

const InternsArchive = () => {
  const [interns, setInterns] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [restoringId, setRestoringId] = useState(null);

  const loadArchive = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.interns.getArchived();
      setInterns(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      setError(err.message || "Не удалось загрузить архив");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchive();
  }, []);

  const filteredInterns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return interns;
    return interns.filter((intern) => {
      const haystack = [
        getFullName(intern),
        intern.username,
        intern.grade,
        intern.archiveInfo?.note,
        reasonLabel[intern.archiveInfo?.reason],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [interns, query]);

  const handleUnarchive = async (intern) => {
    const confirmed = window.confirm(
      `Вернуть ${getFullName(intern)} в активные стажёры?`
    );
    if (!confirmed) return;

    setRestoringId(intern._id);
    setError("");
    try {
      await api.interns.unarchive(intern._id);
      setInterns((prev) => prev.filter((item) => item._id !== intern._id));
    } catch (err) {
      setError(err.message || "Не удалось разархивировать стажёра");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base-content flex items-center gap-2">
            <Archive className="w-6 h-6" />
            Архив стажёров
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            История сохраняется: уроки, фидбеки, повышения, бейджи и нарушения.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={loadArchive} disabled={loading}>
          Обновить
        </button>
      </div>

      <div className="bg-base-100 rounded-lg shadow-sm border border-base-300 p-3">
        <label className="input input-bordered flex items-center gap-2">
          <Search className="w-4 h-4 opacity-60" />
          <input
            type="search"
            className="grow"
            placeholder="Поиск по имени, username, причине"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="bg-base-100 rounded-lg shadow-sm border border-base-300 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-base-content/60">Загрузка архива...</div>
        ) : filteredInterns.length === 0 ? (
          <div className="p-8 text-center text-base-content/60">
            Архив пуст или ничего не найдено.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Стажёр</th>
                  <th>Грейд</th>
                  <th>Причина</th>
                  <th>Дата архивации</th>
                  <th>Данные</th>
                  <th className="text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredInterns.map((intern) => {
                  const archiveInfo = intern.archiveInfo || {};
                  const lessonsCount =
                    intern.lessonsVisited?.reduce((sum, item) => sum + (item.count || 0), 0) || 0;
                  const tutorName =
                    typeof archiveInfo.tutorMentorId === "object"
                      ? `${archiveInfo.tutorMentorId?.name || ""} ${archiveInfo.tutorMentorId?.lastName || ""}`.trim()
                      : archiveInfo.tutorMentorId;

                  return (
                    <tr key={intern._id}>
                      <td>
                        <div className="font-semibold">{getFullName(intern)}</div>
                        <div className="text-xs text-base-content/50">@{intern.username || "—"}</div>
                      </td>
                      <td>
                        <div className="badge badge-outline">
                          {archiveInfo.finalGrade || intern.grade || "—"}
                        </div>
                      </td>
                      <td>
                        <div>{reasonLabel[archiveInfo.reason] || "—"}</div>
                        {archiveInfo.becameTutor && (
                          <div className="text-xs text-success font-medium">
                            Будущий ментор: {tutorName || "ID не указан"}
                          </div>
                        )}
                        {archiveInfo.note && (
                          <div className="text-xs text-base-content/50 max-w-xs truncate">
                            {archiveInfo.note}
                          </div>
                        )}
                      </td>
                      <td>{formatDate(archiveInfo.archivedAt)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <span className="badge badge-ghost">{lessonsCount} уроков</span>
                          <span className="badge badge-ghost">
                            {intern.feedbacks?.length || 0} фидбеков
                          </span>
                          <span className="badge badge-ghost">
                            {intern.promotionHistory?.length || 0} повышений
                          </span>
                          <span className="badge badge-ghost">
                            {intern.badges?.length || 0} бейджей
                          </span>
                        </div>
                      </td>
                      <td className="text-right">
                        <button
                          className="btn btn-sm btn-outline gap-2"
                          onClick={() => handleUnarchive(intern)}
                          disabled={restoringId === intern._id}
                        >
                          <RotateCcw className="w-4 h-4" />
                          {restoringId === intern._id ? "..." : "Вернуть"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InternsArchive;
