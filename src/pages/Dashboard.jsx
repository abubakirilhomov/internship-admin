import React, { useState, useEffect } from 'react';
import { Users, Building2, UserCheck, AlertTriangle, BookOpen, CheckCircle, Clock, TrendingUp, Download } from 'lucide-react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { api } from '../utils/api';
import { authFetch } from '../utils/authFetch';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

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
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);

        // Calculate current month date range
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const [internsData, mentorsData, branchesData, debtData, statsData, analyticsData] = await Promise.allSettled([
          api.interns.getAll(),
          api.mentors.getAll(),
          api.branches.getAll(),
          api.mentors.getAllDebt(),
          api.lessons.getAttendanceStats({ startDate, endDate }),
          authFetch(`/dashboard/analytics`).then(r => r.ok ? r.json() : null),
        ]);

        if (internsData.status === 'fulfilled') setInterns(Array.isArray(internsData.value) ? internsData.value : []);
        if (mentorsData.status === 'fulfilled') setMentors(Array.isArray(mentorsData.value) ? mentorsData.value : []);
        if (branchesData.status === 'fulfilled') setBranches(Array.isArray(branchesData.value) ? branchesData.value : []);
        if (debtData.status === 'fulfilled') setDebtMentors(Array.isArray(debtData.value) ? debtData.value : []);
        if (statsData.status === 'fulfilled') setLessonStats(statsData.value);
        if (analyticsData.status === 'fulfilled' && analyticsData.value) setAnalytics(analyticsData.value);
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

      {/* ═══ ANALYTICS CHARTS ═══ */}
      {analytics && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Lesson Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">Уроки по месяцам</h3>
              <Bar
                data={{
                  labels: analytics.monthlyTrend.map(m => {
                    const [y, mo] = m.month.split('-');
                    return new Date(y, mo - 1).toLocaleString('ru-RU', { month: 'short' });
                  }),
                  datasets: [
                    {
                      label: 'Подтверждённые',
                      data: analytics.monthlyTrend.map(m => m.confirmed),
                      backgroundColor: 'rgba(34, 197, 94, 0.7)',
                      borderRadius: 6,
                    },
                    {
                      label: 'Ожидающие',
                      data: analytics.monthlyTrend.map(m => m.pending),
                      backgroundColor: 'rgba(234, 179, 8, 0.7)',
                      borderRadius: 6,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'bottom' } },
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>

            {/* Grade Distribution Pie */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">Распределение грейдов</h3>
              <div className="max-w-[280px] mx-auto">
                <Doughnut
                  data={{
                    labels: analytics.gradeDistribution.map(g => GRADE_LABELS[g._id] || g._id),
                    datasets: [{
                      data: analytics.gradeDistribution.map(g => g.count),
                      backgroundColor: ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#ef4444'],
                      borderWidth: 2,
                      borderColor: '#fff',
                    }],
                  }}
                  options={{ plugins: { legend: { position: 'bottom' } } }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Branch Comparison */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">Филиалы — сравнение</h3>
              <Bar
                data={{
                  labels: analytics.branchStats.map(b => b._id),
                  datasets: [
                    {
                      label: 'Средний балл',
                      data: analytics.branchStats.map(b => b.avgScore?.toFixed(1) || 0),
                      backgroundColor: 'rgba(99, 102, 241, 0.7)',
                      borderRadius: 6,
                      yAxisID: 'y',
                    },
                    {
                      label: 'Количество',
                      data: analytics.branchStats.map(b => b.internCount),
                      backgroundColor: 'rgba(168, 85, 247, 0.4)',
                      borderRadius: 6,
                      yAxisID: 'y1',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { position: 'bottom' } },
                  scales: {
                    y: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'Балл' } },
                    y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'Кол-во' } },
                  },
                }}
              />
            </div>

            {/* Violation Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">Нарушения по месяцам</h3>
              {analytics.violationTrend.length > 0 ? (
                <Line
                  data={{
                    labels: analytics.violationTrend.map(v => {
                      const [y, mo] = v.month.split('-');
                      return new Date(y, mo - 1).toLocaleString('ru-RU', { month: 'short' });
                    }),
                    datasets: [{
                      label: 'Нарушения',
                      data: analytics.violationTrend.map(v => v.count),
                      borderColor: '#ef4444',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      fill: true,
                      tension: 0.4,
                    }],
                  }}
                  options={{
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } },
                  }}
                />
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">Нет данных о нарушениях</p>
              )}
            </div>
          </div>

          {/* Top Interns + Export */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">Топ-5 интернов</h3>
              <div className="space-y-3">
                {(analytics.topInterns || []).map((intern, i) => (
                  <div key={intern._id} className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400 w-6">#{i + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {intern.profilePhoto
                        ? <img src={intern.profilePhoto} alt="" className="w-full h-full object-cover" />
                        : <span className="text-xs font-bold">{intern.name?.[0]}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate block">{intern.name} {intern.lastName}</span>
                      <span className="text-xs text-gray-400">{GRADE_LABELS[intern.grade] || intern.grade}</span>
                    </div>
                    <span className="text-sm font-bold text-yellow-600">⭐ {intern.score?.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Export */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-center items-center gap-4">
              <Download className="w-12 h-12 text-gray-300" />
              <h3 className="text-base font-semibold text-gray-800">Экспорт данных</h3>
              <p className="text-xs text-gray-400 text-center">Выгрузите данные по интернам, урокам и нарушениям в Excel</p>
              <button
                className="btn btn-primary btn-sm gap-2"
                onClick={() => {
                  const rows = interns.map(i => ({
                    Имя: i.name,
                    Фамилия: i.lastName,
                    Username: i.username,
                    Грейд: i.grade,
                    Балл: i.score?.toFixed(1) || '0',
                    Уроков: (i.lessonsVisited || []).reduce((s, l) => s + (l.count || 0), 0),
                    Нарушений: (i.violations || []).length,
                  }));
                  const header = Object.keys(rows[0] || {}).join(',');
                  const csv = [header, ...rows.map(r => Object.values(r).join(','))].join('\n');
                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `interns-export-${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="w-4 h-4" />
                Скачать CSV
              </button>
            </div>
          </div>
        </>
      )}

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
                          {mentor?.name} {mentor?.lastName}
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
