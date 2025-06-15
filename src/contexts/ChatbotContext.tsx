import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Chatbot } from '../lib/supabase';
import { useChatbots } from '../hooks/useChatbots';

interface ChatbotContextType {
  chatbots: Chatbot[];
  selectedBot: Chatbot | null;
  loading: boolean;
  error: string | null;
  setSelectedBot: (bot: Chatbot | null) => void;
  addChatbot: (bot: Omit<Chatbot, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'conversations_count' | 'messages_this_month' | 'response_time'>) => Promise<void>;
  updateChatbot: (id: string, updates: Partial<Chatbot>) => Promise<void>;
  deleteChatbot: (id: string) => Promise<void>;
  refetchChatbots: () => void;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export const ChatbotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { chatbots, loading, error, createChatbot, updateChatbot, deleteChatbot, refetch } = useChatbots();
  const [selectedBot, setSelectedBot] = useState<Chatbot | null>(null);

  // Set first chatbot as selected when chatbots load
  useEffect(() => {
    if (chatbots.length > 0 && !selectedBot) {
      setSelectedBot(chatbots[0]);
    }
  }, [chatbots, selectedBot]);

  const addChatbot = async (botData: Omit<Chatbot, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'conversations_count' | 'messages_this_month' | 'response_time'>) => {
    try {
      const newBot = await createChatbot(botData);
      if (newBot) {
        setSelectedBot(newBot);
      }
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateChatbot = async (id: string, updates: Partial<Chatbot>) => {
    try {
      await updateChatbot(id, updates);
      // Update selected bot if it's the one being updated
      if (selectedBot?.id === id) {
        setSelectedBot(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteChatbot = async (id: string) => {
    try {
      await deleteChatbot(id);
      // Clear selected bot if it's the one being deleted
      if (selectedBot?.id === id) {
        setSelectedBot(null);
      }
    } catch (err) {
      throw err;
    }
  };

  return (
    <ChatbotContext.Provider
      value={{
        chatbots,
        selectedBot,
        loading,
        error,
        setSelectedBot,
        addChatbot,
        updateChatbot: handleUpdateChatbot,
        deleteChatbot: handleDeleteChatbot,
        refetchChatbots: refetch,
      }}
    >
      {children}
    </ChatbotContext.Provider>
  );
};

export const useChatbot = () => {
  const context = useContext(ChatbotContext);
  if (context === undefined) {
    throw new Error('useChatbot must be used within a ChatbotProvider');
  }
  return context;
};