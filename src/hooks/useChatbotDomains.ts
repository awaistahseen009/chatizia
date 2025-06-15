import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface ChatbotDomain {
  id: string;
  chatbot_id: string;
  domain: string;
  token: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export const useChatbotDomains = (chatbotId?: string) => {
  const [domains, setDomains] = useState<ChatbotDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchDomains = async () => {
    if (!user || !chatbotId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First verify the chatbot belongs to the user
      const { data: chatbot, error: chatbotError } = await supabase
        .from('chatbots')
        .select('id')
        .eq('id', chatbotId)
        .eq('user_id', user.id)
        .single();

      if (chatbotError || !chatbot) {
        throw new Error('Chatbot not found or access denied');
      }

      const { data, error } = await supabase
        .from('chatbot_domains')
        .select('*')
        .eq('chatbot_id', chatbotId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDomains(data || []);
    } catch (err) {
      console.error('Error fetching domains:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch domains');
    } finally {
      setLoading(false);
    }
  };

  const addDomain = async (domain: string) => {
    if (!user || !chatbotId) throw new Error('User not authenticated or chatbot not selected');

    try {
      // Generate a unique token
      const token = `cbt_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

      // Clean domain (remove protocol, www, trailing slash)
      const cleanDomain = domain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
        .toLowerCase();

      // Validate domain format
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
      if (!domainRegex.test(cleanDomain)) {
        throw new Error('Invalid domain format');
      }

      // Check if domain already exists for this chatbot
      const { data: existing } = await supabase
        .from('chatbot_domains')
        .select('id')
        .eq('chatbot_id', chatbotId)
        .eq('domain', cleanDomain)
        .maybeSingle();

      if (existing) {
        throw new Error('Domain already exists for this chatbot');
      }

      const { data, error } = await supabase
        .from('chatbot_domains')
        .insert([
          {
            chatbot_id: chatbotId,
            domain: cleanDomain,
            token: token,
            is_active: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setDomains(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('Error adding domain:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to add domain');
    }
  };

  const updateDomain = async (domainId: string, updates: Partial<ChatbotDomain>) => {
    try {
      const { data, error } = await supabase
        .from('chatbot_domains')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', domainId)
        .select()
        .single();

      if (error) throw error;

      setDomains(prev => prev.map(domain => 
        domain.id === domainId ? { ...domain, ...data } : domain
      ));
      return data;
    } catch (err) {
      console.error('Error updating domain:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to update domain');
    }
  };

  const deleteDomain = async (domainId: string) => {
    try {
      const { error } = await supabase
        .from('chatbot_domains')
        .delete()
        .eq('id', domainId);

      if (error) throw error;

      setDomains(prev => prev.filter(domain => domain.id !== domainId));
    } catch (err) {
      console.error('Error deleting domain:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to delete domain');
    }
  };

  const regenerateToken = async (domainId: string) => {
    try {
      const newToken = `cbt_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      
      return await updateDomain(domainId, { token: newToken });
    } catch (err) {
      console.error('Error regenerating token:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to regenerate token');
    }
  };

  const validateDomainAndToken = async (domain: string, token: string) => {
    try {
      const { data, error } = await supabase
        .from('chatbot_domains')
        .select('*')
        .eq('domain', domain)
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return { isValid: false, domain: null };
      }

      return { isValid: true, domain: data };
    } catch (err) {
      console.error('Error validating domain and token:', err);
      return { isValid: false, domain: null };
    }
  };

  useEffect(() => {
    fetchDomains();
  }, [user?.id, chatbotId]);

  return {
    domains,
    loading,
    error,
    addDomain,
    updateDomain,
    deleteDomain,
    regenerateToken,
    validateDomainAndToken,
    refetch: fetchDomains,
  };
};