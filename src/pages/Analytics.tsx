import React, { useState } from 'react';
import { 
  TrendingUp, 
  MessageSquare, 
  Users, 
  Clock, 
  Calendar,
  BarChart3,
  PieChart,
  Globe,
  Download
} from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';
import { useChatbot } from '../contexts/ChatbotContext';
import LoadingSpinner from '../components/LoadingSpinner';

const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedChatbot, setSelectedChatbot] = useState('all');
  const { analytics, loading } = useAnalytics();
  const { chatbots } = useChatbot();

  if (loading) {
    return <LoadingSpinner />;
  }

  const stats = [
    {
      title: 'Total Conversations',
      value: analytics?.total_conversations?.toLocaleString() || '0',
      change: '+12.5%',
      trend: 'up',
      icon: MessageSquare,
      color: 'blue'
    },
    {
      title: 'Unique Users',
      value: analytics?.unique_users?.toLocaleString() || '0',
      change: '+8.2%',
      trend: 'up',
      icon: Users,
      color: 'green'
    },
    {
      title: 'Avg Response Time',
      value: `${analytics?.avg_response_time || 0.9}s`,
      change: '-5.3%',
      trend: 'down',
      icon: Clock,
      color: 'purple'
    },
    {
      title: 'Messages Today',
      value: analytics?.messages_today?.toLocaleString() || '0',
      change: '+3.1%',
      trend: 'up',
      icon: TrendingUp,
      color: 'orange'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Analytics</h1>
          <p className="text-slate-600 mt-1">Insights and performance metrics for your chatbots</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedChatbot}
            onChange={(e) => setSelectedChatbot(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="all">All Chatbots</option>
            {chatbots.map((bot) => (
              <option key={bot.id} value={bot.id}>{bot.name}</option>
            ))}
          </select>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Download className="w-4 h-4" />
            <span>Export</span>
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
            <div key={index} className="bg-white rounded-lg p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[stat.color as keyof typeof colorClasses]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className={`text-sm font-medium ${
                  stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change}
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-1">{stat.value}</h3>
              <p className="text-slate-600 text-sm">{stat.title}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversation Trends */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Conversation Trends</h2>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          <div className="h-64 flex items-end justify-between space-x-2">
            {[65, 78, 90, 81, 95, 88, 102].map((height, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-blue-600 rounded-t-sm transition-all hover:bg-blue-700"
                  style={{ height: `${(height / 102) * 100}%` }}
                ></div>
                <span className="text-xs text-slate-500 mt-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Questions */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Most Asked Questions</h2>
            <MessageSquare className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-4">
            {analytics?.top_questions?.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{item.question}</p>
                  <div className="flex items-center mt-1">
                    <div className="w-full bg-slate-200 rounded-full h-2 mr-3">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${(item.count / (analytics.top_questions[0]?.count || 1)) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {item.count}
                    </span>
                  </div>
                </div>
              </div>
            )) || (
              <div className="text-center py-8">
                <p className="text-slate-500">No data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Geographic Distribution */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Geographic Distribution</h2>
            <Globe className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-4">
            {analytics?.geographic_data?.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-slate-600">
                      {item.country.split(' ').map(word => word[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <span className="font-medium text-slate-800">{item.country}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-24 bg-slate-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${(item.users / (analytics.geographic_data[0]?.users || 1)) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-slate-600 w-16 text-right">
                    {item.users}
                  </span>
                </div>
              </div>
            )) || (
              <div className="text-center py-8">
                <p className="text-slate-500">No geographic data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Response Time Distribution */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Response Times</h2>
            <Clock className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-32 h-32 mx-auto mb-4 relative">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-200"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="text-blue-600"
                    strokeDasharray="87, 100"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-800">87%</span>
                </div>
              </div>
              <p className="text-sm text-slate-600">Under 1 second</p>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">&lt; 1s</span>
                <span className="text-sm font-medium text-slate-800">87%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">1-2s</span>
                <span className="text-sm font-medium text-slate-800">9%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">2-5s</span>
                <span className="text-sm font-medium text-slate-800">3%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">&gt; 5s</span>
                <span className="text-sm font-medium text-slate-800">1%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;