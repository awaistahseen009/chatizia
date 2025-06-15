/*
  # Fix Agent Messaging and Real-time Communication

  1. Updates
    - Fix add_session_message function parameter order
    - Ensure proper RLS policies for real-time messaging
    - Add proper indexes for performance
    - Fix agent notification system

  2. Security
    - Maintain proper RLS policies
    - Ensure agents can only access their assigned conversations
*/

-- Drop and recreate the add_session_message function with correct parameter order
DROP FUNCTION IF EXISTS add_session_message(UUID, TEXT, TEXT, TEXT, UUID);

-- Create the add_session_message function with the correct parameter order that matches the frontend calls
CREATE OR REPLACE FUNCTION add_session_message(
  chatbot_id_param UUID,
  session_id_param TEXT,
  content_param TEXT,
  role_param TEXT,
  agent_id_param UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conversation_id_hash TEXT;
  conversation_record_id UUID;
  message_id UUID;
  chatbot_record RECORD;
BEGIN
  -- Get chatbot information
  SELECT * INTO chatbot_record FROM chatbots WHERE id = chatbot_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chatbot not found';
  END IF;

  -- Generate consistent conversation ID from chatbot_id and session_id
  conversation_id_hash := encode(digest(chatbot_id_param::text || '_session_' || session_id_param, 'sha256'), 'hex');
  conversation_record_id := (substring(conversation_id_hash from 1 for 8) ||
                           '-' || substring(conversation_id_hash from 9 for 4) ||
                           '-4' || substring(conversation_id_hash from 13 for 3) ||
                           '-' || substring(conversation_id_hash from 16 for 4) ||
                           '-' || substring(conversation_id_hash from 20 for 12))::UUID;

  -- Create conversation record if it doesn't exist
  INSERT INTO conversations (id, chatbot_id, session_id, created_at, updated_at)
  VALUES (conversation_record_id, chatbot_id_param, session_id_param, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

  -- Insert the message
  INSERT INTO messages (conversation_id, content, role, agent_id, created_at)
  VALUES (conversation_record_id, content_param, role_param, agent_id_param, NOW())
  RETURNING id INTO message_id;

  RETURN message_id;
END;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION add_session_message(UUID, TEXT, TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION add_session_message(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- Ensure agent_notifications table exists with proper structure
CREATE TABLE IF NOT EXISTS agent_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('escalation', 'new_message', 'manual_request')),
  message text NOT NULL,
  is_read boolean DEFAULT false,
  chatbot_name text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on agent_notifications
ALTER TABLE agent_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate them for agent_notifications
DROP POLICY IF EXISTS "Agents can manage their own notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Agents can read their own notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Agents can update their own notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Allow creating notifications" ON agent_notifications;

-- Create proper RLS policies for agent_notifications
CREATE POLICY "Agents can read their own notifications"
  ON agent_notifications
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = agent_notifications.agent_id
    )
  );

CREATE POLICY "Agents can update their own notifications"
  ON agent_notifications
  FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = agent_notifications.agent_id
    )
  );

CREATE POLICY "Allow creating notifications"
  ON agent_notifications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can manage notifications for their agents"
  ON agent_notifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = agent_notifications.agent_id 
      AND agents.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = agent_notifications.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

-- Update message policies for proper real-time access
DROP POLICY IF EXISTS "Public can read messages for active chatbot sessions" ON messages;
DROP POLICY IF EXISTS "Public can insert messages for active chatbot sessions" ON messages;
DROP POLICY IF EXISTS "Agents can read messages from assigned conversations" ON messages;
DROP POLICY IF EXISTS "Agents can insert messages for assigned conversations" ON messages;

-- Create comprehensive message policies
CREATE POLICY "Public can read messages for active chatbot sessions"
  ON messages
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN chatbots cb ON c.chatbot_id = cb.id
      WHERE c.id = messages.conversation_id 
      AND cb.status = 'active'
      AND c.session_id IS NOT NULL
    )
  );

CREATE POLICY "Public can insert messages for active chatbot sessions"
  ON messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN chatbots cb ON c.chatbot_id = cb.id
      WHERE c.id = messages.conversation_id 
      AND cb.status = 'active'
      AND c.session_id IS NOT NULL
    )
  );

-- Update conversation_agents policies for real-time
DROP POLICY IF EXISTS "Allow agent conversation assignment" ON conversation_agents;
DROP POLICY IF EXISTS "Allow updating conversation agents" ON conversation_agents;

CREATE POLICY "Allow agent conversation assignment"
  ON conversation_agents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow updating conversation agents"
  ON conversation_agents
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow reading conversation agents"
  ON conversation_agents
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Ensure proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_id ON agent_notifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_conversation_id ON agent_notifications(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_created_at ON agent_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_is_read ON agent_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_agents_conversation_id ON conversation_agents(conversation_id);

-- Grant necessary permissions for real-time functionality
GRANT SELECT, INSERT, UPDATE ON agent_notifications TO anon;
GRANT SELECT, INSERT, UPDATE ON agent_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_agents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_agents TO authenticated;
GRANT SELECT, INSERT ON messages TO anon;
GRANT SELECT, INSERT ON messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON conversations TO anon;
GRANT SELECT, INSERT, UPDATE ON conversations TO authenticated;
GRANT SELECT ON agents TO anon;
GRANT SELECT ON agents TO authenticated;
GRANT SELECT ON chatbots TO anon;
GRANT SELECT ON chatbots TO authenticated;

-- Ensure the RPC function can be called by all users
GRANT EXECUTE ON FUNCTION add_session_message TO anon;
GRANT EXECUTE ON FUNCTION add_session_message TO authenticated;