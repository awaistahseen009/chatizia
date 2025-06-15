-- Final fixes for agent messaging system

-- Ensure agent_id column exists in messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN agent_id uuid REFERENCES agents(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added agent_id column to messages table';
  ELSE
    RAISE NOTICE 'agent_id column already exists in messages table';
  END IF;
END $$;

-- Ensure knowledge_base_enabled column exists in conversation_agents table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_agents' AND column_name = 'knowledge_base_enabled'
  ) THEN
    ALTER TABLE conversation_agents ADD COLUMN knowledge_base_enabled boolean DEFAULT true;
    RAISE NOTICE 'Added knowledge_base_enabled column to conversation_agents table';
  ELSE
    RAISE NOTICE 'knowledge_base_enabled column already exists in conversation_agents table';
  END IF;
END $$;

-- Fix add_session_message function to handle agent_id properly
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

-- Ensure proper RLS policies for real-time messaging
DO $$
BEGIN
  -- Drop existing policies to avoid conflicts
  DROP POLICY IF EXISTS "Public can read messages for active chatbot sessions" ON messages;
  DROP POLICY IF EXISTS "Public can insert messages for active chatbot sessions" ON messages;
  
  -- Create new policies with proper permissions
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
    
  -- Ensure agent policies are properly set
  DROP POLICY IF EXISTS "Allow agent conversation assignment" ON conversation_agents;
  CREATE POLICY "Allow agent conversation assignment"
    ON conversation_agents
    FOR INSERT
    TO public
    WITH CHECK (true);
    
  DROP POLICY IF EXISTS "Allow updating conversation agents" ON conversation_agents;
  CREATE POLICY "Allow updating conversation agents"
    ON conversation_agents
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);
    
  DROP POLICY IF EXISTS "Allow reading conversation agents" ON conversation_agents;
  CREATE POLICY "Allow reading conversation agents"
    ON conversation_agents
    FOR SELECT
    TO public
    USING (true);
    
EXCEPTION WHEN OTHERS THEN
  -- Log error but continue
  RAISE NOTICE 'Error updating policies: %', SQLERRM;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_agents_conversation_id ON conversation_agents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_agents_knowledge_base_enabled ON conversation_agents(knowledge_base_enabled);
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_chatbot_id_session ON conversations(chatbot_id, session_id);

-- Grant necessary permissions for real-time functionality
GRANT SELECT, INSERT, UPDATE ON agent_notifications TO public;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_agents TO public;
GRANT SELECT, INSERT ON messages TO public;
GRANT SELECT, INSERT, UPDATE ON conversations TO public;
GRANT SELECT ON agents TO public;
GRANT SELECT ON chatbots TO public;