import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Brain, Loader, AlertCircle, Check, Plus } from 'lucide-react';
import { useKnowledgeBases } from '../hooks/useKnowledgeBases';
import { useDocuments } from '../hooks/useDocuments';
import { supabase } from '../lib/supabase';

interface CreateKnowledgeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (knowledgeBase: any) => void;
}

const CreateKnowledgeBaseModal: React.FC<CreateKnowledgeBaseModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const { createKnowledgeBase } = useKnowledgeBases();
  const { uploadDocument, documents } = useDocuments();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<string[]>([]);
  const [selectedExistingDocs, setSelectedExistingDocs] = useState<string[]>([]);
  const [processingDocuments, setProcessingDocuments] = useState<Set<string>>(new Set());
  const [showCancelModal, setShowCancelModal] = useState(false);
  const uploadAbortControllers = useRef<Map<string, AbortController>>(new Map());
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    useExistingDocuments: false
  });

  const processedDocuments = documents.filter(doc => 
    doc.status === 'processed' && !doc.knowledge_base_id
  );

  // Only consider documents with 'processing' status as processing
  const isProcessing = documents.some(doc => doc.status === 'processing');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload PDF or TXT files only');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    // Check if OpenAI API key is configured
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      alert('OpenAI API key is not configured. Please add VITE_OPENAI_API_KEY to your environment variables.');
      return;
    }

    const fileId = `${file.name}-${Date.now()}`;
    const abortController = new AbortController();
    uploadAbortControllers.current.set(fileId, abortController);

    setUploading(true);
    setProcessingDocuments(prev => new Set([...prev, fileId]));

    try {
      console.log(`🚀 Starting upload for: ${file.name}`);
      const uploadedDoc = await uploadDocument(file);
      if (uploadedDoc) {
        console.log(`✅ Upload completed for: ${file.name}, status: ${uploadedDoc.status}`);
        setUploadedDocuments(prev => [...prev, uploadedDoc.id]);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Upload cancelled for:', file.name);
      } else {
        console.error(`❌ Upload failed for ${file.name}:`, err);
        alert(err instanceof Error ? err.message : 'Failed to upload document');
      }
    } finally {
      setProcessingDocuments(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
      uploadAbortControllers.current.delete(fileId);
      
      // Check if this was the last processing document
      if (processingDocuments.size === 1) {
        setUploading(false);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => handleFileUpload(file));
    }
  };

  const handleExistingDocToggle = (docId: string) => {
    setSelectedExistingDocs(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Knowledge base name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create the knowledge base
      const newKB = await createKnowledgeBase(formData.name, formData.description);

      // Update selected documents to use this knowledge base
      const documentsToUpdate = formData.useExistingDocuments 
        ? selectedExistingDocs 
        : uploadedDocuments;

      if (documentsToUpdate.length > 0) {
        // Update documents to link to this knowledge base
        const { error: updateError } = await supabase
          .from('documents')
          .update({ knowledge_base_id: newKB.id })
          .in('id', documentsToUpdate);

        if (updateError) {
          console.error('Failed to link documents to knowledge base:', updateError);
          // Don't throw error, just log it as the KB was created successfully
        }
      }

      // Reset form and close modal
      resetForm();
      onSuccess?.(newKB);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create knowledge base');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setUploadedDocuments([]);
    setSelectedExistingDocs([]);
    setProcessingDocuments(new Set());
    setUploading(false);
    setFormData({
      name: '',
      description: '',
      useExistingDocuments: false
    });
    setError(null);
  };

  const cancelAllUploads = () => {
    // Cancel all ongoing uploads
    uploadAbortControllers.current.forEach((controller) => {
      controller.abort();
    });
    uploadAbortControllers.current.clear();
    
    // Reset processing state
    setProcessingDocuments(new Set());
    setUploading(false);
    
    // Close the modal
    resetForm();
    onClose();
  };

  const handleClose = () => {
    if (isProcessing) {
      setShowCancelModal(true);
    } else if (!loading) {
      resetForm();
      onClose();
    }
  };

  if (!isOpen) return null;

  const totalSelectedDocs = formData.useExistingDocuments 
    ? selectedExistingDocs.length 
    : uploadedDocuments.length;

  // Count processed documents from uploads
  const processedUploads = uploadedDocuments.filter(docId => {
    const doc = documents.find(d => d.id === docId);
    return doc?.status === 'processed';
  }).length;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800">Create Knowledge Base</h2>
              <button
                onClick={handleClose}
                disabled={loading}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex items-center mt-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                1
              </div>
              <div className={`flex-1 h-1 mx-2 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                2
              </div>
              <div className={`flex-1 h-1 mx-2 ${step >= 3 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                3
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="p-4 bg-red-50 border-b border-red-200">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Processing Status */}
            {isProcessing && (
              <div className="p-4 bg-blue-50 border-b border-blue-200">
                <div className="flex items-center space-x-3">
                  <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      Processing documents with AI...
                    </p>
                    <p className="text-xs text-blue-600">
                      Documents are being chunked and embedded. Please wait for completion.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Basic Information */}
            {step === 1 && (
              <div className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Basic Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Knowledge Base Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="e.g., Product Documentation, FAQ, User Manual"
                    disabled={isProcessing}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Describe what this knowledge base contains and how it will be used..."
                    disabled={isProcessing}
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Brain className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-800">AI-Powered Knowledge Base</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Documents will be automatically chunked (800 characters with 300 character overlap) and embedded using OpenAI for intelligent search and retrieval.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Document Source */}
            {step === 2 && (
              <div className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Add Documents</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="documentSource"
                        checked={!formData.useExistingDocuments}
                        onChange={() => setFormData(prev => ({ ...prev, useExistingDocuments: false }))}
                        className="mr-2"
                        disabled={isProcessing}
                      />
                      <span className="text-sm font-medium text-slate-700">Upload new documents</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="documentSource"
                        checked={formData.useExistingDocuments}
                        onChange={() => setFormData(prev => ({ ...prev, useExistingDocuments: true }))}
                        className="mr-2"
                        disabled={isProcessing}
                      />
                      <span className="text-sm font-medium text-slate-700">Use existing documents</span>
                    </label>
                  </div>

                  {!formData.useExistingDocuments ? (
                    <>
                      {/* Upload Area */}
                      <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                          dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
                        } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                      >
                        {isProcessing ? (
                          <Loader className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
                        ) : (
                          <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                        )}
                        <h3 className="text-lg font-medium text-slate-800 mb-2">
                          {isProcessing ? 'Processing documents with AI...' : 'Drag and drop files here, or click to browse'}
                        </h3>
                        <p className="text-slate-600 mb-4">
                          {isProcessing 
                            ? 'Documents are being chunked and embedded. Please wait...'
                            : 'Supports PDF and TXT files up to 10MB. Documents are automatically chunked and embedded.'
                          }
                        </p>
                        {!isProcessing && (
                          <label className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer inline-block">
                            Choose Files
                            <input
                              type="file"
                              onChange={handleFileSelect}
                              accept=".pdf,.txt"
                              multiple
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>

                      {/* Uploaded Documents Status */}
                      {uploadedDocuments.length > 0 && (
                        <div className="space-y-2">
                          {processedUploads === uploadedDocuments.length ? (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <div className="flex items-center space-x-2 mb-2">
                                <Check className="w-4 h-4 text-green-600" />
                                <h4 className="font-medium text-green-800">
                                  {uploadedDocuments.length} document{uploadedDocuments.length !== 1 ? 's' : ''} processed
                                </h4>
                              </div>
                              <p className="text-sm text-green-700">
                                All documents have been successfully chunked and embedded.
                              </p>
                            </div>
                          ) : (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="flex items-center space-x-2 mb-2">
                                <Loader className="w-4 h-4 text-blue-600 animate-spin" />
                                <h4 className="font-medium text-blue-800">
                                  Processing {uploadedDocuments.length} document{uploadedDocuments.length !== 1 ? 's' : ''}
                                </h4>
                              </div>
                              <p className="text-sm text-blue-700">
                                {processedUploads} processed, {uploadedDocuments.length - processedUploads} still processing...
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Existing Documents Selection */}
                      {processedDocuments.length > 0 ? (
                        <div>
                          <h4 className="text-md font-medium text-slate-800 mb-3">
                            Select Existing Documents ({selectedExistingDocs.length} selected)
                          </h4>
                          <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                            {processedDocuments.map((doc) => (
                              <label
                                key={doc.id}
                                className={`flex items-center space-x-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 ${
                                  isProcessing ? 'opacity-50 pointer-events-none' : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedExistingDocs.includes(doc.id)}
                                  onChange={() => handleExistingDocToggle(doc.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  disabled={isProcessing}
                                />
                                <FileText className="w-4 h-4 text-slate-400" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-800 truncate">{doc.filename}</p>
                                  <p className="text-xs text-slate-500">
                                    {(doc.file_size / 1024).toFixed(1)} KB • {new Date(doc.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                                {selectedExistingDocs.includes(doc.id) && (
                                  <Check className="w-4 h-4 text-green-600" />
                                )}
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 border border-slate-200 rounded-lg">
                          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                          <p className="text-slate-500">No processed documents available</p>
                          <p className="text-sm text-slate-400 mt-1">
                            Upload and process documents first, or switch to upload new documents.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* API Key Warning */}
                  {!import.meta.env.VITE_OPENAI_API_KEY && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-yellow-800">OpenAI API Key Required</h3>
                          <p className="text-sm text-yellow-700 mt-1">
                            To enable document chunking and AI-powered embeddings, please add your OpenAI API key to the environment variables as <code className="bg-yellow-100 px-1 rounded">VITE_OPENAI_API_KEY</code>.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Summary */}
            {step === 3 && (
              <div className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Review & Create</h3>
                
                <div className="bg-slate-50 rounded-lg p-6 space-y-4">
                  <div>
                    <h4 className="font-medium text-slate-800">Knowledge Base Details</h4>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      <p><span className="font-medium">Name:</span> {formData.name}</p>
                      {formData.description && (
                        <p><span className="font-medium">Description:</span> {formData.description}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-slate-800">Documents</h4>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      <p><span className="font-medium">Source:</span> {formData.useExistingDocuments ? 'Existing documents' : 'New uploads'}</p>
                      <p><span className="font-medium">Count:</span> {totalSelectedDocs} document{totalSelectedDocs !== 1 ? 's' : ''}</p>
                      {!formData.useExistingDocuments && uploadedDocuments.length > 0 && (
                        <p><span className="font-medium">Status:</span> {processedUploads} processed, {uploadedDocuments.length - processedUploads} processing</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-sm text-blue-600">
                    <Brain className="w-4 h-4" />
                    <span>AI processing will be applied automatically</span>
                  </div>
                </div>

                {totalSelectedDocs === 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <p className="text-sm text-yellow-700">
                        No documents selected. The knowledge base will be created empty and you can add documents later.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 flex items-center justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  disabled={loading || isProcessing}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Back
                </button>
              ) : (
                <div></div>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && !formData.name.trim()) || 
                    (step === 2 && isProcessing)
                  }
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {step === 2 && isProcessing ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Next</span>
                  )}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!formData.name || loading || isProcessing}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Knowledge Base'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Cancel Processing?</h3>
                  <p className="text-sm text-slate-600">Documents are currently being processed</p>
                </div>
              </div>
              
              <p className="text-slate-700 mb-6">
                Documents are currently being processed with AI chunking and embedding. 
                If you cancel now, the processing will be stopped and you'll need to start over.
              </p>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Continue Processing
                </button>
                <button
                  onClick={cancelAllUploads}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Cancel & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateKnowledgeBaseModal;