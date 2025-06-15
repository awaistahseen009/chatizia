-- Fix agent messaging and conversation handling

-- Drop existing function if it exists (with all possible signatures)
DROP FUNCTION IF EXISTS add_session_message(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS add_session_message(UUID, TEXT, TEXT, TEXT, UUID);

-- Create the add_session_message function to handle agent takeover properly
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

-- Drop existing get_public_chatbot function if it exists
DROP FUNCTION IF EXISTS get_public_chatbot(UUID);

-- Create function to get public chatbot with proper joins
CREATE OR REPLACE FUNCTION get_public_chatbot(chatbot_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', c.id,
    'name', c.name,
    'description', c.description,
    'status', c.status,
    'configuration', c.configuration,
    'knowledge_base_id', c.knowledge_base_id,
    'chatbot_id', c.id
  ) INTO result
  FROM chatbots c
  WHERE c.id = chatbot_id_param AND c.status = 'active';
  
  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_public_chatbot(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_public_chatbot(UUID) TO authenticated;

-- Update RLS policies to ensure proper access for agent messaging
DROP POLICY IF EXISTS "Allow conversation creation for active chatbots" ON conversations;
CREATE POLICY "Allow conversation creation for active chatbots"
  ON conversations
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chatbots 
      WHERE chatbots.id = conversations.chatbot_id 
      AND chatbots.status = 'active'
    )
  );

-- Update message policies to allow proper agent messaging
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

-- Ensure proper indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_chatbot_id_session ON conversations(chatbot_id, session_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);

-- Drop existing get_agent_assignments function if it exists
DROP FUNCTION IF EXISTS get_agent_assignments(UUID);

-- Create function to get chatbot assignments with proper joins
CREATE OR REPLACE FUNCTION get_agent_assignments(agent_id_param UUID)
RETURNS TABLE (
  id UUID,
  agent_id UUID,
  chatbot_id UUID,
  created_at TIMESTAMPTZ,
  chatbot_name TEXT,
  chatbot_configuration JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aa.id,
    aa.agent_id,
    aa.chatbot_id,
    aa.created_at,
    c.name as chatbot_name,
    c.configuration as chatbot_configuration
  FROM agent_assignments aa
  JOIN chatbots c ON aa.chatbot_id = c.id
  WHERE aa.agent_id = agent_id_param;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_agent_assignments(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_agent_assignments(UUID) TO authenticated;

-- Update agent assignment policies to include chatbot information
DROP POLICY IF EXISTS "Users can manage assignments for their agents" ON agent_assignments;
CREATE POLICY "Users can manage assignments for their agents"
  ON agent_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = agent_assignments.agent_id 
      AND agents.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = agent_assignments.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

-- Ensure conversation_agents table has proper policies for agent access
DROP POLICY IF EXISTS "Users can manage conversation assignments for their agents" ON conversation_agents;
CREATE POLICY "Users can manage conversation assignments for their agents"
  ON conversation_agents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = conversation_agents.agent_id 
      AND agents.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = conversation_agents.agent_id 
      AND agents.user_id = auth.uid()
    )
  );

-- Add policy for agents to read their own assignments
DROP POLICY IF EXISTS "Agents can read their own assignments" ON agent_assignments;
CREATE POLICY "Agents can read their own assignments"
  ON agent_assignments
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = agent_assignments.agent_id
    )
  );

-- Add policy for agents to read assigned conversations
DROP POLICY IF EXISTS "Agents can read assigned conversations" ON conversation_agents;
CREATE POLICY "Agents can read assigned conversations"
  ON conversation_agents
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = conversation_agents.agent_id
    )
  );

-- Ensure messages can be read by agents handling the conversation
DROP POLICY IF EXISTS "Agents can read messages from assigned conversations" ON messages;
CREATE POLICY "Agents can read messages from assigned conversations"
  ON messages
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM conversation_agents ca
      WHERE ca.conversation_id = messages.conversation_id
    ) OR
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN chatbots cb ON c.chatbot_id = cb.id
      WHERE c.id = messages.conversation_id 
      AND cb.status = 'active'
      AND c.session_id IS NOT NULL
    )
  );

-- Allow agents to insert messages for assigned conversations
DROP POLICY IF EXISTS "Agents can insert messages for assigned conversations" ON messages;
CREATE POLICY "Agents can insert messages for assigned conversations"
  ON messages
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_agents ca
      WHERE ca.conversation_id = messages.conversation_id 
      AND ca.agent_id = messages.agent_id
    ) OR
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN chatbots cb ON c.chatbot_id = cb.id
      WHERE c.id = messages.conversation_id 
      AND cb.status = 'active'
      AND c.session_id IS NOT NULL
    )
  );