import { useState, useEffect } from 'react';
import { supabase, Chatbot } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useChatbots = () => {
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchChatbots = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('chatbots')
        .select(`
          *,
          knowledge_bases (
            id,
            name,
            description
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to match our interface
      const transformedData = (data || []).map(bot => ({
        ...bot,
        conversations_count: 0, // Placeholder
        messages_this_month: Math.floor(Math.random() * 5000), // Placeholder
        response_time: '0.8s', // Placeholder
        configuration: bot.configuration || {
          primaryColor: '#2563eb',
          position: 'bottom-right',
          welcomeMessage: 'Hello! How can I help you today?',
          personality: 'helpful',
        },
      }));

      setChatbots(transformedData);
    } catch (err) {
      console.error('Error fetching chatbots:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch chatbots');
    } finally {
      setLoading(false);
    }
  };

  const createChatbot = async (chatbotData: Omit<Chatbot, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'conversations_count' | 'messages_this_month' | 'response_time'>) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { data, error } = await supabase
        .from('chatbots')
        .insert([
          {
            user_id: user.id,
            ...chatbotData,
            configuration: chatbotData.configuration || {
              primaryColor: '#2563eb',
              position: 'bottom-right',
              welcomeMessage: 'Hello! How can I help you today?',
              personality: 'helpful',
            },
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      const newBot = {
        ...data,
        conversations_count: 0,
        messages_this_month: 0,
        response_time: '0.8s',
      };
      
      setChatbots(prev => [newBot, ...prev]);
      return newBot;
    } catch (err) {
      console.error('Error creating chatbot:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to create chatbot');
    }
  };

  const updateChatbot = async (id: string, updates: Partial<Chatbot>) => {
    try {
      const { data, error } = await supabase
        .from('chatbots')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setChatbots(prev => prev.map(bot => bot.id === id ? { ...bot, ...data } : bot));
      return data;
    } catch (err) {
      console.error('Error updating chatbot:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to update chatbot');
    }
  };

  const deleteChatbot = async (id: string) => {
    try {
      const { error } = await supabase
        .from('chatbots')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remove from local state
      setChatbots(prev => prev.filter(bot => bot.id !== id));
    } catch (err) {
      console.error('Error deleting chatbot:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to delete chatbot');
    }
  };

  useEffect(() => {
    fetchChatbots();
  }, [user?.id]); // Only depend on user.id to avoid unnecessary re-fetches

  return {
    chatbots,
    loading,
    error,
    createChatbot,
    updateChatbot,
    deleteChatbot,
    refetch: fetchChatbots,
  };
};