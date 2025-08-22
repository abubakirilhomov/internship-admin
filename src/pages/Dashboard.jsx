import React, { useState, useEffect } from 'react';
import { Users, Building2, UserCheck, TrendingUp } from 'lucide-react';
import { api } from '../utils/api';

const Dashboard = () => {
  const [stats, setStats] = useState({
    interns: 0,
    mentors: 0,
    branches: 0,
    totalRatings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [interns, mentors, branches] = await Promise.all([
          api.interns.getAll(),
          api.mentors.getAll(),
          api.branches.getAll(),
        ]);
        console.log(interns)
        setStats({
          interns: interns.length || 0,
          mentors: mentors.length || 0,
          branches: branches.length || 0,
          totalRatings: interns.reduce((acc, intern) => acc + (intern.rating || 0), 0),
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Интерны',
      value: stats.interns,
      icon: Users,
      color: 'bg-primary',
    },
    {
      title: 'Менторы',
      value: stats.mentors,
      icon: UserCheck,
      color: 'bg-secondary',
    },
    {
      title: 'Филиалы',
      value: stats.branches,
      icon: Building2,
      color: 'bg-accent',
    },
    {
      title: 'Общий рейтинг',
      value: Math.round(stats.totalRatings / stats.interns) || 0,
      icon: TrendingUp,
      color: 'bg-success',
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-base-content mb-2">Дашборд</h1>
        <p className="text-base-content opacity-70">
          Обзор системы управления обучением
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="stat bg-base-100 shadow rounded-box">
              <div className="stat-figure text-primary">
                <div className={`avatar placeholder ${stat.color} rounded-full p-3`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="stat-title">{stat.title}</div>
              <div className="stat-value text-primary">{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Недавняя активность</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="avatar placeholder">
                  <div className="bg-neutral text-neutral-content rounded-full w-8">
                    <span className="text-xs">И</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm">Новый интерн добавлен</p>
                  <p className="text-xs opacity-70">2 часа назад</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="avatar placeholder">
                  <div className="bg-primary text-primary-content rounded-full w-8">
                    <span className="text-xs">М</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm">Ментор обновил профиль</p>
                  <p className="text-xs opacity-70">5 часов назад</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Быстрые действия</h2>
            <div className="grid grid-cols-2 gap-4">
              <button className="btn btn-primary btn-sm">
                Добавить интерна
              </button>
              <button className="btn btn-secondary btn-sm">
                Добавить ментора
              </button>
              <button className="btn btn-accent btn-sm">
                Создать филиал
              </button>
              <button className="btn btn-info btn-sm">
                Посмотреть отчеты
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;