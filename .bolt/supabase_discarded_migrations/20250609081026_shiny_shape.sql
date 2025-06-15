-- Update existing documents table to ensure it has the embeddings column
-- (This should already exist based on your schema, but adding for completeness)

-- Enable the vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embeddings column if it doesn't exist (it should already exist in your case)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'embeddings'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN embeddings vector(1536);
    END IF;
END $$;

-- Create function for document similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  chatbot_id uuid,
  filename text,
  file_size bigint,
  file_type text,
  status text,
  processed_at timestamptz,
  created_at timestamptz,
  embeddings vector(1536),
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.user_id,
    documents.chatbot_id,
    documents.filename,
    documents.file_size,
    documents.file_type,
    documents.status,
    documents.processed_at,
    documents.created_at,
    documents.embeddings,
    1 - (documents.embeddings <=> query_embedding) AS similarity
  FROM documents
  WHERE 
    documents.embeddings IS NOT NULL
    AND documents.status = 'processed'
    AND documents.user_id = auth.uid()
    AND 1 - (documents.embeddings <=> query_embedding) > match_threshold
  ORDER BY documents.embeddings <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS documents_embeddings_idx ON public.documents 
USING ivfflat (embeddings vector_cosine_ops)
WITH (lists = 100);

-- Create storage bucket for documents (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for the documents bucket
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
    DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
    
    -- Create new policies
    CREATE POLICY "Users can upload their own documents" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'documents' AND 
        (storage.foldername(name))[1] = auth.uid()::text
      );

    CREATE POLICY "Users can view their own documents" ON storage.objects
      FOR SELECT TO authenticated USING (
        bucket_id = 'documents' AND 
        (storage.foldername(name))[1] = auth.uid()::text
      );

    CREATE POLICY "Users can update their own documents" ON storage.objects
      FOR UPDATE TO authenticated USING (
        bucket_id = 'documents' AND 
        (storage.foldername(name))[1] = auth.uid()::text
      );

    CREATE POLICY "Users can delete their own documents" ON storage.objects
      FOR DELETE TO authenticated USING (
        bucket_id = 'documents' AND 
        (storage.foldername(name))[1] = auth.uid()::text
      );
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Ignore if policies already exist
END $$;