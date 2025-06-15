import { useState, useEffect } from 'react';
import { supabase, Analytics } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useAnalytics = () => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchAnalytics = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // For now, return mock data since we don't have conversations table yet
      const analyticsData: Analytics = {
        total_conversations: 0,
        total_messages: 0,
        unique_users: 0,
        avg_response_time: 0.9,
        conversations_today: 0,
        messages_today: 0,
        top_questions: [
          { question: 'How do I reset my password?', count: 156 },
          { question: 'What are your business hours?', count: 134 },
          { question: 'How can I contact support?', count: 98 },
          { question: 'Where can I find pricing information?', count: 87 },
          { question: 'How do I cancel my subscription?', count: 76 },
        ],
        geographic_data: [
          { country: 'United States', users: 445 },
          { country: 'United Kingdom', users: 234 },
          { country: 'Canada', users: 189 },
          { country: 'Germany', users: 156 },
          { country: 'Australia', users: 123 },
        ],
      };

      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [user?.id]); // Only depend on user.id

  return {
    analytics,
    loading,
    error,
    refetch: fetchAnalytics,
  };
};