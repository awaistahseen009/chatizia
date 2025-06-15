import React from 'react';
import { 
  Bot, 
  MessageSquare, 
  FileText, 
  TrendingUp, 
  Clock,
  Users,
  Zap,
  ArrowUp,
  ArrowDown,
  MoreVertical
} from 'lucide-react';
import { useChatbot } from '../contexts/ChatbotContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const Dashboard: React.FC = () => {
  const { chatbots, loading: chatbotsLoading } = useChatbot();
  const { analytics, loading: analyticsLoading } = useAnalytics();
  const { user } = useAuth();

  if (chatbotsLoading || analyticsLoading) {
    return <LoadingSpinner />;
  }

  const stats = [
    {
      title: 'Total Chatbots',
      value: chatbots.length,
      change: '+12%',
      trend: 'up',
      icon: Bot,
      color: 'blue'
    },
    {
      title: 'Messages This Month',
      value: analytics?.total_messages?.toLocaleString() || '0',
      change: '+23%',
      trend: 'up',
      icon: MessageSquare,
      color: 'green'
    },
    {
      title: 'Total Conversations',
      value: analytics?.total_conversations?.toLocaleString() || '0',
      change: '+8%',
      trend: 'up',
      icon: Users,
      color: 'purple'
    },
    {
      title: 'Avg Response Time',
      value: `${analytics?.avg_response_time || 0.9}s`,
      change: '-15%',
      trend: 'down',
      icon: Clock,
      color: 'orange'
    }
  ];

  const recentActivity = [
    { action: 'New chatbot created', item: 'Product Guide Bot', time: '2 hours ago', type: 'create' },
    { action: 'Document uploaded', item: 'API Documentation.pdf', time: '4 hours ago', type: 'upload' },
    { action: 'Bot configuration updated', item: 'Customer Support Bot', time: '6 hours ago', type: 'update' },
    { action: 'Analytics report generated', item: 'Monthly Performance', time: '1 day ago', type: 'report' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-600 mt-1">Welcome back, {user?.full_name}! Here's what's happening with your chatbots.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            Export Data
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Create Chatbot
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const colorClasses = {
            blue: 'bg-blue-50 text-blue-600',
            green: 'bg-green-50 text-green-600',
            purple: 'bg-purple-50 text-purple-600',
            orange: 'bg-orange-50 text-orange-600'
          };
          
          return (
            <div key={index} className="bg-white rounded-lg p-6 border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[stat.color as keyof typeof colorClasses]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className={`flex items-center text-sm ${
                  stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.trend === 'up' ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
                  {stat.change}
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-slate-800">{stat.value}</h3>
                <p className="text-slate-600 text-sm mt-1">{stat.title}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Chatbots */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">Active Chatbots</h2>
              <button className="text-slate-400 hover:text-slate-600">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="p-6">
            {chatbots.length > 0 ? (
              <div className="space-y-4">
                {chatbots.slice(0, 5).map((bot) => (
                  <div key={bot.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-medium"
                        style={{ backgroundColor: bot.configuration.primaryColor }}
                      >
                        {bot.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-800">{bot.name}</h3>
                        <p className="text-sm text-slate-600">{bot.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-800">{bot.conversations_count} conversations</p>
                        <p className="text-xs text-slate-500">Updated {new Date(bot.updated_at).toLocaleDateString()}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${
                        bot.status === 'active' ? 'bg-green-500' : 
                        bot.status === 'training' ? 'bg-yellow-500' : 'bg-slate-400'
                      }`}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No chatbots created yet</p>
                <button className="mt-2 text-blue-600 hover:text-blue-700">
                  Create your first chatbot
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-800">Recent Activity</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                    activity.type === 'create' ? 'bg-green-100 text-green-600' :
                    activity.type === 'upload' ? 'bg-blue-100 text-blue-600' :
                    activity.type === 'update' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    {activity.type === 'create' ? '+' : 
                     activity.type === 'upload' ? '↑' :
                     activity.type === 'update' ? '✓' : '📊'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800">{activity.action}</p>
                    <p className="text-sm font-medium text-slate-600 truncate">{activity.item}</p>
                    <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;