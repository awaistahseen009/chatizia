import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Bot, 
  FileText, 
  BarChart3, 
  Settings, 
  CreditCard,
  Menu,
  Sparkles,
  Users
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/chatbots', icon: Bot, label: 'Chatbots' },
    { path: '/agents', icon: Users, label: 'Agents' },
    { path: '/documents', icon: FileText, label: 'Documents' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/settings', icon: Settings, label: 'Settings' },
    { path: '/billing', icon: CreditCard, label: 'Billing' },
  ];

  return (
    <div className={`fixed left-0 top-0 h-full bg-white border-r border-slate-200 transition-all duration-300 z-30 ${
      collapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-800">ChatBot Pro</h1>
            </div>
          )}
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      <nav className="mt-8">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-4 py-3 mx-2 rounded-lg transition-all duration-200 group ${
                isActive 
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 ${collapsed ? 'mx-auto' : 'mr-3'} ${
                isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'
              }`} />
              {!collapsed && (
                <span className="font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 text-white">
            <h3 className="font-semibold text-sm">Upgrade to Pro</h3>
            <p className="text-xs text-blue-100 mt-1">Unlock unlimited chatbots and advanced features</p>
            <button className="mt-3 w-full bg-white/20 hover:bg-white/30 rounded-md py-2 text-sm font-medium transition-colors">
              Upgrade Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;