import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Supabase Configuration Check:');
console.log('📍 URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING');
console.log('🔑 Anon Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Expected variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
  throw new Error('Missing Supabase environment variables');
}

// Validate URL format
try {
  new URL(supabaseUrl);
  console.log('✅ Supabase URL format is valid');
} catch (error) {
  console.error('❌ Invalid Supabase URL format:', supabaseUrl);
  throw new Error('Invalid Supabase URL format');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'chatbot-app'
    }
  }
});

// Test connection on initialization
const testConnection = async () => {
  try {
    console.log('🔍 Testing Supabase connection...');
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.error('❌ Supabase connection test failed:', error.message);
    } else {
      console.log('✅ Supabase connection test successful');
    }
  } catch (error) {
    console.error('❌ Supabase connection test error:', error);
  }
};

// Run connection test in development
if (import.meta.env.DEV) {
  testConnection();
}

// Database types matching your existing schema
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  subscription_status: 'free' | 'starter' | 'pro' | 'enterprise';
  created_at: string;
  last_login: string | null;
  email_verified: boolean;
}

export interface KnowledgeBase {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chatbot {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive' | 'training';
  knowledge_base_id: string | null;
  configuration: {
    primaryColor?: string;
    position?: string;
    welcomeMessage?: string;
    personality?: string;
    template?: string;
    selectedDocuments?: string[];
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
  // Computed fields for UI
  conversations_count?: number;
  messages_this_month?: number;
  response_time?: string;
}

export interface Document {
  id: string;
  user_id: string;
  chatbot_id: string | null;
  knowledge_base_id: string | null;
  filename: string;
  file_size: number;
  file_type: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  processed_at: string | null;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  user_id: string;
  chunk_text: string;
  embedding: number[];
  chunk_index: number;
  created_at: string;
  updated_at: string;
  similarity?: number;
}

export interface Conversation {
  id: string;
  chatbot_id: string;
  user_id: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
}

export interface Analytics {
  total_conversations: number;
  total_messages: number;
  unique_users: number;
  avg_response_time: number;
  conversations_today: number;
  messages_today: number;
  top_questions: Array<{
    question: string;
    count: number;
  }>;
  geographic_data: Array<{
    country: string;
    users: number;
  }>;
}