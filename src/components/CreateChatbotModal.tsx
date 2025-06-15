import React, { useState, useEffect, useRef } from 'react';
import { X, Bot, Zap, ShoppingCart, GraduationCap, Heart, FileText, Plus, Check, Database, Loader, AlertCircle, Upload, Image as ImageIcon } from 'lucide-react';
import { useChatbot } from '../contexts/ChatbotContext';
import { useKnowledgeBases } from '../hooks/useKnowledgeBases';
import { useDocuments } from '../hooks/useDocuments';
import { supabase } from '../lib/supabase';
import CreateKnowledgeBaseModal from './CreateKnowledgeBaseModal';

interface CreateChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateChatbotModal: React.FC<CreateChatbotModalProps> = ({ isOpen, onClose }) => {
  const { addChatbot } = useChatbot();
  const { knowledgeBases, getKnowledgeBaseDocuments } = useKnowledgeBases();
  const { documents } = useDocuments();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [knowledgeBaseDocuments, setKnowledgeBaseDocuments] = useState<any[]>([]);
  const [showCreateKBModal, setShowCreateKBModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const processingRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template: '',
    primaryColor: '#2563eb',
    position: 'bottom-right',
    welcomeMessage: 'Hello! How can I help you today?',
    personality: 'helpful',
    knowledgeBaseId: '',
    useExistingKnowledgeBase: true,
    newKnowledgeBaseName: '',
    newKnowledgeBaseDescription: '',
    botImage: '',
    useCustomImage: false
  });

  const templates = [
    {
      id: 'customer-support',
      name: 'Customer Support',
      description: 'Handle customer inquiries, complaints, and support tickets',
      icon: Bot,
      color: '#2563eb',
      welcomeMessage: 'Hi! I\'m here to help with any questions or issues you might have.',
      personality: 'professional'
    },
    {
      id: 'sales-assistant',
      name: 'Sales Assistant',
      description: 'Qualify leads, schedule demos, and assist with purchases',
      icon: ShoppingCart,
      color: '#10b981',
      welcomeMessage: 'Welcome! I\'d love to help you find the perfect solution for your needs.',
      personality: 'friendly'
    },
    {
      id: 'general-purpose',
      name: 'General Purpose',
      description: 'Versatile chatbot for general questions and assistance',
      icon: Zap,
      color: '#f59e0b',
      welcomeMessage: 'Hello! I\'m your AI assistant. How can I help you today?',
      personality: 'helpful'
    },
    {
      id: 'education',
      name: 'Education Helper',
      description: 'Assist students with learning and answer educational questions',
      icon: GraduationCap,
      color: '#8b5cf6',
      welcomeMessage: 'Hi there! I\'m here to help you learn. What would you like to explore today?',
      personality: 'encouraging'
    },
    {
      id: 'healthcare',
      name: 'Healthcare Assistant',
      description: 'Provide healthcare information and appointment scheduling',
      icon: Heart,
      color: '#ef4444',
      welcomeMessage: 'Hello! I\'m here to help with your healthcare questions and appointments.',
      personality: 'caring'
    }
  ];

  // Check for processing documents - only consider 'processing' status as processing
  useEffect(() => {
    const processingDocs = documents.filter(doc => doc.status === 'processing');
    const newIsProcessing = processingDocs.length > 0;
    
    if (newIsProcessing !== isProcessing) {
      setIsProcessing(newIsProcessing);
      processingRef.current = newIsProcessing;
      console.log(`📊 Processing status changed: ${newIsProcessing ? 'PROCESSING' : 'COMPLETE'} (${processingDocs.length} docs processing)`);
    }
  }, [documents, isProcessing]);

  useEffect(() => {
    if (formData.knowledgeBaseId && formData.useExistingKnowledgeBase) {
      loadKnowledgeBaseDocuments(formData.knowledgeBaseId);
    }
  }, [formData.knowledgeBaseId, formData.useExistingKnowledgeBase]);

  const loadKnowledgeBaseDocuments = async (knowledgeBaseId: string) => {
    try {
      const docs = await getKnowledgeBaseDocuments(knowledgeBaseId);
      setKnowledgeBaseDocuments(docs);
    } catch (err) {
      console.error('Failed to load knowledge base documents:', err);
    }
  };

  const handleTemplateSelect = (template: typeof templates[0]) => {
    setFormData(prev => ({ 
      ...prev, 
      template: template.id,
      primaryColor: template.color,
      welcomeMessage: template.welcomeMessage,
      personality: template.personality
    }));
  };

  const handleDocumentToggle = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId) 
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image size must be less than 2MB');
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      console.log('📤 Uploading image to chatbot-logos bucket:', fileName);

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('chatbot-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError);
        throw uploadError;
      }

      console.log('✅ Image uploaded successfully:', data);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chatbot-logos')
        .getPublicUrl(fileName);

      console.log('🔗 Public URL generated:', publicUrl);

      setFormData(prev => ({ 
        ...prev, 
        botImage: publicUrl,
        useCustomImage: true 
      }));
      setImagePreview(publicUrl);

    } catch (err) {
      console.error('❌ Image upload failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({ 
      ...prev, 
      botImage: '',
      useCustomImage: false 
    }));
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Chatbot name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let knowledgeBaseId = formData.knowledgeBaseId;

      await addChatbot({
        name: formData.name,
        description: formData.description,
        status: 'active',
        knowledge_base_id: knowledgeBaseId || null,
        configuration: {
          primaryColor: formData.primaryColor,
          position: formData.position,
          welcomeMessage: formData.welcomeMessage,
          personality: formData.personality,
          template: formData.template,
          selectedDocuments: selectedDocuments,
          botImage: formData.botImage,
          useCustomImage: formData.useCustomImage,
        },
      });

      // Reset form and close modal
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create chatbot');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedDocuments([]);
    setKnowledgeBaseDocuments([]);
    setImagePreview(null);
    setFormData({
      name: '',
      description: '',
      template: '',
      primaryColor: '#2563eb',
      position: 'bottom-right',
      welcomeMessage: 'Hello! How can I help you today?',
      personality: 'helpful',
      knowledgeBaseId: '',
      useExistingKnowledgeBase: true,
      newKnowledgeBaseName: '',
      newKnowledgeBaseDescription: '',
      botImage: '',
      useCustomImage: false
    });
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (isProcessing) {
      setShowCancelModal(true);
    } else if (!loading) {
      resetForm();
      onClose();
    }
  };

  const handleKnowledgeBaseCreated = (newKB: any) => {
    setFormData(prev => ({ 
      ...prev, 
      knowledgeBaseId: newKB.id,
      useExistingKnowledgeBase: true 
    }));
    setShowCreateKBModal(false);
  };

  if (!isOpen) return null;

  // Count processed documents in selected knowledge base
  const processedDocsInKB = knowledgeBaseDocuments.filter(doc => doc.status === 'processed').length;
  const processingDocsInKB = knowledgeBaseDocuments.filter(doc => doc.status === 'processing').length;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800">Create New Chatbot</h2>
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
              <div className={`flex-1 h-1 mx-2 ${step >= 4 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 4 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                4
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
                      Documents are being processed...
                    </p>
                    <p className="text-xs text-blue-600">
                      AI chunking and embedding in progress. Please wait for completion.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Choose a Template</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => {
                    const Icon = template.icon;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => handleTemplateSelect(template)}
                        disabled={isProcessing}
                        className={`p-4 border-2 rounded-lg text-left transition-all ${
                          formData.template === template.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center space-x-3 mb-3">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                            style={{ backgroundColor: template.color }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <h4 className="font-medium text-slate-800">{template.name}</h4>
                        </div>
                        <p className="text-sm text-slate-600">{template.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800">Knowledge Base Setup</h3>
                  <button
                    type="button"
                    onClick={() => setShowCreateKBModal(true)}
                    disabled={isProcessing}
                    className="flex items-center space-x-2 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New</span>
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Knowledge Base
                    </label>
                    <select
                      value={formData.knowledgeBaseId}
                      onChange={(e) => setFormData(prev => ({ ...prev, knowledgeBaseId: e.target.value }))}
                      disabled={isProcessing}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">No knowledge base (chatbot will use general knowledge)</option>
                      {knowledgeBases.map((kb) => (
                        <option key={kb.id} value={kb.id}>{kb.name}</option>
                      ))}
                    </select>
                    
                    {formData.knowledgeBaseId && knowledgeBaseDocuments.length > 0 && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-slate-700">
                            Documents in this knowledge base ({knowledgeBaseDocuments.length}):
                          </p>
                          {processingDocsInKB > 0 && (
                            <div className="flex items-center space-x-1 text-xs text-yellow-600">
                              <Loader className="w-3 h-3 animate-spin" />
                              <span>{processingDocsInKB} processing</span>
                            </div>
                          )}
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1 bg-slate-50 rounded-lg p-3">
                          {knowledgeBaseDocuments.map((doc) => (
                            <div key={doc.id} className="flex items-center space-x-2 text-sm">
                              <div className="flex items-center space-x-2">
                                <FileText className="w-4 h-4 text-slate-400" />
                                <span className={doc.status === 'processed' ? 'text-slate-700' : 'text-yellow-600'}>
                                  {doc.filename}
                                </span>
                              </div>
                              <span className="text-xs text-slate-400">
                                ({(doc.file_size / 1024).toFixed(1)} KB)
                              </span>
                              {doc.status === 'processing' && (
                                <div className="flex items-center space-x-1">
                                  <Loader className="w-3 h-3 animate-spin text-yellow-500" />
                                  <span className="text-xs text-yellow-600">Processing</span>
                                </div>
                              )}
                              {doc.status === 'processed' && (
                                <div className="flex items-center space-x-1">
                                  <Check className="w-3 h-3 text-green-500" />
                                  <span className="text-xs text-green-600">Ready</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {processedDocsInKB > 0 && (
                          <div className="mt-2 text-xs text-green-600 flex items-center space-x-1">
                            <Check className="w-3 h-3" />
                            <span>{processedDocsInKB} document{processedDocsInKB !== 1 ? 's' : ''} chunked & embedded</span>
                          </div>
                        )}
                      </div>
                    )}

                    {formData.knowledgeBaseId && knowledgeBaseDocuments.length === 0 && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Database className="w-4 h-4 text-yellow-600" />
                          <p className="text-sm text-yellow-700">
                            This knowledge base has no documents yet. The chatbot will use general knowledge.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {knowledgeBases.length === 0 && (
                    <div className="text-center py-8 border border-slate-200 rounded-lg">
                      <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 mb-2">No knowledge bases available</p>
                      <p className="text-sm text-slate-400 mb-4">
                        Create a knowledge base to organize your documents and enhance your chatbot's responses.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowCreateKBModal(true)}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Create Knowledge Base
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-slate-800">Bot Appearance</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Primary Color
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-12 h-12 border border-slate-300 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Position
                    </label>
                    <select
                      value={formData.position}
                      onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="center">Center</option>
                    </select>
                  </div>
                </div>

                {/* Bot Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Bot Avatar
                  </label>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="avatarType"
                          checked={!formData.useCustomImage}
                          onChange={() => setFormData(prev => ({ ...prev, useCustomImage: false }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-slate-700">Use default avatar (first letter)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="avatarType"
                          checked={formData.useCustomImage}
                          onChange={() => setFormData(prev => ({ ...prev, useCustomImage: true }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-slate-700">Upload custom image</span>
                      </label>
                    </div>

                    {formData.useCustomImage && (
                      <div className="space-y-4">
                        <div className="flex items-center space-x-4">
                          {imagePreview ? (
                            <div className="relative">
                              <img 
                                src={imagePreview} 
                                alt="Bot avatar preview"
                                className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
                              />
                              <button
                                type="button"
                                onClick={removeImage}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-slate-400" />
                            </div>
                          )}
                          
                          <div className="flex-1">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleFileSelect}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingImage}
                              className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                            >
                              {uploadingImage ? (
                                <>
                                  <Loader className="w-4 h-4 animate-spin" />
                                  <span>Uploading...</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4" />
                                  <span>{imagePreview ? 'Change Image' : 'Upload Image'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        
                        <p className="text-xs text-slate-500">
                          Upload an image for your bot avatar. Maximum size: 2MB. Recommended: Square image, 64x64px or larger.
                        </p>
                      </div>
                    )}

                    {/* Preview */}
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-slate-700 mb-2">Preview:</p>
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium overflow-hidden"
                          style={{ backgroundColor: formData.useCustomImage ? 'transparent' : formData.primaryColor }}
                        >
                          {formData.useCustomImage && imagePreview ? (
                            <img 
                              src={imagePreview} 
                              alt="Bot preview"
                              className="w-full h-full object-cover rounded-full"
                            />
                          ) : (
                            formData.name.charAt(0) || 'B'
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{formData.name || 'Bot Name'}</p>
                          <p className="text-xs text-slate-500">Online</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Chatbot Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    disabled={isProcessing}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="e.g., Customer Support Bot"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    disabled={isProcessing}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Describe what your chatbot will help with..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Welcome Message
                  </label>
                  <textarea
                    value={formData.welcomeMessage}
                    onChange={(e) => setFormData(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                    disabled={isProcessing}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="The first message users will see..."
                  />
                </div>

                {/* Summary */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-medium text-slate-800 mb-2">Summary</h4>
                  <div className="space-y-1 text-sm text-slate-600">
                    <p><span className="font-medium">Template:</span> {templates.find(t => t.id === formData.template)?.name || 'None'}</p>
                    <p><span className="font-medium">Knowledge Base:</span> {
                      formData.knowledgeBaseId 
                        ? (knowledgeBases.find(kb => kb.id === formData.knowledgeBaseId)?.name || 'Unknown')
                        : 'None (general knowledge)'
                    }</p>
                    <p><span className="font-medium">Documents:</span> {processedDocsInKB} processed, {processingDocsInKB} processing</p>
                    <p><span className="font-medium">Avatar:</span> {formData.useCustomImage ? 'Custom image' : 'Default (letter)'}</p>
                  </div>
                </div>
              </div>
            )}

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

              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && !formData.template) || 
                    isProcessing
                  }
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {isProcessing ? (
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
                  {loading ? 'Creating...' : 'Create Chatbot'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Create Knowledge Base Modal */}
      <CreateKnowledgeBaseModal
        isOpen={showCreateKBModal}
        onClose={() => setShowCreateKBModal(false)}
        onSuccess={handleKnowledgeBaseCreated}
      />

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Documents Processing</h3>
                  <p className="text-sm text-slate-600">Please wait for processing to complete</p>
                </div>
              </div>
              
              <p className="text-slate-700 mb-6">
                Documents are currently being processed with AI chunking and embedding. 
                Please wait for the processing to complete before closing this modal.
              </p>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Continue Waiting
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateChatbotModal;