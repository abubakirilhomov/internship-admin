import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import { AlertCircle, ChevronDown, ChevronUp, Users, Clock } from "lucide-react";

const MentorDebt = () => {
    const [mentors, setMentors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedMentor, setExpandedMentor] = useState(null);
    const [debtDetails, setDebtDetails] = useState({});

    useEffect(() => {
        loadMentorDebt();
    }, []);

    const loadMentorDebt = async () => {
        try {
            setLoading(true);
            const data = await api.mentors.getAllDebt();
            setMentors(data);
        } catch (err) {
            console.error("Error loading mentor debt:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleDetails = async (mentorId) => {
        if (expandedMentor === mentorId) {
            setExpandedMentor(null);
            return;
        }

        setExpandedMentor(mentorId);

        // Load details if not already loaded
        if (!debtDetails[mentorId]) {
            try {
                const details = await api.mentors.getDebtDetails(mentorId);
                setDebtDetails((prev) => ({ ...prev, [mentorId]: details }));
            } catch (err) {
                console.error("Error loading debt details:", err);
            }
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-800">{error}</span>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-7 h-7 text-red-500" />
                    Долги менторов по фидбэкам
                </h1>
                <p className="text-gray-600 text-sm mt-1">
                    {mentors.length > 0
                        ? `${mentors.length} менторов с неоценёнными уроками`
                        : "Все менторы оценили свои уроки! 🎉"}
                </p>
            </div>

            {mentors.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Users className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Нет долгов!
                    </h3>
                    <p className="text-gray-600">
                        Все менторы оставили отзывы по своим урокам.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Ментор
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Долг
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Детали
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {mentors.map((mentor) => (
                                <React.Fragment key={mentor._id}>
                                    <tr className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                                                    <span className="text-red-700 font-semibold">
                                                        {mentor.name[0]}
                                                        {mentor.lastName?.[0] || ""}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {mentor.name} {mentor.lastName}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                                                <Clock className="w-4 h-4 mr-1" />
                                                {mentor.totalDebt} {mentor.totalDebt === 1 ? "урок" : "уроков"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => toggleDetails(mentor._id)}
                                                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                                            >
                                                {expandedMentor === mentor._id ? (
                                                    <>
                                                        Скрыть <ChevronUp className="ml-1 w-4 h-4" />
                                                    </>
                                                ) : (
                                                    <>
                                                        Показать <ChevronDown className="ml-1 w-4 h-4" />
                                                    </>
                                                )}
                                            </button>
                                        </td>
                                    </tr>

                                    {/* Expanded details row */}
                                    {expandedMentor === mentor._id && (
                                        <tr>
                                            <td colSpan="3" className="px-6 py-4 bg-gray-50">
                                                {!debtDetails[mentor._id] ? (
                                                    <div className="flex justify-center py-4">
                                                        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                                                    </div>
                                                ) : debtDetails[mentor._id].length === 0 ? (
                                                    <p className="text-gray-500 text-sm text-center py-4">
                                                        Нет данных
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                                            Неоценённые уроки:
                                                        </h4>
                                                        <div className="grid gap-2">
                                                            {debtDetails[mentor._id].map((lesson) => (
                                                                <div
                                                                    key={lesson.lessonId}
                                                                    className="bg-white rounded-lg p-3 border border-gray-200"
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                <span className="font-medium text-gray-900">
                                                                                    {lesson.intern.name} {lesson.intern.lastName}
                                                                                </span>
                                                                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                                                                    {lesson.intern.grade}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-sm text-gray-600">
                                                                                <span className="font-medium">Тема:</span> {lesson.topic}
                                                                            </div>
                                                                            <div className="text-sm text-gray-500 mt-1">
                                                                                {formatDate(lesson.date)} • {lesson.time} • {lesson.group}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default MentorDebt;
