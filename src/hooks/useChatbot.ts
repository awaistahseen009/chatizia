import { useState, useEffect } from 'react';
import { useDocuments } from './useDocuments';
import { generateChatResponse, ChatMessage } from '../lib/openai';
import { analyzeSentiment, SentimentResult } from '../lib/sentimentAnalysis';
import { Chatbot } from '../lib/supabase';
import { supabase } from '../lib/supabase';

export interface ChatbotMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'agent';
  timestamp: Date;
  sources?: string[];
}

export const useChatbot = (chatbot: Chatbot | null) => {
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sentimentHistory, setSentimentHistory] = useState<SentimentResult[]>([]);
  const [isEscalated, setIsEscalated] = useState(false);
  const [agentTakenOver, setAgentTakenOver] = useState(false);
  const [assignedAgent, setAssignedAgent] = useState<any>(null);
  const [knowledgeBaseEnabled, setKnowledgeBaseEnabled] = useState(true);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const { fetchSimilarChunks } = useDocuments();

  // Helper function to generate a proper UUID v4
  const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Helper function to generate conversation ID from chatbot and session
  const generateConversationId = (chatbotId: string, sessionId: string): string => {
    // Create a deterministic conversation ID based on chatbot and session
    const combined = `${chatbotId}_${sessionId}`;
    
    // Use a simple hash to create a consistent identifier
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to hex and pad to ensure consistent length
    const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
    
    // Create a proper UUID v4 format using the hash
    return `${hashHex.substring(0, 8)}-${hashHex.substring(0, 4)}-4${hashHex.substring(1, 4)}-8${hashHex.substring(0, 3)}-${hashHex}${hashHex}`.substring(0, 36);
  };

  // Set up real-time subscriptions for messages and agent interventions
  useEffect(() => {
    if (!chatbot || !currentSessionId || !currentConversationId) return;

    console.log('🔄 Setting up real-time subscriptions for conversation:', currentConversationId);

    // Subscribe to new messages in this conversation
    const messageChannel = supabase
      .channel(`messages-${currentConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${currentConversationId}`,
        },
        (payload) => {
          console.log('💬 Real-time message received:', payload.new);
          
          // Only add assistant messages (bot or agent responses) to avoid duplicates
          if (payload.new.role === 'assistant') {
            const newMessage: ChatbotMessage = {
              id: payload.new.id,
              text: payload.new.content,
              sender: payload.new.agent_id ? 'agent' : 'bot',
              timestamp: new Date(payload.new.created_at),
            };

            setMessages(prev => {
              // Check if message already exists to avoid duplicates
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) {
                console.log('💬 Message already exists, skipping duplicate');
                return prev;
              }
              
              console.log('💬 Adding new real-time message:', newMessage);
              return [...prev, newMessage];
            });

            // Stop typing indicator when we receive a response
            setIsTyping(false);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Messages channel status: ${status}`);
      });

    // Subscribe to agent interventions (conversation_agents table)
    const agentChannel = supabase
      .channel(`agent-intervention-${currentConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_agents',
          filter: `conversation_id=eq.${currentConversationId}`,
        },
        async (payload) => {
          console.log('🔔 Agent intervention detected:', payload.new);
          
          try {
            // Fetch agent details
            const { data: agent, error } = await supabase
              .from('agents')
              .select('id, name, email, agent_id')
              .eq('id', payload.new.agent_id)
              .single();
            
            if (error) {
              console.error('Failed to fetch agent:', error);
              return;
            }
            
            console.log('🤝 Agent has taken over conversation:', agent.name);
            setAgentTakenOver(true);
            setAssignedAgent(agent);
            setKnowledgeBaseEnabled(payload.new.knowledge_base_enabled || false);
            
            // Add agent takeover message
            const agentMessage: ChatbotMessage = {
              id: `agent-takeover-${Date.now()}`,
              text: `Hello! I'm ${agent.name}, a human agent. I've taken over this conversation to provide you with personalized assistance. How can I help you?`,
              sender: 'agent',
              timestamp: new Date(),
            };
            
            setMessages(prev => {
              const hasAgentMessage = prev.some(msg => msg.id.startsWith('agent-takeover'));
              if (!hasAgentMessage) {
                return [...prev, agentMessage];
              }
              return prev;
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
          filter: `conversation_id=eq.${currentConversationId}`,
        },
        () => {
          console.log('🤖 Agent handed conversation back to bot');
          setAgentTakenOver(false);
          setAssignedAgent(null);
          setKnowledgeBaseEnabled(true); // Re-enable knowledge base
          
          // Add handback message
          const handbackMessage: ChatbotMessage = {
            id: `handback-${Date.now()}`,
            text: "Thank you for your patience. I'm handing you back to our AI assistant who can continue to help you with your questions.",
            sender: 'agent',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, handbackMessage]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_agents',
          filter: `conversation_id=eq.${currentConversationId}`,
        },
        (payload) => {
          console.log('🧠 Knowledge base toggle detected:', payload.new);
          setKnowledgeBaseEnabled(payload.new.knowledge_base_enabled || false);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Agent intervention channel status: ${status}`);
      });

    return () => {
      console.log('🔄 Cleaning up real-time subscriptions');
      messageChannel.unsubscribe();
      agentChannel.unsubscribe();
    };
  }, [chatbot?.id, currentSessionId, currentConversationId]);

  // Check for existing agent intervention when conversation starts
  const checkAgentTakeover = async (conversationId: string) => {
    try {
      console.log('🔍 Checking for existing agent takeover:', conversationId);

      // Check for agent assignment
      const { data: agentAssignment, error } = await supabase
        .from('conversation_agents')
        .select(`
          *,
          agents(*),
          knowledge_base_enabled
        `)
        .eq('conversation_id', conversationId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking agent takeover:', error);
        return;
      }

      if (agentAssignment) {
        console.log('🤝 Existing agent takeover found:', agentAssignment.agents.name);
        setAgentTakenOver(true);
        setAssignedAgent(agentAssignment.agents);
        setKnowledgeBaseEnabled(agentAssignment.knowledge_base_enabled || false);
      } else {
        console.log('🤖 No agent takeover detected');
        setAgentTakenOver(false);
        setAssignedAgent(null);
        setKnowledgeBaseEnabled(true);
      }
    } catch (error) {
      console.error('Error checking agent takeover:', error);
    }
  };

  const sendMessage = async (userMessage: string): Promise<void> => {
    if (!chatbot) return;

    // Add user message to UI immediately
    const userChatMessage: ChatbotMessage = {
      id: `user-${Date.now()}`,
      text: userMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userChatMessage]);
    setIsTyping(true);

    try {
      // Create session ID if it doesn't exist
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        setCurrentSessionId(sessionId);
        console.log('🔄 Created new session:', sessionId);
      }

      // Generate conversation ID
      const conversationId = generateConversationId(chatbot.id, sessionId);
      
      // Set conversation ID if not already set
      if (!currentConversationId) {
        setCurrentConversationId(conversationId);
      }

      // Ensure conversation exists
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .maybeSingle();

      if (!existingConv) {
        console.log('🆕 Creating conversation record');
        await supabase
          .from('conversations')
          .insert({
            id: conversationId,
            chatbot_id: chatbot.id,
            session_id: sessionId,
            user_id: null
          });
      }

      // Store user message
      console.log('💾 Storing user message...');
      const { data: userMessageData, error: userMessageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: userMessage,
          role: 'user'
        })
        .select()
        .single();

      if (userMessageError) {
        console.error('❌ Failed to store user message:', userMessageError);
        throw new Error('Failed to store user message');
      }

      console.log('✅ User message stored successfully');

      // Check for agent takeover BEFORE processing sentiment or generating responses
      await checkAgentTakeover(conversationId);

      // If agent has taken over, don't generate automatic responses or analyze sentiment
      if (agentTakenOver) {
        console.log('🤖 Agent has taken over - skipping AI processing');
        setIsTyping(false);
        return;
      }

      // Only analyze sentiment and generate responses if no agent has taken over
      console.log('🤖 No agent takeover detected, proceeding with AI response');

      // Analyze sentiment of the last 5 messages (including current one) - only if not escalated
      const recentMessages = [...messages.slice(-4), userChatMessage]
        .filter(msg => msg.sender === 'user')
        .map(msg => msg.text);

      if (recentMessages.length > 0 && !isEscalated && !agentTakenOver) {
        console.log('🔍 Analyzing sentiment for escalation...');
        const sentimentResult = await analyzeSentiment(recentMessages);
        setSentimentHistory(prev => [...prev.slice(-4), sentimentResult]);

        console.log('📊 Sentiment analysis result:', sentimentResult);

        // Check if escalation is needed
        if (sentimentResult.shouldEscalate) {
          console.log('🚨 Escalating conversation to human agent...');
          await escalateToHumanAgent(conversationId);
          setIsEscalated(true);
          
          // Add escalation message
          const escalationMessage: ChatbotMessage = {
            id: `escalation-${Date.now()}`,
            text: "I understand you're having some difficulties. I'm connecting you with one of our human agents who will be able to better assist you. Please hold on for a moment.",
            sender: 'bot',
            timestamp: new Date(),
          };
          
          setMessages(prev => [...prev, escalationMessage]);
          setIsTyping(false);
          return;
        }
      }

      let context = '';
      let sources: string[] = [];

      // If chatbot has a knowledge base AND knowledge base is enabled, search for relevant chunks
      if (chatbot.knowledge_base_id && knowledgeBaseEnabled) {
        console.log('🔍 Searching knowledge base for relevant content...');
        const similarChunks = await fetchSimilarChunks(userMessage, 3, chatbot.id);
        
        if (similarChunks.length > 0) {
          context = similarChunks
            .map(chunk => chunk.chunk_text)
            .join('\n\n');
          
          sources = similarChunks.map(chunk => `Document chunk ${chunk.chunk_index + 1}`);
          console.log(`✅ Found ${similarChunks.length} relevant chunks`);
        } else {
          console.log('ℹ️ No relevant chunks found in knowledge base');
        }
      } else if (!knowledgeBaseEnabled) {
        console.log('🚫 Knowledge base disabled - agent has taken over');
      }

      // Prepare chat history for context
      const chatHistory: ChatMessage[] = messages
        .slice(-5) // Last 5 messages for context
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));

      // Add current user message
      chatHistory.push({
        role: 'user',
        content: userMessage
      });

      // Generate response using OpenAI
      console.log('🤖 Generating AI response...');
      const response = await generateChatResponse(chatHistory, context);

      // Store bot message first, then add to UI
      console.log('💾 Storing bot message...');
      const { data: botMessageData, error: botMessageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: response.message,
          role: 'assistant'
        })
        .select()
        .single();

      if (botMessageError) {
        console.error('❌ Failed to store bot message:', botMessageError);
        // Don't throw error here as the user already sees the response
      } else {
        console.log('✅ Bot response stored successfully');
      }

      // The real-time subscription will handle adding the message to the UI
      // But we'll add it locally as a fallback in case real-time is delayed
      setTimeout(() => {
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === botMessageData?.id);
          if (!exists && botMessageData) {
            const botMessage: ChatbotMessage = {
              id: botMessageData.id,
              text: response.message,
              sender: 'bot',
              timestamp: new Date(botMessageData.created_at),
              sources: response.sources || sources,
            };
            return [...prev, botMessage];
          }
          return prev;
        });
        setIsTyping(false);
      }, 1000); // 1 second fallback

    } catch (error) {
      console.error('❌ Error generating bot response:', error);
      
      // Add error message
      const errorMessage: ChatbotMessage = {
        id: `bot-error-${Date.now()}`,
        text: "I apologize, but I'm experiencing some technical difficulties. Please try again later.",
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
      setIsTyping(false);
    }
  };

  const escalateToHumanAgent = async (conversationId: string) => {
    try {
      // Find an available agent assigned to this chatbot
      const { data: assignments, error: assignmentError } = await supabase
        .from('agent_assignments')
        .select(`
          agent_id,
          agents(*)
        `)
        .eq('chatbot_id', chatbot?.id)
        .limit(1);

      if (assignmentError || !assignments || assignments.length === 0) {
        console.log('⚠️ No agents assigned to this chatbot');
        return;
      }

      // Create notification for the agent
      const { error: notificationError } = await supabase
        .from('agent_notifications')
        .insert([
          {
            agent_id: assignments[0].agent_id,
            conversation_id: conversationId,
            type: 'escalation',
            message: `Customer conversation escalated due to negative sentiment in ${chatbot?.name}`,
            chatbot_name: chatbot?.name,
          },
        ]);

      if (notificationError) {
        console.error('❌ Failed to create notification:', notificationError);
      } else {
        console.log('✅ Escalation notification created');
      }
    } catch (error) {
      console.error('❌ Error during escalation:', error);
    }
  };

  const initializeChat = () => {
    if (!chatbot) return;

    const welcomeMessage: ChatbotMessage = {
      id: 'welcome',
      text: chatbot.configuration?.welcomeMessage || "Hello! I'm your AI assistant. How can I help you today?",
      sender: 'bot',
      timestamp: new Date(),
    };

    setMessages([welcomeMessage]);
    
    // Use session ID from props if available (for embedded mode)
    if (chatbot.currentSessionId) {
      setCurrentSessionId(chatbot.currentSessionId);
      const conversationId = generateConversationId(chatbot.id, chatbot.currentSessionId);
      setCurrentConversationId(conversationId);
      console.log('🔄 Using session ID from props:', chatbot.currentSessionId);
      
      // Check for existing agent takeover
      checkAgentTakeover(conversationId);
    } else {
      // Reset session
      setCurrentSessionId(null);
      setCurrentConversationId(null);
    }
    
    setSentimentHistory([]);
    setIsEscalated(false);
    setAgentTakenOver(false);
    setAssignedAgent(null);
    setKnowledgeBaseEnabled(true);
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setCurrentConversationId(null);
    setSentimentHistory([]);
    setIsEscalated(false);
    setAgentTakenOver(false);
    setAssignedAgent(null);
    setKnowledgeBaseEnabled(true);
  };

  return {
    messages,
    isTyping,
    sentimentHistory,
    isEscalated,
    agentTakenOver,
    assignedAgent,
    knowledgeBaseEnabled,
    sendMessage,
    initializeChat,
    clearChat,
  };
};