import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { realtimeService } from '../lib/realtime';

export interface Agent {
  id: string;
  user_id: string;
  agent_id: string;
  password: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface AgentAssignment {
  id: string;
  agent_id: string;
  chatbot_id: string;
  created_at: string;
  agent?: Agent;
  chatbot?: any;
}

export interface ConversationAgent {
  id: string;
  conversation_id: string;
  agent_id: string;
  assigned_at: string;
  knowledge_base_enabled?: boolean;
  agent?: Agent;
}

export interface AgentNotification {
  id: string;
  agent_id: string;
  conversation_id: string;
  type: 'escalation' | 'new_message' | 'manual_request';
  message: string;
  is_read: boolean;
  created_at: string;
  chatbot_name?: string;
}

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assignments, setAssignments] = useState<AgentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchAgents = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAgents(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('agent_assignments')
        .select(`
          *,
          agents!inner(*, user_id),
          chatbots!inner(*)
        `)
        .eq('agents.user_id', user.id);

      if (error) throw error;
      setAssignments(data || []);
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
    }
  };

  const generateAgentCredentials = () => {
    const agentId = `agent_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const password = `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    return { agentId, password };
  };

  const createAgent = async (agentData: {
    name: string;
    email: string;
    agentId?: string;
    password?: string;
  }) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const credentials = agentData.agentId && agentData.password 
        ? { agentId: agentData.agentId, password: agentData.password }
        : generateAgentCredentials();

      const { data, error } = await supabase
        .from('agents')
        .insert([
          {
            user_id: user.id,
            agent_id: credentials.agentId,
            password: credentials.password,
            name: agentData.name,
            email: agentData.email,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setAgents(prev => [data, ...prev]);
      return { agent: data, credentials };
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create agent');
    }
  };

  const deleteAgent = async (agentId: string) => {
    try {
      console.log('🗑️ Attempting to delete agent:', agentId);
      
      // First, delete all assignments for this agent
      const { error: assignmentError } = await supabase
        .from('agent_assignments')
        .delete()
        .eq('agent_id', agentId);

      if (assignmentError) {
        console.error('❌ Failed to delete agent assignments:', assignmentError);
        throw assignmentError;
      }

      console.log('✅ Agent assignments deleted');

      // Then, delete all conversation assignments for this agent
      const { error: conversationError } = await supabase
        .from('conversation_agents')
        .delete()
        .eq('agent_id', agentId);

      if (conversationError) {
        console.error('❌ Failed to delete conversation assignments:', conversationError);
        throw conversationError;
      }

      console.log('✅ Conversation assignments deleted');

      // Finally, delete the agent
      const { error: agentError } = await supabase
        .from('agents')
        .delete()
        .eq('id', agentId);

      if (agentError) {
        console.error('❌ Failed to delete agent:', agentError);
        throw agentError;
      }

      console.log('✅ Agent deleted successfully');

      // Update local state
      setAgents(prev => prev.filter(agent => agent.id !== agentId));
      setAssignments(prev => prev.filter(assignment => assignment.agent_id !== agentId));
      
      return true;
    } catch (err) {
      console.error('❌ Delete agent error:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to delete agent');
    }
  };

  const assignAgentToChatbot = async (agentId: string, chatbotId: string) => {
    try {
      // Check if assignment already exists
      const { data: existing } = await supabase
        .from('agent_assignments')
        .select('id')
        .eq('agent_id', agentId)
        .eq('chatbot_id', chatbotId)
        .single();

      if (existing) {
        throw new Error('Agent is already assigned to this chatbot');
      }

      const { data, error } = await supabase
        .from('agent_assignments')
        .insert([
          {
            agent_id: agentId,
            chatbot_id: chatbotId,
          },
        ])
        .select(`
          *,
          agents(*),
          chatbots(*)
        `)
        .single();

      if (error) throw error;

      setAssignments(prev => [data, ...prev]);
      return data;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to assign agent');
    }
  };

  const removeAgentAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('agent_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      setAssignments(prev => prev.filter(assignment => assignment.id !== assignmentId));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to remove assignment');
    }
  };

  const assignAgentToConversation = async (conversationId: string, agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('conversation_agents')
        .insert([
          {
            conversation_id: conversationId,
            agent_id: agentId,
            knowledge_base_enabled: true
          },
        ])
        .select()
        .single();

      if (error) throw error;
      
      // Set up real-time subscription for this conversation
      realtimeService.subscribeNewMessage(conversationId, () => {
        // This will be handled by the component that uses this hook
      });
      
      return data;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to assign agent to conversation');
    }
  };

  const createNotification = async (notification: {
    agent_id: string;
    conversation_id: string;
    type: 'escalation' | 'new_message' | 'manual_request';
    message: string;
    chatbot_name?: string;
  }) => {
    try {
      const { data, error } = await supabase
        .from('agent_notifications')
        .insert([notification])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create notification');
    }
  };

  const getAgentNotifications = async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('agent_notifications')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      return [];
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('agent_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const authenticateAgent = async (email: string, password: string) => {
    try {
      console.log('🔐 Authenticating agent with email:', email);
      console.log('🔐 Password length:', password.length);
      
      // Query the agents table directly with email and password
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('email', email.trim())
        .eq('password', password.trim())
        .maybeSingle();

      console.log('📊 Query result:', { data, error });

      if (error) {
        console.error('❌ Database error during agent authentication:', error);
        throw new Error('Database error during authentication');
      }

      if (!data) {
        console.log('❌ No agent found with provided credentials');
        console.log('🔍 Checking if agent exists with this email...');
        
        // Check if agent exists with this email
        const { data: emailCheck } = await supabase
          .from('agents')
          .select('email, password')
          .eq('email', email.trim())
          .maybeSingle();
        
        if (emailCheck) {
          console.log('📧 Agent found with email, but password mismatch');
          console.log('🔑 Expected password length:', emailCheck.password.length);
          console.log('🔑 Provided password length:', password.length);
          throw new Error('Invalid password');
        } else {
          console.log('📧 No agent found with this email');
          throw new Error('Invalid email or password');
        }
      }

      console.log('✅ Agent authenticated successfully:', data.name);
      
      return data;
    } catch (err) {
      console.error('❌ Authentication failed:', err);
      throw new Error(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchAssignments();
  }, [user?.id]);

  return {
    agents,
    assignments,
    loading,
    error,
    createAgent,
    deleteAgent,
    assignAgentToChatbot,
    removeAgentAssignment,
    assignAgentToConversation,
    createNotification,
    getAgentNotifications,
    markNotificationAsRead,
    authenticateAgent,
    generateAgentCredentials,
    refetch: () => {
      fetchAgents();
      fetchAssignments();
    },
  };
};