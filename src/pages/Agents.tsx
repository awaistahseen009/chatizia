import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Users, 
  UserCheck, 
  Trash2, 
  Eye, 
  EyeOff,
  Copy,
  Check,
  AlertCircle,
  Bot,
  Shield,
  UserPlus,
  Settings,
  Mail,
  Loader
} from 'lucide-react';
import { useAgents } from '../hooks/useAgents';
import { useChatbot } from '../contexts/ChatbotContext';
import { useAgent } from '../contexts/AgentContext';
import LoadingSpinner from '../components/LoadingSpinner';

const Agents: React.FC = () => {
  const { agents, assignments, loading, error, createAgent, deleteAgent, assignAgentToChatbot, removeAgentAssignment, authenticateAgent } = useAgents();
  const { chatbots } = useChatbot();
  const { setCurrentAgent } = useAgent();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCredentials, setShowCredentials] = useState<Record<string, boolean>>({});
  const [copiedCredential, setCopiedCredential] = useState<string | null>(null);
  const [createdAgent, setCreatedAgent] = useState<any>(null);
  const [deletingAgent, setDeletingAgent] = useState<string | null>(null);
  const [autoLoginAgent, setAutoLoginAgent] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    useCustomCredentials: false,
    agentId: '',
    password: ''
  });

  const [assignForm, setAssignForm] = useState({
    chatbotId: ''
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.agent_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await createAgent({
        name: createForm.name,
        email: createForm.email,
        ...(createForm.useCustomCredentials && {
          agentId: createForm.agentId,
          password: createForm.password
        })
      });

      // Auto-login the new agent if checkbox is checked
      if (autoLoginAgent) {
        try {
          console.log('🔄 Auto-logging in new agent...');
          const authenticatedAgent = await authenticateAgent(createForm.email, result.credentials.password);
          setCurrentAgent(authenticatedAgent);
          console.log('✅ Agent auto-login successful');
        } catch (loginError) {
          console.error('❌ Agent auto-login failed:', loginError);
          // Don't throw error, just show the credentials modal
        }
      }

      setCreatedAgent(result);
      setCreateForm({
        name: '',
        email: '',
        useCustomCredentials: false,
        agentId: '',
        password: ''
      });
      setAutoLoginAgent(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create agent');
    }
  };

  const handleDeleteAgent = async (agentId: string, agentName: string) => {
    if (!confirm(`Are you sure you want to delete agent "${agentName}"? This action cannot be undone and will remove all assignments.`)) {
      return;
    }

    setDeletingAgent(agentId);
    try {
      console.log('🗑️ Starting agent deletion process for:', agentId);
      await deleteAgent(agentId);
      console.log('✅ Agent deleted successfully');
    } catch (err) {
      console.error('❌ Failed to delete agent:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete agent');
    } finally {
      setDeletingAgent(null);
    }
  };

  const handleAssignAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAgent || !assignForm.chatbotId) return;

    try {
      await assignAgentToChatbot(selectedAgent, assignForm.chatbotId);
      setShowAssignModal(false);
      setSelectedAgent(null);
      setAssignForm({ chatbotId: '' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to assign agent');
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (confirm('Are you sure you want to remove this assignment?')) {
      try {
        await removeAgentAssignment(assignmentId);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to remove assignment');
      }
    }
  };

  const toggleCredentialVisibility = (agentId: string) => {
    setShowCredentials(prev => ({
      ...prev,
      [agentId]: !prev[agentId]
    }));
  };

  const copyCredential = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCredential(`${type}-${text}`);
    setTimeout(() => setCopiedCredential(null), 2000);
  };

  const getAgentAssignments = (agentId: string) => {
    return assignments.filter(assignment => assignment.agent_id === agentId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Human Agents</h1>
          <p className="text-slate-600 mt-1">Manage human agents for customer support escalation</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create Agent</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Agents</p>
              <p className="text-2xl font-bold text-slate-800">{agents.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Active Assignments</p>
              <p className="text-2xl font-bold text-slate-800">{assignments.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Covered Chatbots</p>
              <p className="text-2xl font-bold text-slate-800">
                {new Set(assignments.map(a => a.chatbot_id)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full"
          />
        </div>
      </div>

      {/* Agents List */}
      {filteredAgents.length > 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-slate-600">
              <div className="col-span-3">Agent Details</div>
              <div className="col-span-3">Login Credentials</div>
              <div className="col-span-3">Assignments</div>
              <div className="col-span-2">Created</div>
              <div className="col-span-1">Actions</div>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {filteredAgents.map((agent) => {
              const agentAssignments = getAgentAssignments(agent.id);
              const isDeleting = deletingAgent === agent.id;
              
              return (
                <div key={agent.id} className={`px-6 py-4 hover:bg-slate-50 transition-colors ${isDeleting ? 'opacity-50' : ''}`}>
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-800">{agent.name}</h3>
                          <p className="text-sm text-slate-600">{agent.email}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-span-3">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-500 w-16">Email:</span>
                          <div className="flex items-center space-x-1">
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">
                              {agent.email}
                            </code>
                            <button
                              onClick={() => copyCredential(agent.email, 'email')}
                              className="p-1 hover:bg-slate-200 rounded"
                              disabled={isDeleting}
                            >
                              {copiedCredential === `email-${agent.email}` ? 
                                <Check className="w-3 h-3 text-green-600" /> : 
                                <Copy className="w-3 h-3" />
                              }
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-500 w-16">Password:</span>
                          <div className="flex items-center space-x-1">
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">
                              {showCredentials[agent.id] ? agent.password : '••••••••••••••••'}
                            </code>
                            <button
                              onClick={() => toggleCredentialVisibility(agent.id)}
                              className="p-1 hover:bg-slate-200 rounded"
                              disabled={isDeleting}
                            >
                              {showCredentials[agent.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            <button
                              onClick={() => copyCredential(agent.password, 'password')}
                              className="p-1 hover:bg-slate-200 rounded"
                              disabled={isDeleting}
                            >
                              {copiedCredential === `password-${agent.password}` ? 
                                <Check className="w-3 h-3 text-green-600" /> : 
                                <Copy className="w-3 h-3" />
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-span-3">
                      {agentAssignments.length > 0 ? (
                        <div className="space-y-1">
                          {agentAssignments.slice(0, 2).map((assignment) => (
                            <div key={assignment.id} className="flex items-center justify-between">
                              <span className="text-sm text-slate-700">
                                {assignment.chatbot?.name || 'Unknown Chatbot'}
                              </span>
                              <button
                                onClick={() => handleRemoveAssignment(assignment.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Remove assignment"
                                disabled={isDeleting}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {agentAssignments.length > 2 && (
                            <p className="text-xs text-slate-500">
                              +{agentAssignments.length - 2} more
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">No assignments</span>
                      )}
                    </div>
                    
                    <div className="col-span-2">
                      <span className="text-sm text-slate-600">
                        {new Date(agent.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="col-span-1">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setSelectedAgent(agent.id);
                            setShowAssignModal(true);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Assign to chatbot"
                          disabled={isDeleting}
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAgent(agent.id, agent.name)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete agent"
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-800 mb-2">No agents found</h3>
          <p className="text-slate-500 mb-4">
            {searchTerm ? 'No agents match your search criteria.' : 'Create your first human agent to handle customer escalations.'}
          </p>
          {!searchTerm && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Agent
            </button>
          )}
        </div>
      )}

      {/* Create Agent Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800">Create New Agent</h2>
            </div>
            
            <form onSubmit={handleCreateAgent} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Agent Name *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g., Customer Support Agent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email Address * <span className="text-xs text-slate-500">(used for login)</span>
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={createForm.useCustomCredentials}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, useCustomCredentials: e.target.checked }))}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-slate-700">Use custom password</span>
                </label>
              </div>

              {createForm.useCustomCredentials && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Password
                  </label>
                  <input
                    type="text"
                    value={createForm.password}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Custom password"
                  />
                </div>
              )}

              {!createForm.useCustomCredentials && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-700">
                      Secure password will be auto-generated
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={autoLoginAgent}
                    onChange={(e) => setAutoLoginAgent(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-slate-700">Auto-login agent after creation</span>
                </label>
                <p className="text-xs text-slate-500 mt-1 ml-6">
                  Automatically log in the new agent in this browser session
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <Mail className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-700">
                    <p className="font-medium">Login Instructions:</p>
                    <p>The agent will use their <strong>email address</strong> and the generated/custom password to log in at <code>/agent-login</code></p>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateForm({
                      name: '',
                      email: '',
                      useCustomCredentials: false,
                      agentId: '',
                      password: ''
                    });
                    setAutoLoginAgent(false);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent Created Success Modal */}
      {createdAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-green-800">Agent Created Successfully!</h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800">
                    {createdAgent.agent.name} has been created
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-1">
                      Login Email
                    </label>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 text-sm bg-white px-3 py-2 rounded border font-mono">
                        {createdAgent.agent.email}
                      </code>
                      <button
                        onClick={() => copyCredential(createdAgent.agent.email, 'new-email')}
                        className="p-2 text-green-600 hover:bg-green-100 rounded"
                      >
                        {copiedCredential === `new-email-${createdAgent.agent.email}` ? 
                          <Check className="w-4 h-4" /> : 
                          <Copy className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-green-700 mb-1">
                      Password
                    </label>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 text-sm bg-white px-3 py-2 rounded border font-mono">
                        {createdAgent.credentials.password}
                      </code>
                      <button
                        onClick={() => copyCredential(createdAgent.credentials.password, 'new-password')}
                        className="p-2 text-green-600 hover:bg-green-100 rounded"
                      >
                        {copiedCredential === `new-password-${createdAgent.credentials.password}` ? 
                          <Check className="w-4 h-4" /> : 
                          <Copy className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">Agent Login URL:</p>
                    <p><code>{window.location.origin}/agent-login</code></p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-700">
                    <p className="font-medium">Important:</p>
                    <p>Save these credentials securely. They cannot be recovered if lost.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setCreatedAgent(null)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Agent Modal */}
      {showAssignModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800">Assign Agent to Chatbot</h2>
            </div>
            
            <form onSubmit={handleAssignAgent} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Chatbot
                </label>
                <select
                  required
                  value={assignForm.chatbotId}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, chatbotId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Choose a chatbot...</option>
                  {chatbots.map((chatbot) => (
                    <option key={chatbot.id} value={chatbot.id}>
                      {chatbot.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedAgent(null);
                    setAssignForm({ chatbotId: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Assign Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agents;