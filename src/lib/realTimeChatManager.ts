import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'agent';
  created_at: string;
  conversation_id: string;
  agent_id?: string;
}

interface SubscriptionOptions {
  conversationId: string;
  onMessage: (message: ChatMessage) => void;
  onAgentChange?: (payload: any) => void;
}

export class RealTimeChatManager {
  private supabase: SupabaseClient;
  private messageChannels: Map<string, RealtimeChannel> = new Map();
  private agentChannels: Map<string, RealtimeChannel> = new Map();

  constructor() {
    this.supabase = supabase;
  }

  // Subscribe to messages and agent interventions for a conversation
  subscribe({ conversationId, onMessage, onAgentChange }: SubscriptionOptions) {
    if (!conversationId) {
      console.error('No conversation ID provided for subscription');
      return () => {};
    }

    console.log(`🔄 Subscribing to real-time updates for conversation: ${conversationId}`);

    // Message subscription
    const messageChannelName = `messages-${conversationId}`;
    if (this.messageChannels.has(conversationId)) {
      this.unsubscribe(conversationId);
    }

    const messageChannel = this.supabase
      .channel(messageChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log(`💬 Real-time message received for ${conversationId}:`, payload.new);
          onMessage(payload.new as ChatMessage);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Message channel status for ${conversationId}: ${status}`);
      });

    this.messageChannels.set(conversationId, messageChannel);

    // Agent intervention subscription (optional)
    if (onAgentChange) {
      const agentChannelName = `agent-intervention-${conversationId}`;
      const agentChannel = this.supabase
        .channel(agentChannelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversation_agents',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            console.log(`🔔 Agent change detected for ${conversationId}:`, payload);
            onAgentChange(payload);
          }
        )
        .subscribe((status) => {
          console.log(`📡 Agent channel status for ${conversationId}: ${status}`);
        });

      this.agentChannels.set(conversationId, agentChannel);
    }

    // Return cleanup function
    return () => this.unsubscribe(conversationId);
  }

  // Unsubscribe from a conversation
  unsubscribe(conversationId: string) {
    const messageChannel = this.messageChannels.get(conversationId);
    const agentChannel = this.agentChannels.get(conversationId);

    if (messageChannel) {
      messageChannel.unsubscribe();
      this.messageChannels.delete(conversationId);
      console.log(`🔄 Unsubscribed from messages for ${conversationId}`);
    }

    if (agentChannel) {
      agentChannel.unsubscribe();
      this.agentChannels.delete(conversationId);
      console.log(`🔄 Unsubscribed from agent interventions for ${conversationId}`);
    }
  }

  // Send a message to the conversation
  async sendMessage(
    conversationId: string,
    content: string,
    role: 'user' | 'assistant' | 'agent',
    agentId?: string
  ) {
    console.log(`📤 Sending message to ${conversationId}:`, { content, role, agentId });
    const { error } = await this.supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content,
        role,
        agent_id: agentId,
      });

    if (error) {
      console.error(`❌ Failed to send message to ${conversationId}:`, error);
      throw error;
    }
    console.log(`✅ Message sent to ${conversationId}`);
  }

  // Ensure conversation exists or create it
  async ensureConversation(chatbotId: string, sessionId: string): Promise<string> {
    const conversationId = this.generateConversationId(chatbotId, sessionId);
    const { data } = await this.supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle();

    if (!data) {
      console.log(`🆕 Creating conversation: ${conversationId}`);
      await this.supabase
        .from('conversations')
        .insert({
          id: conversationId,
          chatbot_id: chatbotId,
          session_id: sessionId,
          user_id: null,
        });
    }
    return conversationId;
  }

  // Generate a consistent conversation ID
  private generateConversationId(chatbotId: string, sessionId: string): string {
    const combined = `${chatbotId}_${sessionId}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
    return `${hashHex.substring(0, 8)}-${hashHex.substring(0, 4)}-4${hashHex.substring(1, 4)}-8${hashHex.substring(0, 3)}-${hashHex}${hashHex}`.substring(0, 36);
  }

  // Toggle knowledge base for a conversation
  async toggleKnowledgeBase(conversationId: string, enabled: boolean, agentId: string) {
    try {
      console.log(`🧠 Toggling knowledge base for ${conversationId}: ${enabled}`);
      const { error } = await this.supabase
        .from('conversation_agents')
        .update({ knowledge_base_enabled: enabled })
        .eq('conversation_id', conversationId)
        .eq('agent_id', agentId);
      
      if (error) {
        console.error('Failed to toggle knowledge base:', error);
        throw error;
      }
      
      console.log(`🧠 Knowledge base ${enabled ? 'enabled' : 'disabled'} for ${conversationId}`);
    } catch (err) {
      console.error('Failed to toggle knowledge base:', err);
      throw err;
    }
  }
}

export const chatManager = new RealTimeChatManager();