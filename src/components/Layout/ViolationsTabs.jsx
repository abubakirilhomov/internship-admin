import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Scale, BookOpen } from "lucide-react";

const TABS = [
  { label: "Правила", href: "/rules", icon: BookOpen },
  { label: "Журнал нарушений", href: "/violations", icon: Scale },
];

const ViolationsTabs = () => {
  const { pathname } = useLocation();
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 mb-4">
      {TABS.map(({ label, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            to={href}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
};

export default ViolationsTabs;
