/*
  # Fix Agent Assignment Permissions and RLS Issues

  1. Fix RLS policies for agent assignments
  2. Grant proper permissions to anon role
  3. Fix agent authentication issues
  4. Ensure embedded chatbot works properly
*/

-- Fix agent assignments RLS policies
DROP POLICY IF EXISTS "Users can manage assignments for their agents" ON agent_assignments;
DROP POLICY IF EXISTS "Agents can read their own assignments" ON agent_assignments;

-- Create proper RLS policies for agent assignments
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

-- Allow agents to read their own assignments (for agent dashboard)
CREATE POLICY "Agents can read their own assignments"
  ON agent_assignments
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = agent_assignments.agent_id
    )
  );

-- Allow checking for existing assignments before creating new ones
CREATE POLICY "Allow checking existing assignments"
  ON agent_assignments
  FOR SELECT
  TO authenticated
  USING (true);

-- Fix agents table permissions for authentication
DROP POLICY IF EXISTS "Users can manage their own agents" ON agents;
CREATE POLICY "Users can manage their own agents"
  ON agents
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow anon users to read agents for authentication
CREATE POLICY "Allow agent authentication"
  ON agents
  FOR SELECT
  TO anon
  USING (true);

-- Fix conversation_agents policies
DROP POLICY IF EXISTS "Users can manage conversation assignments for their agents" ON conversation_agents;
DROP POLICY IF EXISTS "Agents can read assigned conversations" ON conversation_agents;

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

CREATE POLICY "Agents can read assigned conversations"
  ON conversation_agents
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = conversation_agents.agent_id
    )
  );

-- Allow anon users to insert conversation assignments (for agent takeover)
CREATE POLICY "Allow agent conversation assignment"
  ON conversation_agents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Grant necessary permissions to anon role
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_assignments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_agents TO anon;
GRANT SELECT ON agents TO anon;
GRANT SELECT, INSERT, UPDATE ON agent_notifications TO anon;

-- Ensure chatbots table allows public access for embedded widgets
DROP POLICY IF EXISTS "Public can read active chatbots for embedding" ON chatbots;
CREATE POLICY "Public can read active chatbots for embedding"
  ON chatbots
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

-- Grant chatbots access to anon for embedded widgets
GRANT SELECT ON chatbots TO anon;

-- Ensure conversations and messages work for embedded chatbots
GRANT SELECT, INSERT, UPDATE ON conversations TO anon;
GRANT SELECT, INSERT ON messages TO anon;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_agent_assignments_check ON agent_assignments(agent_id, chatbot_id);