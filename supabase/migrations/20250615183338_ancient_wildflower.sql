/*
  # Fix Agent Notifications and Real-time Issues

  1. Create agent_notifications table if it doesn't exist
  2. Fix RLS policies for proper access
  3. Ensure proper indexes for performance
  4. Grant necessary permissions
*/

-- Create agent_notifications table if it doesn't exist
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

-- Drop existing policies and recreate them
DROP POLICY IF EXISTS "Agents can manage their own notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Agents can read their own notifications" ON agent_notifications;
DROP POLICY IF EXISTS "Agents can update their own notifications" ON agent_notifications;

-- Create RLS policies for agent_notifications
CREATE POLICY "Agents can manage their own notifications"
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

-- Allow inserting notifications
CREATE POLICY "Allow creating notifications"
  ON agent_notifications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_id ON agent_notifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_conversation_id ON agent_notifications(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_created_at ON agent_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_is_read ON agent_notifications(is_read);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON agent_notifications TO anon;
GRANT SELECT, INSERT, UPDATE ON agent_notifications TO authenticated;

-- Ensure conversation_agents has proper RLS for real-time
DROP POLICY IF EXISTS "Allow agent conversation assignment" ON conversation_agents;
CREATE POLICY "Allow agent conversation assignment"
  ON conversation_agents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow updating conversation_agents for knowledge base toggle
CREATE POLICY "Allow updating conversation agents"
  ON conversation_agents
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions for real-time
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_agents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_agents TO authenticated;

-- Ensure messages table has proper permissions for real-time
GRANT SELECT, INSERT ON messages TO anon;
GRANT SELECT, INSERT ON messages TO authenticated;

-- Ensure conversations table has proper permissions
GRANT SELECT, INSERT, UPDATE ON conversations TO anon;
GRANT SELECT, INSERT, UPDATE ON conversations TO authenticated;