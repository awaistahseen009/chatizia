-- Drop and recreate the function with proper table aliases
DROP FUNCTION IF EXISTS public_match_document_chunks(uuid, vector(1536), int);

CREATE OR REPLACE FUNCTION public_match_document_chunks(
  chatbot_id_param uuid,
  query_embedding vector(1536),
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  embedding vector(1536),
  chunk_index int,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify chatbot is active
  IF NOT EXISTS (
    SELECT 1 FROM chatbots 
    WHERE chatbots.id = chatbot_id_param AND chatbots.status = 'active'
  ) THEN
    RETURN;
  END IF;

  -- Return similar chunks for the chatbot's knowledge base
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.chunk_text,
    dc.embedding,
    dc.chunk_index,
    (dc.embedding <=> query_embedding) * -1 + 1 AS similarity
  FROM document_chunks dc
  INNER JOIN documents d ON dc.document_id = d.id
  INNER JOIN chatbots c ON d.knowledge_base_id = c.knowledge_base_id
  WHERE c.id = chatbot_id_param
    AND c.status = 'active'
    AND d.status = 'processed'
    AND dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to public
GRANT EXECUTE ON FUNCTION public_match_document_chunks(uuid, vector(1536), int) TO public;

-- Also fix the get_chatbot_knowledge_base function for consistency
DROP FUNCTION IF EXISTS get_chatbot_knowledge_base(uuid);

CREATE OR REPLACE FUNCTION get_chatbot_knowledge_base(chatbot_id_param uuid)
RETURNS TABLE (
  knowledge_base_id uuid,
  knowledge_base_name text,
  document_count bigint,
  chunk_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.knowledge_base_id,
    kb.name as knowledge_base_name,
    COUNT(DISTINCT d.id) as document_count,
    COUNT(dc.id) as chunk_count
  FROM chatbots c
  LEFT JOIN knowledge_bases kb ON c.knowledge_base_id = kb.id
  LEFT JOIN documents d ON d.knowledge_base_id = c.knowledge_base_id AND d.status = 'processed'
  LEFT JOIN document_chunks dc ON dc.document_id = d.id
  WHERE c.id = chatbot_id_param AND c.status = 'active'
  GROUP BY c.knowledge_base_id, kb.name;
END;
$$;

-- Grant execute permission to public
GRANT EXECUTE ON FUNCTION get_chatbot_knowledge_base(uuid) TO public;

-- Update the get_public_chatbot function to ensure only active chatbots are returned
DROP FUNCTION IF EXISTS get_public_chatbot(uuid);

CREATE OR REPLACE FUNCTION get_public_chatbot(chatbot_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT to_json(t)
  INTO result
  FROM (
    SELECT 
      c.id,
      c.name,
      c.description,
      c.status,
      c.configuration,
      c.knowledge_base_id
    FROM chatbots c
    WHERE c.id = chatbot_id 
      AND c.status = 'active'
  ) t;
  
  RETURN result;
END;
$$;

-- Grant execute permission to public
GRANT EXECUTE ON FUNCTION get_public_chatbot(uuid) TO public;