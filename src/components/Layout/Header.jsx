import React from 'react';
import { Menu, Bell, Settings } from 'lucide-react';

const Header = () => {
  return (
    <div className="navbar bg-base-100 shadow-lg">
      <div className="flex-1">
        <label
          htmlFor="my-drawer-2"
          className="btn btn-square btn-ghost lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </label>
        <h1 className="text-xl font-bold ml-2">Административная панель</h1>
      </div>

      <div className="flex-none gap-2">
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
            <div className="indicator">
              <Bell className="h-5 w-5" />
              <span className="badge badge-xs badge-primary indicator-item"></span>
            </div>
          </div>
          <div
            tabIndex={0}
            className="mt-3 z-[1] card card-compact dropdown-content w-52 bg-base-100 shadow"
          >
            <div className="card-body">
              <span className="font-bold text-lg">Уведомления</span>
              <span className="text-info">У вас нет новых уведомлений</span>
            </div>
          </div>
        </div>

        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
            <Settings className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;