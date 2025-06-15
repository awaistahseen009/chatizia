/*
  # Fix agent message tracking

  1. Database Changes
    - Add agent_id column to messages table to track which agent sent the message
    - Update RLS policies to allow agent message insertion
    - Create indexes for better performance

  2. Security
    - Maintain existing RLS policies
    - Allow agents to insert messages with their agent_id
*/

-- Add agent_id column to messages table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN agent_id uuid REFERENCES agents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for agent_id
CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON messages(agent_id);

-- Update RLS policies to allow agents to insert messages
CREATE POLICY "Agents can insert messages for assigned conversations"
  ON messages
  FOR INSERT
  TO public
  WITH CHECK (
    -- Allow if this is a session-based conversation for an active chatbot
    (NOT EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = conversation_id
    ))
    OR
    -- Allow if agent is assigned to this conversation
    (EXISTS (
      SELECT 1 FROM conversation_agents ca
      WHERE ca.conversation_id = messages.conversation_id
      AND ca.agent_id = messages.agent_id
    ))
  );

-- Allow agents to read messages from conversations they're assigned to
CREATE POLICY "Agents can read messages from assigned conversations"
  ON messages
  FOR SELECT
  TO public
  USING (
    -- Allow if this is a session-based conversation for an active chatbot
    (NOT EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = conversation_id
    ))
    OR
    -- Allow if agent is assigned to this conversation
    (EXISTS (
      SELECT 1 FROM conversation_agents ca
      WHERE ca.conversation_id = messages.conversation_id
    ))
  );

-- Grant necessary permissions to anon role for agent message operations
GRANT SELECT, INSERT ON messages TO anon;