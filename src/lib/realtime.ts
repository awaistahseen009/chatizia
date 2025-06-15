import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface RealtimeEvents {
  onAgentIntervention: (data: { conversationId: string; agent: any }) => void;
  onNewMessage: (data: { conversationId: string; message: any }) => void;
  onKnowledgeBaseToggle: (data: { conversationId: string; enabled: boolean }) => void;
}

class RealtimeService {
  private supabase: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();
  private static instance: RealtimeService;

  private constructor() {
    this.supabase = supabase;
  }

  // Singleton pattern to ensure one instance
  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  // Subscribe to agent intervention events
  public subscribeAgentIntervention(
    conversationId: string,
    callback: RealtimeEvents['onAgentIntervention'],
  ): void {
    const channelName = `agent-intervention-${conversationId}`;
    if (this.channels.has(channelName)) {
      console.log(`🔌 Already subscribed to ${channelName}`);
      return;
    }

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_agents',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          console.log('🔔 Agent intervention detected:', payload.new);
          try {
            // Fetch agent details
            const { data: agent, error } = await this.supabase
              .from('agents')
              .select('id, name, email, agent_id')
              .eq('id', payload.new.agent_id)
              .single();
            
            if (error) {
              console.error('Failed to fetch agent:', error);
              return;
            }
            
            callback({
              conversationId: payload.new.conversation_id,
              agent: agent,
            });
          } catch (err) {
            console.error('Error in agent intervention callback:', err);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'conversation_agents',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          console.log('🤖 Agent handed conversation back to bot');
          callback({
            conversationId,
            agent: null,
          });
        }
      )
      .subscribe((status) => {
        console.log(`📡 Agent intervention channel ${channelName} status: ${status}`);
      });

    this.channels.set(channelName, channel);
  }

  // Subscribe to new message events
  public subscribeNewMessage(
    conversationId: string,
    callback: RealtimeEvents['onNewMessage'],
  ): void {
    const channelName = `messages-${conversationId}`;
    if (this.channels.has(channelName)) {
      console.log(`🔌 Already subscribed to ${channelName}`);
      return;
    }

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('💬 New message received via real-time:', payload.new);
          try {
            callback({
              conversationId: payload.new.conversation_id,
              message: {
                id: payload.new.id,
                content: payload.new.content,
                role: payload.new.role,
                created_at: payload.new.created_at,
                is_agent_message: !!payload.new.agent_id,
                agent_id: payload.new.agent_id,
              },
            });
          } catch (err) {
            console.error('Error in message callback:', err);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Messages channel ${channelName} status: ${status}`);
      });

    this.channels.set(channelName, channel);
  }

  // Subscribe to knowledge base toggle events
  public subscribeKnowledgeBaseToggle(
    conversationId: string,
    callback: RealtimeEvents['onKnowledgeBaseToggle'],
  ): void {
    const channelName = `knowledge-base-${conversationId}`;
    if (this.channels.has(channelName)) {
      console.log(`🔌 Already subscribed to ${channelName}`);
      return;
    }

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_agents',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('🧠 Knowledge base toggle detected:', payload.new);
          try {
            callback({
              conversationId: payload.new.conversation_id,
              enabled: payload.new.knowledge_base_enabled,
            });
          } catch (err) {
            console.error('Error in knowledge base toggle callback:', err);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Knowledge base channel ${channelName} status: ${status}`);
      });

    this.channels.set(channelName, channel);
  }

  // Unsubscribe from a specific channel
  public unsubscribe(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelName);
      console.log(`🔌 Unsubscribed from ${channelName}`);
    }
  }

  // Unsubscribe from all channels
  public unsubscribeAll(): void {
    this.channels.forEach((channel, name) => {
      channel.unsubscribe();
      console.log(`🔌 Unsubscribed from ${name}`);
    });
    this.channels.clear();
  }

  // Emit knowledge base toggle (update database)
  public async toggleKnowledgeBase(
    conversationId: string,
    enabled: boolean,
  ): Promise<void> {
    try {
      console.log(`🧠 Toggling knowledge base for ${conversationId}: ${enabled}`);
      const { error } = await this.supabase
        .from('conversation_agents')
        .update({ knowledge_base_enabled: enabled })
        .eq('conversation_id', conversationId);
      
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

export const realtimeService = RealtimeService.getInstance();