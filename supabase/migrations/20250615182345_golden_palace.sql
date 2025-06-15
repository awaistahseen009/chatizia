/*
  # Add knowledge_base_enabled column to conversation_agents table

  1. Changes
    - Add knowledge_base_enabled column to conversation_agents table
    - Set default value to true for existing records
    - Update indexes for better performance

  2. Security
    - Maintain existing RLS policies
*/

-- Add knowledge_base_enabled column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_agents' AND column_name = 'knowledge_base_enabled'
  ) THEN
    ALTER TABLE conversation_agents ADD COLUMN knowledge_base_enabled boolean DEFAULT true;
  END IF;
END $$;

-- Create index for knowledge_base_enabled column
CREATE INDEX IF NOT EXISTS idx_conversation_agents_knowledge_base_enabled 
ON conversation_agents(knowledge_base_enabled);

-- Update existing records to have knowledge_base_enabled = true
UPDATE conversation_agents 
SET knowledge_base_enabled = true 
WHERE knowledge_base_enabled IS NULL;