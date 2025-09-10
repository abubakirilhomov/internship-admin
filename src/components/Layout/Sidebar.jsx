import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, Building2, UserCheck, BarChart3, Home, LogOut, Scale } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  const { logout, user } = useAuth();

  const navigation = [
    { name: 'Дашборд', href: '/dashboard', icon: Home },
    { name: 'Интерны', href: '/interns', icon: Users },
    { name: 'Менторы', href: '/mentors', icon: UserCheck },
    { name: 'Филиалы', href: '/branches', icon: Building2 },
    { name: 'Рейтинг Интернов', href: '/interns/rating', icon: BarChart3 },
    { name: 'Правила и нарушения', href: '/rules', icon: Scale },
  ];

  return (
    <div className="drawer-side">
      <label htmlFor="my-drawer-2" className="drawer-overlay"></label>
      <aside className="w-64 min-h-full bg-base-200 text-base-content">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-8">
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

          <ul className="menu p-0 w-full">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                      isActive 
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