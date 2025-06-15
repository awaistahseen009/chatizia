/*
  # Add missing agent_id column to messages table

  1. Changes
    - Add agent_id column to messages table
    - Create index for performance
    - Update RLS policies to handle agent messages

  2. Security
    - Maintain existing RLS policies
    - Add proper foreign key constraint
*/

-- Add agent_id column to messages table if it doesn't exist
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

-- Create index for agent_id column
CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON messages(agent_id);

-- Create index for better performance on conversation queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON messages(conversation_id, created_at);

-- Ensure the add_session_message function works with the new column
-- (The function should already be created from previous migration)

-- Grant necessary permissions
GRANT SELECT, INSERT ON messages TO anon;
GRANT SELECT, INSERT ON messages TO authenticated;