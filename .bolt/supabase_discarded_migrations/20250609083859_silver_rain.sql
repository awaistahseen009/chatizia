/*
  # Document Chunks Setup for AI-Powered Knowledge Base

  1. New Tables
    - Ensure `document_chunks` table exists with proper structure
    - Add vector similarity search function for chunks

  2. Security
    - Enable RLS on document_chunks table
    - Add policies for user access control

  3. Functions
    - Create similarity search function for document chunks
    - Add indexing for optimal vector search performance
*/

-- Enable the vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Ensure document_chunks table exists with proper structure
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  chunk_text text NOT NULL,
  embedding vector(1536) NOT NULL,
  chunk_index integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own document chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can insert own document chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can update own document chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can delete own document chunks" ON public.document_chunks;

-- Create RLS policies for document_chunks
CREATE POLICY "Users can read own document chunks" ON public.document_chunks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own document chunks" ON public.document_chunks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own document chunks" ON public.document_chunks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own document chunks" ON public.document_chunks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create function for document chunk similarity search
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_count int,
  user_id uuid
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  embedding vector(1536),
  chunk_index integer,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.chunk_text,
    document_chunks.embedding,
    document_chunks.chunk_index,
    document_chunks.created_at,
    document_chunks.updated_at,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity
  FROM document_chunks
  WHERE 
    document_chunks.user_id = match_document_chunks.user_id
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id ON public.document_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index ON public.document_chunks(chunk_index);

-- Create vector similarity index for embeddings
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON public.document_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic timestamp updates on document_chunks
DROP TRIGGER IF EXISTS update_document_chunks_updated_at ON public.document_chunks;
CREATE TRIGGER update_document_chunks_updated_at 
  BEFORE UPDATE ON public.document_chunks 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();