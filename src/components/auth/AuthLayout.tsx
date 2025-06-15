import React from 'react';
import { Sparkles } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">ChatBot Pro</h1>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">{title}</h2>
          <p className="text-slate-600">{subtitle}</p>
        </div>

        {/* Auth Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          {children}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-slate-500">
            © 2024 ChatBot Pro. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;