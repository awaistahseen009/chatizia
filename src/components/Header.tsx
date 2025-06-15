import React from 'react';
import { Bell, Search, User, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Header: React.FC = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search chatbots, documents..."
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-96"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <Bell className="w-5 h-5 text-slate-600" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user?.full_name || 'User'}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.subscription_status || 'Free'} Plan</p>
            </div>
            <div className="relative group">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center cursor-pointer">
                <User className="w-4 h-4 text-white" />
              </div>
              
              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="p-3 border-b border-slate-200">
                  <p className="font-medium text-slate-800">{user?.full_name}</p>
                  <p className="text-sm text-slate-600">{user?.email}</p>
                </div>
                <div className="p-2">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;