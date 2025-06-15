import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, 
  User, 
  Clock, 
  LogOut, 
  Shield,
  Bell,
  CheckCircle,
  AlertCircle,
  Users,
  Send,
  UserPlus,
  Zap,
  RefreshCw,
  Eye,
  Settings,
  Brain,
  Bot,
  Loader
} from 'lucide-react';
import { useAgent } from '../contexts/AgentContext';
import { useAgents } from '../hooks/useAgents';
import { useDocuments } from '../hooks/useDocuments';
import { generateChatResponse, ChatMessage } from '../lib/openai';
import { supabase } from '../lib/supabase';
import { realtimeService } from '../lib/realtime';

interface AssignedConversation {
  id: string;
  chatbot_id: string;
  session_id: string;
  created_at: string;
  updated_at: string;
  chatbot?: {
    name: string;
    configuration: any;
    knowledge_base_id?: string;
  };
  messages?: any[];
  lastMessage?: string;
  lastMessageTime?: string;
  messageCount?: number;
}

interface AgentMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'agent';
  created_at: string;
  is_agent_message?: boolean;
}

const AgentDashboard: React.FC = () => {
  const { currentAgent, agentSignOut } = useAgent();
  const { getAgentNotifications, markNotificationAsRead, createNotification } = useAgents();
  const { fetchSimilarChunks } = useDocuments();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<AssignedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [availableConversations, setAvailableConversations] = useState<any[]>([]);
  const [showManualIntervention, setShowManualIntervention] = useState(false);
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);
  const [sendingWithKB, setSendingWithKB] = useState(false);
  const [handBackToBot, setHandBackToBot] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper function to generate simple hash for conversation IDs
  const generateSimpleHash = (text: string): string => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  };

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to real-time events for selected conversation
  useEffect(() => {
    if (!selectedConversation || !currentAgent) return;

    console.log('🔄 Setting up real-time subscriptions for conversation:', selectedConversation);

    // Subscribe to new messages
    realtimeService.subscribeNewMessage(selectedConversation, (data) => {
      if (data.conversationId === selectedConversation) {
        console.log('💬 New message received in agent dashboard:', data.message);
        setMessages((prev) => {
          const exists = prev.some((msg) => msg.id === data.message.id);
          if (exists) return prev;
          return [...prev, data.message];
        });
        
        // Update conversation list
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversation
              ? {
                  ...conv,
                  lastMessage: data.message.content,
                  lastMessageTime: data.message.created_at,
                  messageCount: (conv.messageCount || 0) + 1,
                }
              : conv
          )
        );
      }
    });

    // Subscribe to knowledge base toggles
    realtimeService.subscribeKnowledgeBaseToggle(selectedConversation, (data) => {
      console.log('🧠 Knowledge base toggled:', data.enabled);
      setUseKnowledgeBase(data.enabled);
    });

    return () => {
      realtimeService.unsubscribe(`messages-${selectedConversation}`);
      realtimeService.unsubscribe(`knowledge-base-${selectedConversation}`);
    };
  }, [selectedConversation, currentAgent]);

  useEffect(() => {
    if (!currentAgent) {
      navigate('/agent-login');
      return;
    }

    fetchAssignedConversations();
    fetchNotifications();
    fetchAvailableConversations();
    
    // Set up real-time subscriptions for conversations
    const conversationSubscription = supabase
      .channel('agent-conversations')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'conversation_agents' },
        () => {
          console.log('🔄 Conversation assignment changed, refreshing...');
          fetchAssignedConversations();
        }
      )
      .subscribe();

    // Set up real-time subscriptions for notifications
    const notificationSubscription = supabase
      .channel('agent-notifications')
      .on('postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'agent_notifications',
          filter: `agent_id=eq.${currentAgent.id}`
        },
        (payload) => {
          console.log('🔔 New notification received:', payload.new);
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      conversationSubscription.unsubscribe();
      notificationSubscription.unsubscribe();
      realtimeService.unsubscribeAll();
    };
  }, [currentAgent, navigate]);

  const fetchAssignedConversations = async () => {
    if (!currentAgent) return;

    try {
      setLoading(true);
      
      // Get conversations assigned to this agent
      const { data: conversationAgents, error } = await supabase
        .from('conversation_agents')
        .select(`
          *,
          conversations!inner(
            *,
            chatbots(name, configuration, knowledge_base_id)
          )
        `)
        .eq('agent_id', currentAgent.id);

      if (error) throw error;

      // Transform the data and get message counts
      const assignedConversations = await Promise.all(
        (conversationAgents || []).map(async (ca) => {
          const conversation = ca.conversations;
          
          // Get message count and last message
          const { data: messages, count } = await supabase
            .from('messages')
            .select('*', { count: 'exact' })
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...conversation,
            chatbot: conversation.chatbots,
            messages: messages || [],
            lastMessage: messages?.[0]?.content || 'No messages yet',
            lastMessageTime: messages?.[0]?.created_at || conversation.created_at,
            messageCount: count || 0
          };
        })
      );

      console.log('📊 Fetched assigned conversations:', assignedConversations);
      setConversations(assignedConversations);
    } catch (err) {
      console.error('Failed to fetch assigned conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableConversations = async () => {
    if (!currentAgent) return;

    try {
      // Get conversations from chatbots this agent is assigned to, but not yet handled by any agent
      const { data: assignments } = await supabase
        .from('agent_assignments')
        .select('chatbot_id')
        .eq('agent_id', currentAgent.id);

      if (!assignments || assignments.length === 0) return;

      const chatbotIds = assignments.map(a => a.chatbot_id);

      // Get recent conversations that don't have an agent assigned
      const { data: conversations } = await supabase
        .from('conversations')
        .select(`
          *,
          chatbots(name, configuration, knowledge_base_id)
        `)
        .in('chatbot_id', chatbotIds)
        .is('user_id', null) // Anonymous conversations
        .not('session_id', 'is', null) // Has session ID
        .order('updated_at', { ascending: false })
        .limit(10);

      if (conversations) {
        // Filter out conversations that already have an agent assigned
        const { data: assignedConversationIds } = await supabase
          .from('conversation_agents')
          .select('conversation_id')
          .in('conversation_id', conversations.map(c => c.id));

        const assignedIds = new Set(assignedConversationIds?.map(ca => ca.conversation_id) || []);
        const available = conversations.filter(c => !assignedIds.has(c.id));

        setAvailableConversations(available);
      }
    } catch (err) {
      console.error('Failed to fetch available conversations:', err);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      console.log('📥 Fetching messages for conversation:', conversationId);
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Transform messages to include agent message detection
      const transformedMessages: AgentMessage[] = (data || []).map(msg => ({
        ...msg,
        is_agent_message: msg.role === 'assistant' && msg.agent_id,
        role: msg.role as 'user' | 'assistant' | 'agent'
      }));

      console.log('📥 Fetched messages:', transformedMessages.length);
      setMessages(transformedMessages);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const fetchNotifications = async () => {
    if (!currentAgent) return;

    try {
      const notifications = await getAgentNotifications(currentAgent.id);
      setNotifications(notifications);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const handleConversationSelect = (conversationId: string) => {
    console.log('🎯 Selecting conversation:', conversationId);
    setSelectedConversation(conversationId);
    fetchMessages(conversationId);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sendingMessage) return;

    setSendingMessage(true);
    try {
      console.log('📤 Sending agent message...');
      
      const conversation = conversations.find(c => c.id === selectedConversation);
      
      // Insert message with agent identification using RPC function
      const { data, error } = await supabase
        .rpc('add_session_message', {
          chatbot_id_param: conversation?.chatbot_id,
          session_id_param: conversation?.session_id,
          content_param: newMessage.trim(),
          role_param: 'assistant',
          agent_id_param: currentAgent!.id
        });

      if (error) {
        console.error('❌ Failed to send agent message:', error);
        throw error;
      }

      console.log('✅ Agent message sent successfully');

      // Clear the input
      setNewMessage('');

      // The message will be added to the UI via real-time subscription
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendWithKnowledgeBase = async () => {
    if (!newMessage.trim() || !selectedConversation || sendingWithKB) return;

    const conversation = conversations.find(c => c.id === selectedConversation);
    if (!conversation?.chatbot?.knowledge_base_id) {
      alert('No knowledge base available for this chatbot');
      return;
    }

    setSendingWithKB(true);
    try {
      console.log('🧠 Generating response with knowledge base...');
      
      // Search knowledge base for relevant content
      const similarChunks = await fetchSimilarChunks(newMessage, 3, conversation.chatbot_id);
      
      let context = '';
      if (similarChunks.length > 0) {
        context = similarChunks
          .map(chunk => chunk.chunk_text)
          .join('\n\n');
      }

      // Get recent conversation history
      const recentMessages = messages.slice(-5).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      // Add current query
      recentMessages.push({
        role: 'user',
        content: newMessage
      });

      // Generate response using knowledge base
      const response = await generateChatResponse(recentMessages as ChatMessage[], context);

      // Send the enhanced response with agent identification using RPC function
      const { data, error } = await supabase
        .rpc('add_session_message', {
          chatbot_id_param: conversation.chatbot_id,
          session_id_param: conversation.session_id,
          content_param: response.message,
          role_param: 'assistant',
          agent_id_param: currentAgent!.id
        });

      if (error) {
        console.error('❌ Failed to send knowledge base response:', error);
        throw error;
      }

      console.log('✅ Knowledge base response sent successfully');

      // Clear the input
      setNewMessage('');

      // The message will be added to the UI via real-time subscription
    } catch (err) {
      console.error('Failed to send message with knowledge base:', err);
      alert('Failed to send message with knowledge base');
    } finally {
      setSendingWithKB(false);
    }
  };

  const handleHandBackToBot = async () => {
    if (!selectedConversation) return;

    if (!confirm('Are you sure you want to hand this conversation back to the AI bot? The customer will continue with automated responses.')) {
      return;
    }

    setHandBackToBot(true);
    try {
      // Send a handoff message first using RPC function
      const conversation = conversations.find(c => c.id === selectedConversation);
      await supabase
        .rpc('add_session_message', {
          chatbot_id_param: conversation?.chatbot_id,
          session_id_param: conversation?.session_id,
          content_param: "Thank you for your patience. I'm handing you back to our AI assistant who can continue to help you with your questions.",
          role_param: 'assistant',
          agent_id_param: currentAgent!.id
        });

      // Remove agent assignment from this conversation
      const { error } = await supabase
        .from('conversation_agents')
        .delete()
        .eq('conversation_id', selectedConversation)
        .eq('agent_id', currentAgent!.id);

      if (error) throw error;

      console.log('✅ Conversation handed back to bot');

      // Refresh conversations
      fetchAssignedConversations();
      setSelectedConversation(null);
      setMessages([]);
    } catch (err) {
      console.error('Failed to hand back to bot:', err);
      alert('Failed to hand conversation back to bot');
    } finally {
      setHandBackToBot(false);
    }
  };

  const handleManualIntervention = async (conversationId: string) => {
    try {
      console.log('🤝 Taking over conversation:', conversationId);
      
      // Assign this conversation to the current agent
      const { error } = await supabase
        .from('conversation_agents')
        .insert([
          {
            conversation_id: conversationId,
            agent_id: currentAgent!.id,
            knowledge_base_enabled: false
          }
        ]);

      if (error) throw error;

      // Disable knowledge base when taking over
      setUseKnowledgeBase(false);
      await realtimeService.toggleKnowledgeBase(conversationId, false);

      // Create notification
      const conversation = availableConversations.find(c => c.id === conversationId);
      await createNotification({
        agent_id: currentAgent!.id,
        conversation_id: conversationId,
        type: 'manual_request',
        message: `Manual intervention requested for ${conversation?.chatbots?.name || 'chatbot'}`,
        chatbot_name: conversation?.chatbots?.name
      });

      // Send takeover message using RPC function
      await supabase
        .rpc('add_session_message', {
          chatbot_id_param: conversation?.chatbot_id,
          session_id_param: conversation?.session_id,
          content_param: `Hello! I'm ${currentAgent!.name}, a human agent. I've taken over this conversation to provide you with personalized assistance. How can I help you?`,
          role_param: 'assistant',
          agent_id_param: currentAgent!.id
        });

      console.log('✅ Successfully took over conversation');

      // Refresh data
      fetchAssignedConversations();
      fetchAvailableConversations();
      setShowManualIntervention(false);
      
      // Auto-select the new conversation
      setSelectedConversation(conversationId);
      setTimeout(() => fetchMessages(conversationId), 500);
      
    } catch (err) {
      console.error('Failed to assign conversation:', err);
      alert('Failed to take over conversation');
    }
  };

  const handleSignOut = () => {
    agentSignOut();
    navigate('/agent-login');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const unreadNotifications = notifications.filter(n => !n.is_read).length;
  const selectedConversationData = conversations.find(c => c.id === selectedConversation);
  const hasKnowledgeBase = selectedConversationData?.chatbot?.knowledge_base_id;

  if (!currentAgent) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                {currentAgent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-800">Agent Dashboard</h1>
                <p className="text-sm text-slate-600">Welcome, {currentAgent.name}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Online</span>
            </div>
            
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
                  <div className="p-4 border-b border-slate-200">
                    <h3 className="font-medium text-slate-800">Notifications</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.slice(0, 5).map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-3 border-b border-slate-100 ${!notification.is_read ? 'bg-blue-50' : ''}`}
                        >
                          <p className="text-sm text-slate-800">{notification.message}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {formatTime(notification.created_at)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-slate-500">
                        <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-sm">No notifications</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowManualIntervention(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Take Over Chat</span>
            </button>

            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-3 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar - Agent Info & Conversations */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Agent Information</h2>
            
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-slate-800">Status</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Active Chats:</span>
                    <span className="font-medium text-slate-800">{conversations.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Available Chats:</span>
                    <span className="font-medium text-slate-800">{availableConversations.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Notifications:</span>
                    <span className="font-medium text-slate-800">{unreadNotifications}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-800">Agent Details</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-blue-600">Name:</span>
                    <p className="text-blue-800 font-medium">{currentAgent.name}</p>
                  </div>
                  <div>
                    <span className="text-blue-600">Email:</span>
                    <p className="text-blue-800">{currentAgent.email}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-700">Active Conversations</h3>
                <button
                  onClick={fetchAssignedConversations}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : conversations.length > 0 ? (
                <div className="space-y-2">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => handleConversationSelect(conversation.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedConversation === conversation.id
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-800 text-sm">
                          {conversation.chatbot?.name || 'Unknown Chatbot'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatTime(conversation.lastMessageTime || conversation.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {conversation.lastMessage}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-slate-500">Active</span>
                          {conversation.chatbot?.knowledge_base_id && (
                            <Brain className="w-3 h-3 text-purple-500" title="Has Knowledge Base" />
                          )}
                        </div>
                        <span className="text-xs text-slate-500">
                          {conversation.messageCount} messages
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No active conversations</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Escalated conversations will appear here
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-800">
                        {selectedConversationData?.chatbot?.name || 'Conversation'}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm text-slate-600">Customer Support Chat</p>
                        {hasKnowledgeBase && (
                          <div className="flex items-center space-x-1">
                            <Brain className="w-3 h-3 text-purple-500" />
                            <span className="text-xs text-purple-600">KB Available</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1 text-sm text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span>Agent Connected</span>
                    </div>
                    <button
                      onClick={handleHandBackToBot}
                      disabled={handBackToBot}
                      className="flex items-center space-x-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors disabled:opacity-50"
                    >
                      <Bot className="w-4 h-4" />
                      <span>{handBackToBot ? 'Handing Back...' : 'Hand Back to Bot'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 bg-slate-50 p-6">
                <div className="bg-white rounded-lg border border-slate-200 h-full flex flex-col">
                  <div className="flex-1 p-4 overflow-y-auto">
                    {messages.length > 0 ? (
                      <div className="space-y-4">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className="flex items-start space-x-2 max-w-[70%]">
                              {message.role !== 'user' && (
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 mt-1 ${
                                  message.is_agent_message ? 'bg-green-600' : 'bg-blue-600'
                                }`}>
                                  {message.is_agent_message ? (
                                    <User className="w-4 h-4" />
                                  ) : (
                                    'AI'
                                  )}
                                </div>
                              )}
                              <div
                                className={`px-4 py-2 rounded-lg ${
                                  message.role === 'user'
                                    ? 'bg-blue-600 text-white'
                                    : message.is_agent_message
                                    ? 'bg-green-100 text-green-800 border border-green-200'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className={`text-xs ${
                                    message.role === 'user' 
                                      ? 'text-blue-100' 
                                      : message.is_agent_message
                                      ? 'text-green-600'
                                      : 'text-slate-500'
                                  }`}>
                                    {new Date(message.created_at).toLocaleTimeString()}
                                  </p>
                                  {message.is_agent_message && (
                                    <span className="text-xs text-green-600 font-medium ml-2">
                                      Agent
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-800 mb-2">No messages yet</h3>
                        <p className="text-slate-600">
                          This conversation hasn't started yet.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="border-t border-slate-200 p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        placeholder="Type your message to the customer..."
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        disabled={sendingMessage || sendingWithKB}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || sendingMessage || sendingWithKB}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {sendingMessage ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span>{sendingMessage ? 'Sending...' : 'Send'}</span>
                      </button>
                    </div>
                    
                    {/* Knowledge Base Controls */}
                    {hasKnowledgeBase && (
                      <div className="flex items-center justify-between">
                        {useKnowledgeBase ? (
                          <div className="flex-1 bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Brain className="w-4 h-4 text-purple-600" />
                              <span className="text-sm text-purple-700">Knowledge Base Available</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setUseKnowledgeBase(false)}
                                className="text-xs text-purple-600 hover:underline"
                              >
                                Disable
                              </button>
                              <button
                                onClick={handleSendWithKnowledgeBase}
                                disabled={!newMessage.trim() || sendingMessage || sendingWithKB}
                                className="flex items-center space-x-2 px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {sendingWithKB ? <Loader className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                <span>{sendingWithKB ? 'Generating...' : 'Use Knowledge Base'}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setUseKnowledgeBase(true)}
                            className="text-sm text-purple-600 hover:underline flex items-center space-x-1"
                          >
                            <Brain className="w-3 h-3" />
                            <span>Enable Knowledge Base</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-slate-800 mb-2">Select a Conversation</h3>
                <p className="text-slate-600 mb-4">
                  Choose a conversation from the sidebar to start helping customers
                </p>
                <button
                  onClick={() => setShowManualIntervention(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Take Over a Chat</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Intervention Modal */}
      {showManualIntervention && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800">Take Over Customer Conversation</h2>
              <p className="text-slate-600 mt-1">Select a conversation to manually intervene and help the customer</p>
            </div>
            
            <div className="p-6 max-h-96 overflow-y-auto">
              {availableConversations.length > 0 ? (
                <div className="space-y-3">
                  {availableConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-slate-800">
                          {conversation.chatbots?.name || 'Unknown Chatbot'}
                        </h3>
                        <span className="text-sm text-slate-500">
                          {formatTime(conversation.updated_at)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">
                        Session: {conversation.session_id}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <span className="text-sm text-slate-600">Waiting for agent</span>
                          {conversation.chatbots?.knowledge_base_id && (
                            <div className="flex items-center space-x-1">
                              <Brain className="w-3 h-3 text-purple-500" />
                              <span className="text-xs text-purple-600">KB</span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleManualIntervention(conversation.id)}
                          className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>Take Over</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Eye className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-800 mb-2">No Available Conversations</h3>
                  <p className="text-slate-600">
                    There are no active conversations that need manual intervention at the moment.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowManualIntervention(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={fetchAvailableConversations}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDashboard;