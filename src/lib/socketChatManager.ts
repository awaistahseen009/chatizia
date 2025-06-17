import { io, Socket } from 'socket.io-client';
import { supabase } from './supabase';

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'agent';
  created_at: string;
  conversation_id: string;
  agent_id?: string;
  sender_name?: string;
  avatar?: string;
  message_type?: 'text' | 'image' | 'file';
  read_by?: string[];
  reactions?: { emoji: string; user_id: string; user_name: string }[];
}

interface TypingIndicator {
  conversation_id: string;
  user_id: string;
  user_name: string;
  is_typing: boolean;
}

interface OnlineStatus {
  conversation_id: string;
  user_id: string;
  user_name: string;
  is_online: boolean;
  last_seen?: string;
}

interface SubscriptionOptions {
  conversationId: string;
  userId: string;
  userName: string;
  onMessage: (message: ChatMessage) => void;
  onTyping?: (typing: TypingIndicator) => void;
  onOnlineStatus?: (status: OnlineStatus) => void;
  onAgentChange?: (payload: { eventType: string; data: any }) => void;
  onMessageRead?: (data: { message_id: string; user_id: string; user_name: string }) => void;
  onReaction?: (data: { message_id: string; emoji: string; user_id: string; user_name: string }) => void;
}

export class SocketChatManager {
  private socket: Socket | null = null;
  private connected: boolean = false;
  private currentConversation: string | null = null;
  private currentUser: { id: string; name: string } | null = null;
  private typingTimeout: NodeJS.Timeout | null = null;
  private useSupabaseRealtime: boolean = false;
  private supabaseSubscriptions: any[] = [];
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 3;

  constructor() {
    // Try to connect to socket server, but fallback to Supabase Realtime if it fails
    this.initializeConnection();
  }

  private async initializeConnection() {
    try {
      console.log('🔄 Attempting to connect to Socket.IO server...');
      
      // Try to connect to a real Socket.IO server
      // For demo purposes, we'll use a public Socket.IO test server
      this.socket = io('https://socket-io-chat.now.sh', {
        autoConnect: false,
        transports: ['websocket', 'polling'],
        timeout: 5000,
        forceNew: true,
      });

      this.setupSocketEventListeners();
      
      // Try to connect
      this.socket.connect();
      
      // Wait for connection or timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        this.socket!.on('connect', () => {
          clearTimeout(timeout);
          resolve(true);
        });

        this.socket!.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      console.log('✅ Socket.IO connection successful');
      this.useSupabaseRealtime = false;
      
    } catch (error) {
      console.log('❌ Socket.IO connection failed, falling back to Supabase Realtime:', error.message);
      this.useSupabaseRealtime = true;
      this.connected = true; // Mark as connected for Supabase Realtime mode
      
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
    }
  }

  private setupSocketEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log(`📡 Socket connected: ${this.socket!.id}`);
      this.connected = true;
      this.connectionAttempts = 0;
      
      // Rejoin conversation if we were in one
      if (this.currentConversation && this.currentUser) {
        this.joinConversation(this.currentConversation, this.currentUser.id, this.currentUser.name);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('📡 Socket disconnected:', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.connectionAttempts++;
      
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        console.log('🔄 Max connection attempts reached, switching to Supabase Realtime');
        this.useSupabaseRealtime = true;
        this.connected = true;
        this.socket?.disconnect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    // Handle reconnection
    this.socket.on('reconnect', () => {
      console.log('🔄 Socket reconnected');
      if (this.currentConversation && this.currentUser) {
        this.joinConversation(this.currentConversation, this.currentUser.id, this.currentUser.name);
      }
    });
  }

  // Connect to the socket server or use Supabase Realtime
  connect() {
    if (this.useSupabaseRealtime) {
      console.log('📡 Using Supabase Realtime for chat');
      this.connected = true;
      return;
    }

    if (!this.connected && this.socket && !this.socket.connected) {
      console.log('🔄 Connecting to socket server...');
      this.socket.connect();
    }
  }

  // Disconnect from the socket server
  disconnect() {
    if (this.currentConversation) {
      this.leaveConversation(this.currentConversation);
    }
    
    if (this.socket) {
      this.socket.disconnect();
    }
    
    // Clean up Supabase subscriptions
    this.supabaseSubscriptions.forEach(subscription => {
      subscription.unsubscribe();
    });
    this.supabaseSubscriptions = [];
    
    this.connected = false;
    this.currentConversation = null;
    this.currentUser = null;
    console.log('📡 Disconnected from chat service');
  }

  // Join a conversation room
  private joinConversation(conversationId: string, userId: string, userName: string) {
    if (this.useSupabaseRealtime) {
      console.log(`🚪 Joining conversation via Supabase: ${conversationId} as ${userName}`);
      return;
    }

    console.log(`🚪 Joining conversation: ${conversationId} as ${userName}`);
    this.socket?.emit('join_conversation', {
      conversationId,
      userId,
      userName,
    });
  }

  // Leave a conversation room
  private leaveConversation(conversationId: string) {
    if (this.useSupabaseRealtime) {
      console.log(`🚪 Leaving conversation via Supabase: ${conversationId}`);
      return;
    }

    console.log(`🚪 Leaving conversation: ${conversationId}`);
    this.socket?.emit('leave_conversation', { conversationId });
  }

  // Subscribe to conversation events
  subscribe({
    conversationId,
    userId,
    userName,
    onMessage,
    onTyping,
    onOnlineStatus,
    onAgentChange,
    onMessageRead,
    onReaction,
  }: SubscriptionOptions) {
    if (!conversationId) {
      console.error('No conversation ID provided for subscription');
      return () => {};
    }

    this.connect();
    this.currentConversation = conversationId;
    this.currentUser = { id: userId, name: userName };

    if (this.useSupabaseRealtime) {
      return this.subscribeWithSupabase({
        conversationId,
        userId,
        userName,
        onMessage,
        onAgentChange,
      });
    }

    // Join the conversation room
    this.joinConversation(conversationId, userId, userName);

    // Set up event listeners for Socket.IO
    const messageHandler = (message: ChatMessage) => {
      console.log(`💬 New message in ${conversationId}:`, message);
      onMessage(message);
    };

    const typingHandler = (typing: TypingIndicator) => {
      console.log(`⌨️ Typing indicator in ${conversationId}:`, typing);
      onTyping?.(typing);
    };

    const onlineStatusHandler = (status: OnlineStatus) => {
      console.log(`🟢 Online status in ${conversationId}:`, status);
      onOnlineStatus?.(status);
    };

    const agentChangeHandler = (payload: { eventType: string; data: any }) => {
      console.log(`🔔 Agent change in ${conversationId}:`, payload);
      onAgentChange?.(payload);
    };

    const messageReadHandler = (data: { message_id: string; user_id: string; user_name: string }) => {
      console.log(`👁️ Message read in ${conversationId}:`, data);
      onMessageRead?.(data);
    };

    const reactionHandler = (data: { message_id: string; emoji: string; user_id: string; user_name: string }) => {
      console.log(`😀 Reaction in ${conversationId}:`, data);
      onReaction?.(data);
    };

    // Register event listeners
    this.socket?.on('new_message', messageHandler);
    this.socket?.on('typing_indicator', typingHandler);
    this.socket?.on('online_status', onlineStatusHandler);
    this.socket?.on('agent_change', agentChangeHandler);
    this.socket?.on('message_read', messageReadHandler);
    this.socket?.on('reaction_added', reactionHandler);

    // Return cleanup function
    return () => {
      this.socket?.off('new_message', messageHandler);
      this.socket?.off('typing_indicator', typingHandler);
      this.socket?.off('online_status', onlineStatusHandler);
      this.socket?.off('agent_change', agentChangeHandler);
      this.socket?.off('message_read', messageReadHandler);
      this.socket?.off('reaction_added', reactionHandler);
      
      if (this.currentConversation === conversationId) {
        this.leaveConversation(conversationId);
        this.currentConversation = null;
        this.currentUser = null;
      }
      
      console.log(`🔄 Unsubscribed from conversation: ${conversationId}`);
    };
  }

  // Subscribe using Supabase Realtime as fallback
  private subscribeWithSupabase({
    conversationId,
    userId,
    userName,
    onMessage,
    onAgentChange,
  }: {
    conversationId: string;
    userId: string;
    userName: string;
    onMessage: (message: ChatMessage) => void;
    onAgentChange?: (payload: { eventType: string; data: any }) => void;
  }) {
    console.log(`📡 Setting up Supabase Realtime for conversation: ${conversationId}`);

    // Subscribe to messages
    const messageSubscription = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('💬 New message via Supabase:', payload.new);
          onMessage(payload.new as ChatMessage);
        }
      )
      .subscribe();

    this.supabaseSubscriptions.push(messageSubscription);

    // Subscribe to agent changes if provided
    if (onAgentChange) {
      const agentSubscription = supabase
        .channel(`agent-changes-${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversation_agents',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            console.log('🔔 Agent change via Supabase:', payload);
            onAgentChange({
              eventType: payload.eventType,
              data: payload.new || payload.old,
            });
          }
        )
        .subscribe();

      this.supabaseSubscriptions.push(agentSubscription);
    }

    // Return cleanup function
    return () => {
      this.supabaseSubscriptions.forEach(subscription => {
        subscription.unsubscribe();
      });
      this.supabaseSubscriptions = [];
      console.log(`🔄 Unsubscribed from Supabase Realtime: ${conversationId}`);
    };
  }

  // Send a message
  async sendMessage(
    conversationId: string,
    content: string,
    role: 'user' | 'assistant' | 'agent',
    agentId?: string,
    messageType: 'text' | 'image' | 'file' = 'text'
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('Chat service not connected');
    }

    console.log(`📤 Sending message to ${conversationId}:`, { content, role, agentId, messageType });

    if (this.useSupabaseRealtime) {
      // Send message directly to Supabase
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content,
          role,
          agent_id: agentId,
        });

      if (error) {
        console.error(`❌ Failed to send message via Supabase:`, error);
        throw new Error(error.message);
      }

      console.log(`✅ Message sent via Supabase to ${conversationId}`);
      return;
    }

    // Send via Socket.IO
    return new Promise((resolve, reject) => {
      this.socket?.emit(
        'send_message',
        {
          conversationId,
          content,
          role,
          agentId,
          messageType,
          userId: this.currentUser?.id,
          userName: this.currentUser?.name,
        },
        (response: { success: boolean; error?: string; message?: ChatMessage }) => {
          if (response.success) {
            console.log(`✅ Message sent to ${conversationId}`);
            resolve();
          } else {
            console.error(`❌ Failed to send message to ${conversationId}:`, response.error);
            reject(new Error(response.error || 'Failed to send message'));
          }
        }
      );
    });
  }

  // Send typing indicator
  sendTypingIndicator(conversationId: string, isTyping: boolean) {
    if (!this.connected || !this.currentUser) return;

    // Clear existing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    if (this.useSupabaseRealtime) {
      // For Supabase Realtime, we could implement typing indicators via a separate table
      // For now, we'll skip this feature in fallback mode
      return;
    }

    console.log(`⌨️ Sending typing indicator: ${isTyping} for ${conversationId}`);
    this.socket?.emit('typing_indicator', {
      conversationId,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      isTyping,
    });

    // Auto-stop typing after 3 seconds
    if (isTyping) {
      this.typingTimeout = setTimeout(() => {
        this.sendTypingIndicator(conversationId, false);
      }, 3000);
    }
  }

  // Mark message as read
  markMessageAsRead(conversationId: string, messageId: string) {
    if (!this.connected || !this.currentUser) return;

    if (this.useSupabaseRealtime) {
      // For Supabase Realtime, we could implement read receipts via a separate table
      // For now, we'll skip this feature in fallback mode
      return;
    }

    console.log(`👁️ Marking message as read: ${messageId}`);
    this.socket?.emit('mark_message_read', {
      conversationId,
      messageId,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
    });
  }

  // Add reaction to message
  addReaction(conversationId: string, messageId: string, emoji: string) {
    if (!this.connected || !this.currentUser) return;

    if (this.useSupabaseRealtime) {
      // For Supabase Realtime, we could implement reactions via a separate table
      // For now, we'll skip this feature in fallback mode
      return;
    }

    console.log(`😀 Adding reaction ${emoji} to message: ${messageId}`);
    this.socket?.emit('add_reaction', {
      conversationId,
      messageId,
      emoji,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
    });
  }

  // Update online status
  updateOnlineStatus(conversationId: string, isOnline: boolean) {
    if (!this.connected || !this.currentUser) return;

    if (this.useSupabaseRealtime) {
      // For Supabase Realtime, we could implement online status via a separate table
      // For now, we'll skip this feature in fallback mode
      return;
    }

    console.log(`🟢 Updating online status: ${isOnline} for ${conversationId}`);
    this.socket?.emit('update_online_status', {
      conversationId,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      isOnline,
    });
  }

  // Notify agent change
  notifyAgentChange(conversationId: string, eventType: string, data: any) {
    if (!this.connected) return;

    if (this.useSupabaseRealtime) {
      // Agent changes are handled automatically via Supabase triggers
      return;
    }

    console.log(`🔔 Notifying agent change for ${conversationId}:`, { eventType, data });
    this.socket?.emit('agent_change', {
      conversationId,
      eventType,
      data,
    });
  }

  // Ensure conversation exists in database
  async ensureConversation(chatbotId: string, sessionId: string): Promise<string> {
    const conversationId = this.generateConversationId(chatbotId, sessionId);
    
    try {
      const { data } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .maybeSingle();

      if (!data) {
        console.log(`🆕 Creating conversation: ${conversationId}`);
        await supabase
          .from('conversations')
          .insert({
            id: conversationId,
            chatbot_id: chatbotId,
            session_id: sessionId,
            user_id: null,
          });
      }
    } catch (error) {
      console.error('Error ensuring conversation:', error);
    }

    return conversationId;
  }

  // Generate consistent conversation ID
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

  // Get connection status
  isConnected(): boolean {
    return this.connected;
  }

  // Get current user info
  getCurrentUser() {
    return this.currentUser;
  }

  // Get current conversation
  getCurrentConversation() {
    return this.currentConversation;
  }

  // Get connection type
  getConnectionType(): 'socket' | 'supabase' {
    return this.useSupabaseRealtime ? 'supabase' : 'socket';
  }
}

// Export singleton instance
export const socketChatManager = new SocketChatManager();