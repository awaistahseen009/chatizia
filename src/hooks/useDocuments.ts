import { useState, useEffect } from 'react';
import { supabase, Document, DocumentChunk } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { OpenAI } from 'openai';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js to use the local worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

// Advanced text chunking with overlap
const chunkTextWithOverlap = (text: string, chunkSize: number = 800, overlap: number = 300): string[] => {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + chunkSize;
    
    // If this isn't the last chunk, try to break at a sentence or word boundary
    if (end < text.length) {
      // Look for sentence endings within the last 100 characters
      const sentenceEnd = text.lastIndexOf('.', end);
      const questionEnd = text.lastIndexOf('?', end);
      const exclamationEnd = text.lastIndexOf('!', end);
      
      const lastSentence = Math.max(sentenceEnd, questionEnd, exclamationEnd);
      
      if (lastSentence > start + chunkSize - 100) {
        end = lastSentence + 1;
      } else {
        // Fall back to word boundary
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start + chunkSize - 50) {
          end = lastSpace;
        }
      }
    }
    
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    // Move start position with overlap
    start = end - overlap;
    
    // Ensure we don't go backwards
    if (start <= chunks.length > 1 ? text.indexOf(chunks[chunks.length - 2]) : 0) {
      start = end;
    }
  }
  
  return chunks.filter(chunk => chunk.length > 50); // Filter out very small chunks
};

