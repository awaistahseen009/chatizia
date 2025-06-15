import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, AlertCircle, Mail, Loader } from 'lucide-react';
import { useAgents } from '../hooks/useAgents';
import { useAgent } from '../contexts/AgentContext';
import AuthLayout from '../components/auth/AuthLayout';

const AgentLogin: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { authenticateAgent } = useAgents();
  const { setCurrentAgent } = useAgent();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email.trim() || !formData.password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🚀 Attempting agent login...');
      console.log('📧 Email:', formData.email);
      console.log('🔑 Password length:', formData.password.length);
      
      const agent = await authenticateAgent(formData.email.trim(), formData.password.trim());
      
      console.log('✅ Authentication successful, setting current agent...');
      setCurrentAgent(agent);
      
      // Store session in multiple places for cross-browser/tab persistence
      const sessionData = JSON.stringify({
        agentId: agent.id,
        email: agent.email,
        name: agent.name,
        agent_id: agent.agent_id,
        user_id: agent.user_id,
        password: agent.password,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
        timestamp: Date.now()
      });
      
      // Store in localStorage (persistent across browser restarts)
      localStorage.setItem('agent_session', sessionData);
      
      // Store in sessionStorage (session-based)
      sessionStorage.setItem('agent_session', sessionData);
      
      // Store in cookies (cross-tab and cross-domain)
      const expiryDate = new Date();
      expiryDate.setTime(expiryDate.getTime() + (24 * 60 * 60 * 1000)); // 24 hours
      
      // Set cookie for current domain
      document.cookie = `agent_session=${encodeURIComponent(sessionData)}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;
      
      // Also set for parent domain if on subdomain
      const hostname = window.location.hostname;
      if (hostname.includes('.') && hostname !== 'localhost') {
        const parentDomain = hostname.split('.').slice(-2).join('.');
        document.cookie = `agent_session=${encodeURIComponent(sessionData)}; expires=${expiryDate.toUTCString()}; path=/; domain=.${parentDomain}; SameSite=Lax`;
      }

      console.log('✅ Agent login successful, redirecting to dashboard');
      navigate('/agent-dashboard');
    } catch (err) {
      console.error('❌ Agent login failed:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  return (
    <AuthLayout
      title="Agent Portal"
      subtitle="Sign in to handle customer conversations"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors ${
                error ? 'border-red-300 bg-red-50' : 'border-slate-300'
              }`}
              placeholder="Enter your email address"
              disabled={loading}
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Password
          </label>
          <div className="relative">
            <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors ${
                error ? 'border-red-300 bg-red-50' : 'border-slate-300'
              }`}
              placeholder="Enter your password"
              disabled={loading}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              disabled={loading}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !formData.email.trim() || !formData.password.trim()}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          {loading && <Loader className="w-4 h-4 animate-spin" />}
          <span>{loading ? 'Signing In...' : 'Sign In as Agent'}</span>
        </button>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800">Agent Portal</h4>
              <p className="text-sm text-blue-700 mt-1">
                This portal is for human agents to handle escalated customer conversations. 
                Use the email and password provided by your organization administrator.
              </p>
            </div>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
};

export default AgentLogin;