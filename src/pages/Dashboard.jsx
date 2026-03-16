import React, { useState, useEffect } from 'react';
import { Users, Building2, UserCheck, AlertTriangle, BookOpen, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { api } from '../utils/api';

const GRADE_LABELS = {
  junior: 'Junior',
  strongJunior: 'Strong Junior',
  middle: 'Middle',
  strongMiddle: 'Strong Middle',
  senior: 'Senior',
};

const GRADE_COLORS = {
  junior: 'bg-green-100 text-green-700',
  strongJunior: 'bg-blue-100 text-blue-700',
  middle: 'bg-yellow-100 text-yellow-700',
  strongMiddle: 'bg-orange-100 text-orange-700',
  senior: 'bg-red-100 text-red-700',
};

const StatCard = ({ title, value, subtitle, icon: Icon, iconBg, valueColor }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <p className={`text-3xl font-bold ${valueColor || 'text-gray-900'}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg || 'bg-gray-100'}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [interns, setInterns] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [branches, setBranches] = useState([]);
  const [debtMentors, setDebtMentors] = useState([]);
  const [lessonStats, setLessonStats] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);

        // Calculate current month date range
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const [internsData, mentorsData, branchesData, debtData, statsData] = await Promise.allSettled([
          api.interns.getAll(),
          api.mentors.getAll(),
          api.branches.getAll(),
          api.mentors.getAllDebt(),
          api.lessons.getAttendanceStats({ startDate, endDate }),
        ]);

        if (internsData.status === 'fulfilled') setInterns(Array.isArray(internsData.value) ? internsData.value : []);
        if (mentorsData.status === 'fulfilled') setMentors(Array.isArray(mentorsData.value) ? mentorsData.value : []);
        if (branchesData.status === 'fulfilled') setBranches(Array.isArray(branchesData.value) ? branchesData.value : []);
        if (debtData.status === 'fulfilled') setDebtMentors(Array.isArray(debtData.value) ? debtData.value : []);
        if (statsData.status === 'fulfilled') setLessonStats(statsData.value);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError('Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-red-800">{error}</span>
        </div>
      </div>
    );
  }

  // Derived stats
  const activeInterns = interns.filter((i) => i.manualActivation?.isEnabled !== false);
  const inactiveInterns = interns.length - activeInterns.length;

  const gradeDistribution = Object.entries(
    interns.reduce((acc, intern) => {
      const g = intern.grade || 'unknown';
      acc[g] = (acc[g] || 0) + 1;
      return acc;
    }, {})
  ).sort(([a], [b]) => {
    const order = ['junior', 'strongJunior', 'middle', 'strongMiddle', 'senior'];
    return order.indexOf(a) - order.indexOf(b);
  });

  const totalDebtLessons = debtMentors.reduce((sum, m) => sum + (m.totalDebt || 0), 0);

  // Lesson stats from attendance endpoint — response shape: { stats: [...], grades }
  const confirmedLessons = lessonStats
    ? (lessonStats.stats || []).reduce((sum, item) => sum + (item.confirmedCount || 0), 0)
    : null;
  const pendingLessons = lessonStats
    ? (lessonStats.stats || []).reduce((sum, item) => sum + (item.pendingCount || 0), 0)
    : null;

  const currentMonthName = new Date().toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
        <p className="text-sm text-gray-500 mt-1">Обзор системы управления обучением</p>
      </div>

      {/* Main stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Всего интернов"
          value={interns.length}
          subtitle={`${activeInterns.length} активных · ${inactiveInterns} неактивных`}
          icon={Users}
          iconBg="bg-blue-100"
          valueColor="text-blue-700"
        />
        <StatCard
          title="Менторы"
          value={mentors.length}
          subtitle={`${mentors.filter((m) => m.role === 'admin').length} администраторов`}
          icon={UserCheck}
          iconBg="bg-purple-100"
          valueColor="text-purple-700"
        />
        <StatCard
          title="Филиалы"
          value={branches.length}
          icon={Building2}
          iconBg="bg-teal-100"
          valueColor="text-teal-700"
        />
        <StatCard
          title="Долг по фидбэкам"
          value={debtMentors.length}
          subtitle={`${totalDebtLessons} неоценённых уроков`}
          icon={AlertTriangle}
          iconBg="bg-red-100"
          valueColor={debtMentors.length > 0 ? 'text-red-600' : 'text-gray-900'}
        />
      </div>

      {/* Lessons this month */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-800">Уроки за {currentMonthName}</h2>
          </div>
          {lessonStats === null ? (
            <p className="text-sm text-gray-400">Нет данных</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-600">Подтверждённые</span>
                </div>
                <span className="text-lg font-bold text-green-600">{confirmedLessons ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-gray-600">Ожидают оценки</span>
                </div>
                <span className="text-lg font-bold text-yellow-600">{pendingLessons ?? '—'}</span>
              </div>
              {confirmedLessons !== null && pendingLessons !== null && confirmedLessons + pendingLessons > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Процент подтверждения</span>
                    <span>
                      {Math.round((confirmedLessons / (confirmedLessons + pendingLessons)) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.round((confirmedLessons / (confirmedLessons + pendingLessons)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grade distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-800">Распределение по грейдам</h2>
          </div>
          {gradeDistribution.length === 0 ? (
            <p className="text-sm text-gray-400">Нет данных</p>
          ) : (
            <div className="space-y-3">
              {gradeDistribution.map(([grade, count]) => {
                const pct = interns.length > 0 ? Math.round((count / interns.length) * 100) : 0;
                const colorClass = GRADE_COLORS[grade] || 'bg-gray-100 text-gray-700';
                const barColor =
                  grade === 'junior' ? 'bg-green-400' :
                  grade === 'strongJunior' ? 'bg-blue-400' :
                  grade === 'middle' ? 'bg-yellow-400' :
                  grade === 'strongMiddle' ? 'bg-orange-400' :
                  grade === 'senior' ? 'bg-red-400' : 'bg-gray-400';

                return (
                  <div key={grade}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
                        {GRADE_LABELS[grade] || grade}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">{count} <span className="text-xs text-gray-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`${barColor} h-1.5 rounded-full transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mentor debt table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${debtMentors.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
            <h2 className="text-base font-semibold text-gray-800">Менторы с долгом по фидбэкам</h2>
          </div>
          {debtMentors.length > 0 && (
            <span className="text-xs font-medium bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
              {debtMentors.length} ментор{debtMentors.length === 1 ? '' : 'ов'}
            </span>
          )}
        </div>

        {debtMentors.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full mx-auto mb-3 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-700">Долгов нет!</p>
            <p className="text-xs text-gray-400 mt-1">Все менторы оставили отзывы по урокам</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ментор</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Роль</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Долг</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {debtMentors.map((mentor) => (
                  <tr key={mentor._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-red-700">
                            {mentor.name?.[0]}{mentor.lastName?.[0] || ''}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {mentor.name} {mentor.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        mentor.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {mentor.role === 'admin' ? 'Администратор' : 'Ментор'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        <Clock className="w-3.5 h-3.5" />
                        {mentor.totalDebt} {mentor.totalDebt === 1 ? 'урок' : 'уроков'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