export const useDocuments = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Fetch documents for the current user
  const fetchDocuments = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  // Extract text from PDF using PDF.js
  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      console.log('📄 Starting PDF text extraction...');
      const arrayBuffer = await file.arrayBuffer();
      
      // Configure PDF.js with WebContainer-friendly settings
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        disableAutoFetch: true,
        disableStream: true,
        disableRange: true
      });
      
      const pdf = await loadingTask.promise;
      console.log(`📄 PDF loaded with ${pdf.numPages} pages`);
      
      let fullText = '';
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .filter((item: any) => item.str && item.str.trim())
            .map((item: any) => item.str)
            .join(' ');
          
          if (pageText.trim()) {
            fullText += pageText + '\n\n';
          }
          
          console.log(`📄 Extracted text from page ${pageNum}/${pdf.numPages}`);
        } catch (pageError) {
          console.warn(`⚠️ Failed to extract text from page ${pageNum}:`, pageError);
          // Continue with other pages
        }
      }
      
      const cleanText = fullText.trim();
      if (!cleanText) {
        throw new Error('No readable text found in the PDF document');
      }
      
      console.log(`✅ Successfully extracted ${cleanText.length} characters from PDF`);
      return cleanText;
    } catch (err) {
      console.error('❌ PDF text extraction failed:', err);
      throw new Error(`Failed to extract text from PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Extract text from a file (supports text and PDF)
  const extractTextFromFile = async (file: File): Promise<string> => {
    try {
      console.log(`📄 Extracting text from ${file.type} file: ${file.name}`);
      
      if (file.type === 'text/plain') {
        const text = await file.text();
        console.log(`✅ Extracted ${text.length} characters from text file`);
        return text;
      } else if (file.type === 'application/pdf') {
        return await extractTextFromPDF(file);
      } else {
        throw new Error('Unsupported file type. Only .txt and .pdf files are supported.');
      }
    } catch (err) {
      console.error('❌ Text extraction failed:', err);
      throw new Error(`Failed to extract text: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Generate embeddings using OpenAI
  const generateEmbeddings = async (text: string): Promise<number[]> => {
    try {
      if (!import.meta.env.VITE_OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      console.log('🧠 Generating embeddings...');
      
      // Clean and prepare text
      const cleanText = text.replace(/\s+/g, ' ').trim();
      
      if (!cleanText.trim()) {
        throw new Error('No text content found to generate embeddings');
      }

      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: cleanText,
      });
      
      console.log('✅ Embeddings generated successfully');
      return response.data[0].embedding;
    } catch (err) {
      console.error('❌ Embedding generation failed:', err);
      throw new Error(`Failed to generate embeddings: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Upload document, chunk text, and generate embeddings
  const uploadDocument = async (file: File, knowledgeBaseId?: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      console.log(`🚀 Starting document upload: ${file.name}`);
      setLoading(true);

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      console.log('📤 Uploading file to storage...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) {
        console.error('❌ Storage upload failed:', uploadError);
        throw uploadError;
      }

      console.log('✅ File uploaded to storage');

      // Create document record with 'processing' status
      console.log('📝 Creating document record...');
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .insert([
          {
            user_id: user.id,
            knowledge_base_id: knowledgeBaseId || null,
            filename: file.name,
            file_size: file.size,
            file_type: file.type,
            status: 'processing',
          },
        ])
        .select()
        .single();

      if (documentError) {
        console.error('❌ Document record creation failed:', documentError);
        throw documentError;
      }

      console.log('✅ Document record created');

      // Add to local state immediately with processing status
      setDocuments(prev => [documentData, ...prev]);

      // Extract text, chunk, and generate embeddings in the background
      try {
        console.log('📄 Starting text extraction...');
        const text = await extractTextFromFile(file);
        
        if (!text.trim()) {
          throw new Error('No text content found in the document');
        }
        
        console.log('✂️ Chunking text with overlap...');
        const chunks = chunkTextWithOverlap(text, 800, 300);
        console.log(`📄 Created ${chunks.length} chunks from document`);

        // Generate embeddings for each chunk and store in document_chunks table
        console.log('🧠 Processing chunks and generating embeddings...');
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          console.log(`🧠 Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
          
          const embedding = await generateEmbeddings(chunk);

          const { error: chunkError } = await supabase
            .from('document_chunks')
            .insert([
              {
                document_id: documentData.id,
                user_id: user.id,
                chunk_text: chunk,
                embedding: embedding,
                chunk_index: i,
              },
            ]);

          if (chunkError) {
            console.error(`❌ Failed to save chunk ${i + 1}:`, chunkError);
            throw chunkError;
          }
          
          console.log(`✅ Saved chunk ${i + 1}/${chunks.length} with embeddings`);
        }

        // Update document status to 'processed'
        console.log('💾 Updating document status to processed...');
        const { error: statusError } = await supabase
          .from('documents')
          .update({ 
            status: 'processed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', documentData.id);

        if (statusError) {
          console.error('❌ Failed to update document status:', statusError);
          throw statusError;
        }

        // Update local state
        setDocuments(prev => prev.map(doc => 
          doc.id === documentData.id 
            ? { 
                ...doc, 
                status: 'processed', 
                processed_at: new Date().toISOString()
              }
            : doc
        ));

        console.log(`✅ Document processed successfully with ${chunks.length} chunks`);
      } catch (embeddingErr) {
        console.error('❌ Failed to process document:', embeddingErr);
        
        // Update document status to 'failed' if processing fails
        await supabase
          .from('documents')
          .update({ 
            status: 'failed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', documentData.id);

        // Update local state
        setDocuments(prev => prev.map(doc => 
          doc.id === documentData.id 
            ? { ...doc, status: 'failed' }
            : doc
        ));

        throw embeddingErr;
      }

      return documentData;
    } catch (err) {
      console.error('❌ Document upload failed:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  // Delete document and associated chunks
  const deleteDocument = async (id: string) => {
    try {
      console.log(`🗑️ Deleting document: ${id}`);
      
      // Get document info to delete from storage
      const document = documents.find(doc => doc.id === id);
      
      if (document) {
        // Delete from storage
        const fileName = `${user?.id}/${document.filename}`;
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([fileName]);
        
        if (storageError) {
          console.warn('⚠️ Failed to delete file from storage:', storageError);
          // Continue with database deletion even if storage deletion fails
        }
      }

      // Delete document record (chunks will be deleted automatically due to CASCADE)
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remove from local state
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      console.log('✅ Document and associated chunks deleted successfully');
    } catch (err) {
      console.error('❌ Document deletion failed:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  // Fetch similar chunks for RAG functionality - Updated for public access
  const fetchSimilarChunks = async (query: string, limit: number = 5, chatbotId?: string): Promise<DocumentChunk[]> => {
    try {
      if (!import.meta.env.VITE_OPENAI_API_KEY) {
        console.warn('⚠️ OpenAI API key not configured, skipping similarity search');
        return [];
      }

      console.log(`🔍 Searching for similar chunks: "${query}"`);

      // Generate embedding for the query
      const queryEmbedding = await generateEmbeddings(query);

      // If we have a chatbot ID (for public/embedded access), use the public function
      if (chatbotId) {
        console.log('🔓 Using public chunk search for chatbot:', chatbotId);
        
        try {
          const { data, error } = await supabase
            .rpc('public_match_document_chunks', {
              chatbot_id_param: chatbotId,
              query_embedding: queryEmbedding,
              match_count: limit,
            });

          if (error) {
            console.warn('⚠️ Public RPC function failed, trying fallback:', error);
            throw error;
          }

          console.log(`✅ Found ${data?.length || 0} matching chunks using public RPC`);
          return data || [];
        } catch (rpcError) {
          console.log('🔄 Public RPC failed, trying basic search...');
          
          // Fallback: Use basic text search for public access
          const { data, error } = await supabase
            .from('document_chunks')
            .select(`
              *,
              documents!inner(
                knowledge_base_id,
                status
              )
            `)
            .textSearch('chunk_text', query.split(' ').join(' | '))
            .limit(limit);

          if (error) {
            console.error('❌ Fallback search failed:', error);
            return [];
          }

          console.log(`✅ Found ${data?.length || 0} matching chunks using text search`);
          return data || [];
        }
      }

      // For authenticated users, use the existing RPC function
      if (!user) {
        console.log('⚠️ No user and no chatbot ID, cannot search chunks');
        return [];
      }

      try {
        const { data, error } = await supabase
          .rpc('match_document_chunks', {
            query_embedding: queryEmbedding,
            match_count: limit,
            user_id: user.id,
          });

        if (error) {
          console.warn('⚠️ RPC function failed, falling back to basic search:', error);
          throw error;
        }

        console.log(`✅ Found ${data?.length || 0} matching chunks using RPC`);
        return data || [];
      } catch (rpcError) {
        // Fallback: Use basic text search if vector search is not available
        console.log('🔄 Using fallback text search...');
        
        const { data, error } = await supabase
          .from('document_chunks')
          .select('*')
          .eq('user_id', user.id)
          .textSearch('chunk_text', query.split(' ').join(' | '))
          .limit(limit);

        if (error) {
          console.error('❌ Fallback search failed:', error);
          throw error;
        }

        console.log(`✅ Found ${data?.length || 0} matching chunks using text search`);
        return data || [];
      }
    } catch (err) {
      console.error('❌ Error searching chunks:', err);
      // Return empty array instead of throwing to prevent breaking the chat
      return [];
    }
  };

  // Get chunk count for a document
  const getDocumentChunkCount = async (documentId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId);

      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.error('❌ Error getting chunk count:', err);
      return 0;
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  return {
    documents,
    loading,
    error,
    uploadDocument,
    deleteDocument,
    fetchSimilarChunks,
    getDocumentChunkCount,
    refetch: fetchDocuments,
  };
};