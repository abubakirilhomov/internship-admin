import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Users, Building2, UserCheck, BarChart3, BarChart2, Home, LogOut,
  Scale, Clock, TrendingDown, Sliders, Settings, ListChecks, Award,
  AlertTriangle, Archive, Inbox,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const SECTIONS = [
  {
    title: 'Главное',
    items: [
      { name: 'Дашборд', href: '/dashboard', icon: Home },
    ],
  },
  {
    title: 'Сущности',
    items: [
      { name: 'Интерны', href: '/interns', icon: Users },
      { name: 'Менторы', href: '/mentors', icon: UserCheck },
      { name: 'Филиалы', href: '/branches', icon: Building2 },
    ],
  },
  {
    title: 'Аналитика',
    items: [
      { name: 'Рейтинг интернов', href: '/interns/rating', icon: BarChart3 },
      { name: 'Качество менторов', href: '/mentor-quality', icon: Award },
      { name: 'Посещаемость', href: '/attendance', icon: BarChart2 },
    ],
  },
  {
    title: 'Операции',
    items: [
      { name: 'Заявки', href: '/applications', icon: Inbox },
      { name: 'Долги менторов', href: '/mentor-debt', icon: Clock },
      { name: 'Низкая активность', href: '/interns/inactive', icon: TrendingDown },
      { name: 'Застрявшие фидбеки', href: '/stuck-feedbacks', icon: AlertTriangle },
      { name: 'Архив', href: '/interns/archive', icon: Archive },
    ],
  },
  {
    title: 'Настройки',
    items: [
      { name: 'Нарушения', href: '/rules', icon: Scale, alsoMatch: ['/violations'] },
      { name: 'Грейды', href: '/grade-config', icon: Sliders },
      { name: 'Критерии оценки', href: '/lesson-criteria', icon: ListChecks },
      { name: 'Настройки', href: '/settings', icon: Settings },
    ],
  },
];

const Sidebar = () => {
  const location = useLocation();
  const { logout, user } = useAuth();

  const isActive = (item) => {
    if (location.pathname === item.href) return true;
    return (item.alsoMatch || []).some((p) => location.pathname.startsWith(p));
  };

  return (
    <div className="drawer-side">
      <label htmlFor="my-drawer-2" className="drawer-overlay"></label>
      <aside className="w-64 min-h-full bg-base-200 text-base-content pb-20">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="avatar text-center placeholder">
              <div className="bg-primary text-primary-content rounded-full w-8">
                <span className="text-xs">{user?.name?.charAt(0)}</span>
              </div>
            </div>
            <div>
              <h2 className="font-bold text-lg">LMS Admin</h2>
              <p className="text-sm opacity-70">{user?.name}</p>
            </div>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase px-3 mb-1">
                {section.title}
              </p>
              <ul className="menu p-0 w-full">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                          active
                            ? 'bg-primary text-primary-content'
                            : 'hover:bg-base-300'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="absolute bottom-4 left-4 right-4">
            <button
              onClick={logout}
              className="btn btn-outline btn-error w-full gap-2"
            >
              <LogOut className="h-4 w-4" />
              Выйти
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default Sidebar;
