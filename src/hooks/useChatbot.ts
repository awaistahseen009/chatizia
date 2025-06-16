import { useState, useEffect } from 'react';
import { useDocuments } from './useDocuments';
import { generateChatResponse, ChatMessage } from '../lib/openai';
import { analyzeSentiment, SentimentResult } from '../lib/sentimentAnalysis';
import { Chatbot } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { realtimeService } from '../lib/realtime';

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

  // Check if conversation has been taken over by an agent
  useEffect(() => {
    if (currentSessionId && chatbot) {
      checkAgentTakeover();
    }
  }, [currentSessionId, chatbot]);

  const checkAgentTakeover = async () => {
    if (!currentSessionId || !chatbot) return;

    try {
      const conversationId = generateConversationId(chatbot.id, currentSessionId);
      
      console.log('🔍 Checking agent takeover for conversation:', conversationId);

      // First check if we have a conversation record for this session
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('id, chatbot_id, session_id')
        .eq('chatbot_id', chatbot.id)
        .eq('session_id', currentSessionId)
        .maybeSingle();

      if (convError && convError.code !== 'PGRST116') {
        console.error('Error checking conversation:', convError);
        return;
      }

      let actualConversationId = conversationId;

      // If no conversation exists, create one
      if (!conversation) {
        console.log('🆕 Creating new conversation record');
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            id: conversationId,
            chatbot_id: chatbot.id,
            session_id: currentSessionId,
            user_id: null // Anonymous conversation
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating conversation:', createError);
          return;
        }
        actualConversationId = newConv.id;
      } else {
        actualConversationId = conversation.id;
      }

      // Check for agent assignment
      const { data: agentAssignment, error } = await supabase
        .from('conversation_agents')
        .select(`
          *,
          agents(*)
        `)
        .eq('conversation_id', actualConversationId)
        .maybeSingle();

      // Don't log error if no assignment found - this is normal
      if (error && error.code !== 'PGRST116') {
        console.error('Error checking agent takeover:', error);
        return;
      }

      if (agentAssignment) {
        console.log('🤝 Agent has taken over conversation:', agentAssignment.agents.name);
        setAgentTakenOver(true);
        setAssignedAgent(agentAssignment.agents);
        
        // Set up real-time subscription for this conversation
        realtimeService.subscribeNewMessage(actualConversationId, (data) => {
          if (data.message.role === 'assistant' && data.message.agent_id) {
            const newMessage: ChatbotMessage = {
              id: data.message.id,
              text: data.message.content,
              sender: 'agent',
              timestamp: new Date(data.message.created_at),
            };
            
            setMessages(prev => {
              // Check if message already exists
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              return [...prev, newMessage];
            });
          }
        });
        
        // Add agent takeover message if not already added
        setMessages(prev => {
          const hasAgentMessage = prev.some(msg => msg.id.startsWith('agent-takeover'));
          if (!hasAgentMessage) {
            const agentMessage: ChatbotMessage = {
              id: `agent-takeover-${Date.now()}`,
              text: `Hello! I'm ${agentAssignment.agents.name}, a human agent. I've taken over this conversation to provide you with personalized assistance. How can I help you?`,
              sender: 'agent',
              timestamp: new Date(),
            };
            return [...prev, agentMessage];
          }
          return prev;
        });
      } else {
        // Check if agent was removed (handed back to bot)
        if (agentTakenOver) {
          console.log('🤖 Conversation handed back to bot');
          setAgentTakenOver(false);
          setAssignedAgent(null);
          
          // Unsubscribe from real-time updates
          realtimeService.unsubscribe(`messages-${actualConversationId}`);
          
          // Add handback message
          const handbackMessage: ChatbotMessage = {
            id: `handback-${Date.now()}`,
            text: "Thank you for your patience. I'm handing you back to our AI assistant who can continue to help you with your questions.",
            sender: 'agent',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, handbackMessage]);
        }
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
      await checkAgentTakeover();

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

      // If chatbot has a knowledge base, search for relevant chunks
      if (chatbot.knowledge_base_id) {
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

      // Add bot response to UI
      const botMessage: ChatbotMessage = {
        id: `bot-${Date.now()}`,
        text: response.message,
        sender: 'bot',
        timestamp: new Date(),
        sources: response.sources || sources,
      };

      setMessages(prev => [...prev, botMessage]);

      // Store bot message
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
    } finally {
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
      console.log('🔄 Using session ID from props:', chatbot.currentSessionId);
    } else {
      // Reset session
      setCurrentSessionId(null);
    }
    
    setSentimentHistory([]);
    setIsEscalated(false);
    setAgentTakenOver(false);
    setAssignedAgent(null);
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setSentimentHistory([]);
    setIsEscalated(false);
    setAgentTakenOver(false);
    setAssignedAgent(null);
  };

  return {
    messages,
    isTyping,
    sentimentHistory,
    isEscalated,
    agentTakenOver,
    assignedAgent,
    sendMessage,
    initializeChat,
    clearChat,
  };
};