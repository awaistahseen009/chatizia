import React from 'react';
import { Sparkles } from 'lucide-react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-4 mx-auto animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-blue-200 rounded-xl animate-spin border-t-blue-600 mx-auto"></div>
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Loading...</h2>
        <p className="text-slate-600">Please wait while we load your dashboard</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;