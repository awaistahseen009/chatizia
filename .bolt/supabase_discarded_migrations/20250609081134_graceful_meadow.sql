-- Enable the vector extension for embeddings (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create function for document similarity search using your existing documents table
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
  embeddings vector,
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

-- Create index for vector similarity search on your existing embeddings column
CREATE INDEX IF NOT EXISTS documents_embeddings_idx ON public.documents 
USING ivfflat (embeddings vector_cosine_ops)
WITH (lists = 100);

-- Ensure storage policies exist for the documents bucket
DO $$
BEGIN
    -- Create storage policies if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can upload their own documents'
    ) THEN
        CREATE POLICY "Users can upload their own documents" ON storage.objects
          FOR INSERT TO authenticated WITH CHECK (
            bucket_id = 'documents' AND 
            (storage.foldername(name))[1] = auth.uid()::text
          );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can view their own documents'
    ) THEN
        CREATE POLICY "Users can view their own documents" ON storage.objects
          FOR SELECT TO authenticated USING (
            bucket_id = 'documents' AND 
            (storage.foldername(name))[1] = auth.uid()::text
          );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can delete their own documents'
    ) THEN
        CREATE POLICY "Users can delete their own documents" ON storage.objects
          FOR DELETE TO authenticated USING (
            bucket_id = 'documents' AND 
            (storage.foldername(name))[1] = auth.uid()::text
          );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignore errors if policies already exist
END $$;