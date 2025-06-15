import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Play, 
  Pause, 
  Copy, 
  Settings as SettingsIcon, 
  Trash2,
  ExternalLink,
  MessageSquare,
  Brain,
  Edit
} from 'lucide-react';
import { useChatbot } from '../contexts/ChatbotContext';
import CreateChatbotModal from '../components/CreateChatbotModal';
import EmbedCodeModal from '../components/EmbedCodeModal';
import ChatbotPreview from '../components/ChatbotPreview';
import LoadingSpinner from '../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const Chatbots: React.FC = () => {
  const { chatbots, setSelectedBot, loading, error, deleteChatbot, updateChatbot } = useChatbot();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [selectedBotForEmbed, setSelectedBotForEmbed] = useState<any>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const navigate = useNavigate();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading chatbots: {error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filteredChatbots = chatbots.filter(bot => {
    const matchesSearch = bot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bot.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || bot.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleShowEmbed = (bot: any) => {
    setSelectedBotForEmbed(bot);
    setShowEmbedModal(true);
    setShowDropdown(null);
  };

  const handleDemoBot = (bot: any) => {
    setSelectedBot(bot);
    setPreviewVisible(true);
  };

  const handleConfigureBot = (bot: any) => {
    setSelectedBot(bot);
    setShowDropdown(null);
    // Navigate to settings page
    navigate('/settings');
  };

  const handleToggleStatus = async (bot: any) => {
    try {
      const newStatus = bot.status === 'active' ? 'inactive' : 'active';
      await updateChatbot(bot.id, { status: newStatus });
      setShowDropdown(null);
    } catch (err) {
      alert('Failed to update chatbot status');
    }
  };

  const handleDeleteBot = async (bot: any) => {
    if (confirm(`Are you sure you want to delete "${bot.name}"? This action cannot be undone.`)) {
      try {
        await deleteChatbot(bot.id);
        setShowDropdown(null);
      } catch (err) {
        alert('Failed to delete chatbot');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Chatbots</h1>
          <p className="text-slate-600 mt-1">Manage and configure your AI chatbots</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Chatbot</span>
        </button>
      </div>

      {/* Demo Instructions */}
      {filteredChatbots.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-medium text-blue-800">Try Your Chatbots</h3>
              <p className="text-sm text-blue-700">
                Click the "Demo Chatbot" button on any chatbot to test it in real-time with voice and text capabilities.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search chatbots..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="training">Training</option>
        </select>
      </div>

      {/* Chatbots Grid */}
      {filteredChatbots.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredChatbots.map((bot) => (
            <div key={bot.id} className="bg-white rounded-lg border border-slate-200 hover:shadow-lg transition-all duration-200 group">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-semibold text-lg overflow-hidden"
                      style={{ backgroundColor: bot.configuration?.useCustomImage ? 'transparent' : (bot.configuration?.primaryColor || '#2563eb') }}
                    >
                      {bot.configuration?.useCustomImage && bot.configuration?.botImage ? (
                        <img 
                          src={bot.configuration.botImage} 
                          alt={bot.name}
                          className="w-full h-full object-cover rounded-lg"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.style.backgroundColor = bot.configuration?.primaryColor || '#2563eb';
                            target.parentElement!.textContent = bot.name.charAt(0);
                          }}
                        />
                      ) : (
                        bot.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">{bot.name}</h3>
                      {bot.knowledge_base_id && (
                        <div className="flex items-center space-x-1 mt-1">
                          <Brain className="w-3 h-3 text-purple-500" />
                          <span className="text-xs text-purple-600">Knowledge Base</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <button 
                      onClick={() => setShowDropdown(showDropdown === bot.id ? null : bot.id)}
                      className="p-1 rounded hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {showDropdown === bot.id && (
                      <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-10">
                        <div className="py-1">
                          <button
                            onClick={() => handleConfigureBot(bot)}
                            className="w-full flex items-center space-x-2 px-4 py-2 text-left text-slate-700 hover:bg-slate-50"
                          >
                            <SettingsIcon className="w-4 h-4" />
                            <span>Configure</span>
                          </button>
                          <button
                            onClick={() => handleShowEmbed(bot)}
                            className="w-full flex items-center space-x-2 px-4 py-2 text-left text-slate-700 hover:bg-slate-50"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Embed & Security</span>
                          </button>
                          <button
                            onClick={() => handleToggleStatus(bot)}
                            className="w-full flex items-center space-x-2 px-4 py-2 text-left text-slate-700 hover:bg-slate-50"
                          >
                            {bot.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            <span>{bot.status === 'active' ? 'Pause' : 'Activate'}</span>
                          </button>
                          <hr className="my-1" />
                          <button
                            onClick={() => handleDeleteBot(bot)}
                            className="w-full flex items-center space-x-2 px-4 py-2 text-left text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-slate-600 text-sm mb-4 line-clamp-2">{bot.description || 'No description'}</p>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      bot.status === 'active' ? 'bg-green-500' : 
                      bot.status === 'training' ? 'bg-yellow-500' : 'bg-slate-400'
                    }`}></div>
                    <span className={`text-xs font-medium capitalize ${
                      bot.status === 'active' ? 'text-green-600' : 
                      bot.status === 'training' ? 'text-yellow-600' : 'text-slate-500'
                    }`}>
                      {bot.status}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(bot.updated_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-xs text-slate-500">Conversations</p>
                    <p className="text-sm font-semibold text-slate-800">{bot.conversations_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Response Time</p>
                    <p className="text-sm font-semibold text-slate-800">{bot.response_time || '0.8s'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* Primary Demo Button */}
                  <button 
                    onClick={() => handleDemoBot(bot)}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Demo Chatbot</span>
                  </button>

                  {/* Secondary Actions */}
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => handleConfigureBot(bot)}
                      className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                    >
                      <Edit className="w-3 h-3" />
                      <span>Configure</span>
                    </button>
                    <button 
                      onClick={() => handleShowEmbed(bot)}
                      className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-md transition-colors"
                      title="Embed & Security"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-2">No chatbots found</h3>
          <p className="text-slate-500 mb-4">
            {searchTerm || filterStatus !== 'all' 
              ? 'No chatbots match your search criteria.' 
              : 'Get started by creating your first chatbot.'
            }
          </p>
          {!searchTerm && filterStatus === 'all' && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Chatbot
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateChatbotModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />
      <EmbedCodeModal 
        isOpen={showEmbedModal} 
        onClose={() => setShowEmbedModal(false)}
        chatbot={selectedBotForEmbed}
      />

      {/* Chatbot Preview */}
      <ChatbotPreview 
        visible={previewVisible} 
        onClose={() => setPreviewVisible(false)} 
      />

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setShowDropdown(null)}
        />
      )}
    </div>
  );
};

export default Chatbots;