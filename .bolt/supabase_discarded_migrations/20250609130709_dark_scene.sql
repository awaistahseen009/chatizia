/*
  # Create match_document_chunks RPC function

  1. New Functions
    - `match_document_chunks` - Vector similarity search function for document chunks
      - Uses pgvector cosine similarity to find relevant chunks
      - Filters by user_id for security
      - Returns chunks ordered by similarity score

  2. Security
    - Function respects RLS policies on document_chunks table
    - Only returns chunks belonging to the authenticated user
*/

-- Create the match_document_chunks function for vector similarity search
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  user_id uuid,
  chunk_text text,
  embedding vector(1536),
  chunk_index int,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.user_id,
    dc.chunk_text,
    dc.embedding,
    dc.chunk_index,
    dc.created_at,
    dc.updated_at,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE 
    (user_id IS NULL OR dc.user_id = user_id)
    AND dc.embedding IS NOT NULL
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION match_document_chunks TO authenticated;