import { useState, useEffect } from 'react';
import { supabase, KnowledgeBase, Document } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useKnowledgeBases = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchKnowledgeBases = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('knowledge_bases')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKnowledgeBases(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch knowledge bases');
    } finally {
      setLoading(false);
    }
  };

  const createKnowledgeBase = async (name: string, description?: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { data, error } = await supabase
        .from('knowledge_bases')
        .insert([
          {
            user_id: user.id,
            name,
            description: description || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setKnowledgeBases(prev => [data, ...prev]);
      return data;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create knowledge base');
    }
  };

  const updateKnowledgeBase = async (id: string, updates: Partial<KnowledgeBase>) => {
    try {
      const { data, error } = await supabase
        .from('knowledge_bases')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setKnowledgeBases(prev => prev.map(kb => kb.id === id ? { ...kb, ...data } : kb));
      return data;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update knowledge base');
    }
  };

  const deleteKnowledgeBase = async (id: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_bases')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setKnowledgeBases(prev => prev.filter(kb => kb.id !== id));
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete knowledge base');
    }
  };

  const getKnowledgeBaseDocuments = async (knowledgeBaseId: string): Promise<Document[]> => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('knowledge_base_id', knowledgeBaseId)
        .eq('status', 'processed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching knowledge base documents:', err);
      return [];
    }
  };

  useEffect(() => {
    fetchKnowledgeBases();
  }, [user?.id]);

  return {
    knowledgeBases,
    loading,
    error,
    createKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
    getKnowledgeBaseDocuments,
    refetch: fetchKnowledgeBases,
  };
};