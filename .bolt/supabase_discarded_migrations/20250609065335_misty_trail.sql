/*
  # Initial Database Schema

  1. New Tables
    - `users` - User profiles extending Supabase auth
    - `chatbots` - AI chatbot configurations  
    - `documents` - Knowledge base files
    - `conversations` - Chat sessions
    - `messages` - Individual chat messages

  2. Security
    - Enable RLS on all tables
    - Add policies for user data isolation
    - Proper foreign key relationships

  3. Performance
    - Comprehensive indexing
    - Automatic timestamp updates
*/

-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  subscription_status text DEFAULT 'free' NOT NULL CHECK (subscription_status IN ('free', 'starter', 'pro', 'enterprise')),
  created_at timestamptz DEFAULT now() NOT NULL,
  last_login timestamptz,
  email_verified boolean DEFAULT false NOT NULL
);

-- Create chatbots table
CREATE TABLE IF NOT EXISTS public.chatbots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive', 'training')),
  configuration jsonb DEFAULT '{}' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  chatbot_id uuid REFERENCES public.chatbots(id) ON DELETE SET NULL,
  filename text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES public.chatbots(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  session_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Chatbots policies
CREATE POLICY "Users can read own chatbots" ON public.chatbots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chatbots" ON public.chatbots
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chatbots" ON public.chatbots
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chatbots" ON public.chatbots
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Documents policies
CREATE POLICY "Users can read own documents" ON public.documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" ON public.documents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" ON public.documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Conversations policies
CREATE POLICY "Users can read conversations from their chatbots" ON public.conversations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.chatbots 
      WHERE chatbots.id = conversations.chatbot_id 
      AND chatbots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert conversations to their chatbots" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chatbots 
      WHERE chatbots.id = conversations.chatbot_id 
      AND chatbots.user_id = auth.uid()
    )
  );

-- Messages policies
CREATE POLICY "Users can read messages from their chatbot conversations" ON public.messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.conversations 
      JOIN public.chatbots ON chatbots.id = conversations.chatbot_id
      WHERE conversations.id = messages.conversation_id 
      AND chatbots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to their chatbot conversations" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations 
      JOIN public.chatbots ON chatbots.id = conversations.chatbot_id
      WHERE conversations.id = messages.conversation_id 
      AND chatbots.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON public.users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_chatbots_user_id ON public.chatbots(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbots_status ON public.chatbots(status);
CREATE INDEX IF NOT EXISTS idx_chatbots_created_at ON public.chatbots(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_chatbot_id ON public.documents(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_conversations_chatbot_id ON public.conversations(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_chatbots_updated_at ON public.chatbots;
CREATE TRIGGER update_chatbots_updated_at 
  BEFORE UPDATE ON public.chatbots 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at 
  BEFORE UPDATE ON public.conversations 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();