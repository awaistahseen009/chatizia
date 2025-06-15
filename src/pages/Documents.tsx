import React, { useState } from 'react';
import { 
  Upload, 
  FileText, 
  File, 
  Image as ImageIcon, 
  MoreVertical, 
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader,
  Brain,
  Layers,
  Plus,
  Database,
  FolderPlus
} from 'lucide-react';
import { useDocuments } from '../hooks/useDocuments';
import { useKnowledgeBases } from '../hooks/useKnowledgeBases';
import { useChatbot } from '../contexts/ChatbotContext';
import LoadingSpinner from '../components/LoadingSpinner';
import CreateKnowledgeBaseModal from '../components/CreateKnowledgeBaseModal';

const Documents: React.FC = () => {
  const { documents, loading, error, uploadDocument, deleteDocument } = useDocuments();
  const { knowledgeBases } = useKnowledgeBases();
  const { chatbots } = useChatbot();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterKnowledgeBase, setFilterKnowledgeBase] = useState('all');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCreateKBModal, setShowCreateKBModal] = useState(false);

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

    setUploading(true);
    try {
      await uploadDocument(file);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => handleFileUpload(file));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this document? This will also remove all its chunks and embeddings.')) {
      try {
        await deleteDocument(id);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete document');
      }
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) {
      return <FileText className="w-8 h-8 text-red-500" />;
    } else if (type.includes('word') || type.includes('document')) {
      return <File className="w-8 h-8 text-blue-500" />;
    } else if (type.includes('text')) {
      return <FileText className="w-8 h-8 text-slate-500" />;
    } else if (type.includes('image')) {
      return <ImageIcon className="w-8 h-8 text-green-500" />;
    }
    return <File className="w-8 h-8 text-slate-500" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Loader className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'text-green-600';
      case 'processing':
        return 'text-yellow-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-slate-600';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getKnowledgeBaseName = (kbId: string | null) => {
    if (!kbId) return 'Unassigned';
    const kb = knowledgeBases.find(kb => kb.id === kbId);
    return kb?.name || 'Unknown';
  };

  if (loading && documents.length === 0) {
    return <LoadingSpinner />;
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
    const matchesKB = filterKnowledgeBase === 'all' || 
                     (filterKnowledgeBase === 'unassigned' && !doc.knowledge_base_id) ||
                     doc.knowledge_base_id === filterKnowledgeBase;
    return matchesSearch && matchesStatus && matchesKB;
  });

  const processingCount = documents.filter(doc => doc.status === 'processing').length;
  const processedCount = documents.filter(doc => doc.status === 'processed').length;
  const failedCount = documents.filter(doc => doc.status === 'failed').length;
  const unassignedCount = documents.filter(doc => doc.status === 'processed' && !doc.knowledge_base_id).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Knowledge Base</h1>
          <p className="text-slate-600 mt-1">Upload and manage documents with AI-powered chunking and embeddings</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateKBModal(true)}
            className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Create Knowledge Base</span>
          </button>
          <label className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Processing...' : 'Upload Document'}</span>
            <input
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.txt"
              multiple
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Documents</p>
              <p className="text-xl font-bold text-slate-800">{documents.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">AI Processed</p>
              <p className="text-xl font-bold text-slate-800">{processedCount}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Loader className={`w-5 h-5 text-yellow-600 ${processingCount > 0 ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <p className="text-sm text-slate-600">Processing</p>
              <p className="text-xl font-bold text-slate-800">{processingCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Smart Chunks</p>
              <p className="text-xl font-bold text-slate-800">
                {processedCount > 0 ? `${processedCount * 5}+` : '0'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Knowledge Bases</p>
              <p className="text-xl font-bold text-slate-800">{knowledgeBases.length}</p>
            </div>
          </div>
        </div>
      </div>

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

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-800 mb-2">
          {uploading ? 'Processing document with AI chunking...' : 'Drag and drop files here, or click to browse'}
        </h3>
        <p className="text-slate-600 mb-4">
          Supports PDF and TXT files up to 10MB. Documents are automatically chunked (800 chars, 300 overlap) and embedded.
        </p>
        <label className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer inline-block">
          Choose Files
          <input
            type="file"
            onChange={handleFileSelect}
            accept=".pdf,.txt"
            multiple
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="processed">Processed</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={filterKnowledgeBase}
          onChange={(e) => setFilterKnowledgeBase(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value="all">All Knowledge Bases</option>
          <option value="unassigned">Unassigned</option>
          {knowledgeBases.map((kb) => (
            <option key={kb.id} value={kb.id}>{kb.name}</option>
          ))}
        </select>
      </div>

      {/* Unassigned Documents Alert */}
      {unassignedCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Database className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="font-medium text-blue-800">Unassigned Documents</h3>
                <p className="text-sm text-blue-700">
                  {unassignedCount} processed document{unassignedCount !== 1 ? 's are' : ' is'} not assigned to any knowledge base
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateKBModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Knowledge Base
            </button>
          </div>
        </div>
      )}

      {/* Documents List */}
      {filteredDocuments.length > 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-slate-600">
              <div className="col-span-4">Name</div>
              <div className="col-span-2">Knowledge Base</div>
              <div className="col-span-1">Size</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Upload Date</div>
              <div className="col-span-1">Actions</div>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {filteredDocuments.map((doc) => (
              <div key={doc.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-4 flex items-center space-x-3">
                    {getFileIcon(doc.file_type)}
                    <div>
                      <h3 className="font-medium text-slate-800">{doc.filename}</h3>
                      {doc.status === 'processed' && (
                        <div className="flex items-center space-x-2 mt-1">
                          <Layers className="w-3 h-3 text-purple-500" />
                          <span className="text-xs text-purple-600">Chunked & Embedded</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <span className={`text-sm ${doc.knowledge_base_id ? 'text-slate-700' : 'text-orange-600'}`}>
                      {getKnowledgeBaseName(doc.knowledge_base_id)}
                    </span>
                  </div>
                  
                  <div className="col-span-1">
                    <span className="text-sm text-slate-600">{formatFileSize(doc.file_size)}</span>
                  </div>
                  
                  <div className="col-span-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(doc.status)}
                      <span className={`text-sm capitalize ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <span className="text-sm text-slate-600">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="col-span-1">
                    <div className="flex items-center space-x-1">
                      <button 
                        className="p-1 hover:bg-slate-200 rounded transition-colors" 
                        title="View"
                      >
                        <Eye className="w-4 h-4 text-slate-400" />
                      </button>
                      <button 
                        className="p-1 hover:bg-slate-200 rounded transition-colors" 
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-slate-400" />
                      </button>
                      <button 
                        onClick={() => handleDelete(doc.id)}
                        className="p-1 hover:bg-slate-200 rounded transition-colors" 
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-800 mb-2">No documents found</h3>
          <p className="text-slate-500">
            {searchTerm || filterStatus !== 'all' || filterKnowledgeBase !== 'all'
              ? 'No documents match your search criteria.' 
              : 'Upload your first document to get started with AI-powered knowledge base.'
            }
          </p>
        </div>
      )}

      {/* Processing Status */}
      {processingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <Loader className="w-4 h-4 text-white animate-spin" />
              </div>
              <div>
                <h3 className="font-medium text-blue-800">AI Processing in Progress</h3>
                <p className="text-sm text-blue-600">
                  {processingCount} document{processingCount !== 1 ? 's' : ''} being chunked and embedded
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-blue-800">Chunking & Embedding...</p>
              <p className="text-xs text-blue-600">800 char chunks with 300 char overlap</p>
            </div>
          </div>
        </div>
      )}

      {/* Failed Documents Warning */}
      {failedCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="font-medium text-red-800">Processing Failed</h3>
              <p className="text-sm text-red-700">
                {failedCount} document{failedCount !== 1 ? 's' : ''} failed to process. Please try uploading again.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Create Knowledge Base Modal */}
      <CreateKnowledgeBaseModal
        isOpen={showCreateKBModal}
        onClose={() => setShowCreateKBModal(false)}
        onSuccess={() => {
          // Refresh the page or update state as needed
          window.location.reload();
        }}
      />
    </div>
  );
};

export default Documents;