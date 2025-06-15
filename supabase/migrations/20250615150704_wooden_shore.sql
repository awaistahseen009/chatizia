-- Fix real-time messaging between agent and embedded chatbot

-- Ensure the add_session_message function works correctly for both bot and agent messages
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

-- Update message policies to ensure proper real-time access
DROP POLICY IF EXISTS "Public can read messages for active chatbot sessions" ON messages;
CREATE POLICY "Public can read messages for active chatbot sessions"
  ON messages
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN chatbots cb ON c.chatbot_id = cb.id
      WHERE c.id = messages.conversation_id 
      AND cb.status = 'active'
      AND c.session_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Public can insert messages for active chatbot sessions" ON messages;
CREATE POLICY "Public can insert messages for active chatbot sessions"
  ON messages
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN chatbots cb ON c.chatbot_id = cb.id
      WHERE c.id = messages.conversation_id 
      AND cb.status = 'active'
      AND c.session_id IS NOT NULL
    )
  );

-- Ensure agents can read and insert messages for their assigned conversations
DROP POLICY IF EXISTS "Agents can read messages from assigned conversations" ON messages;
CREATE POLICY "Agents can read messages from assigned conversations"
  ON messages
  FOR SELECT
  TO public
  USING (
    -- Allow if this is a session-based conversation for an active chatbot
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN chatbots cb ON c.chatbot_id = cb.id
      WHERE c.id = messages.conversation_id 
      AND cb.status = 'active'
      AND c.session_id IS NOT NULL
    )
    OR
    -- Allow if agent is assigned to this conversation
    EXISTS (
      SELECT 1 FROM conversation_agents ca
      WHERE ca.conversation_id = messages.conversation_id
    )
  );

DROP POLICY IF EXISTS "Agents can insert messages for assigned conversations" ON messages;
CREATE POLICY "Agents can insert messages for assigned conversations"
  ON messages
  FOR INSERT
  TO public
  WITH CHECK (
    -- Allow if this is a session-based conversation for an active chatbot
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN chatbots cb ON c.chatbot_id = cb.id
      WHERE c.id = messages.conversation_id 
      AND cb.status = 'active'
      AND c.session_id IS NOT NULL
    )
    OR
    -- Allow if agent is assigned to this conversation
    (messages.agent_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM conversation_agents ca
      WHERE ca.conversation_id = messages.conversation_id 
      AND ca.agent_id = messages.agent_id
    ))
  );

-- Ensure proper indexes for real-time performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_agent_id_conversation_id ON messages(agent_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_agents_conversation_id_agent_id ON conversation_agents(conversation_id, agent_id);

-- Grant necessary permissions for real-time subscriptions
GRANT SELECT ON messages TO anon;
GRANT INSERT ON messages TO anon;
GRANT SELECT ON conversations TO anon;
GRANT INSERT ON conversations TO anon;
GRANT SELECT ON conversation_agents TO anon;
GRANT INSERT ON conversation_agents TO anon;
GRANT SELECT ON chatbots TO anon;

-- Ensure the RPC function can be called by anon users
GRANT EXECUTE ON FUNCTION add_session_message TO anon;
GRANT EXECUTE ON FUNCTION add_session_message TO authenticated;