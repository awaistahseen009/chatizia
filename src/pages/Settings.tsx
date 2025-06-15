import React, { useState } from 'react';
import { 
  Palette, 
  MessageSquare, 
  Bot, 
  Volume2, 
  Shield, 
  Globe,
  Save,
  RefreshCw,
  Upload,
  Image as ImageIcon,
  Loader
} from 'lucide-react';
import { useChatbot } from '../contexts/ChatbotContext';
import { supabase } from '../lib/supabase';

const Settings: React.FC = () => {
  const { selectedBot, updateChatbot } = useChatbot();
  const [activeTab, setActiveTab] = useState('appearance');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [settings, setSettings] = useState(() => {
    if (!selectedBot) return {};
    
    const config = selectedBot.configuration || {};
    return {
      // Appearance
      primaryColor: config.primaryColor || '#2563eb',
      secondaryColor: config.secondaryColor || '#64748b',
      fontFamily: config.fontFamily || 'system',
      fontSize: config.fontSize || 'medium',
      borderRadius: config.borderRadius || 'medium',
      botImage: config.botImage || '',
      useCustomImage: config.useCustomImage || false,
      // Widget Settings
      position: config.position || 'bottom-right',
      size: config.size || 'normal',
      showWelcomeMessage: config.showWelcomeMessage !== undefined ? config.showWelcomeMessage : true,
      minimizeAfterConversation: config.minimizeAfterConversation || false,
      enableSoundNotifications: config.enableSoundNotifications !== undefined ? config.enableSoundNotifications : true,
      // Personality
      communicationStyle: config.communicationStyle || 'professional',
      responseLength: config.responseLength || 'medium',
      tone: config.tone || 'helpful',
      language: config.language || 'en',
      // Behavior
      welcomeMessage: config.welcomeMessage || 'Hello! How can I help you today?',
      fallbackMessage: config.fallbackMessage || 'I\'m sorry, I didn\'t understand that. Could you please rephrase?',
      collectEmail: config.collectEmail !== undefined ? config.collectEmail : true,
      showTypingIndicator: config.showTypingIndicator !== undefined ? config.showTypingIndicator : true,
      // Voice
      enableVoice: config.enableVoice || false,
      voiceId: config.voiceId || 'alloy',
      speechSpeed: config.speechSpeed || 1.0,
      // Security
      enableRateLimit: config.enableRateLimit !== undefined ? config.enableRateLimit : true,
      maxMessagesPerHour: config.maxMessagesPerHour || 100,
      profanityFilter: config.profanityFilter !== undefined ? config.profanityFilter : true,
      // Advanced
      contextMemory: config.contextMemory || 10,
      enableAnalytics: config.enableAnalytics !== undefined ? config.enableAnalytics : true,
      customCSS: config.customCSS || ''
    };
  });

  React.useEffect(() => {
    if (selectedBot?.configuration?.botImage) {
      setImagePreview(selectedBot.configuration.botImage);
    }
  }, [selectedBot]);

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'widget', label: 'Widget Settings', icon: Globe },
    { id: 'personality', label: 'Personality', icon: MessageSquare },
    { id: 'behavior', label: 'Behavior', icon: Bot },
    { id: 'voice', label: 'Voice', icon: Volume2 },
    { id: 'security', label: 'Security', icon: Shield }
  ];

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be less than 2MB');
      return;
    }

    setUploadingImage(true);

    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('chatbot-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chatbot-logos')
        .getPublicUrl(fileName);

      setSettings(prev => ({ 
        ...prev, 
        botImage: publicUrl,
        useCustomImage: true 
      }));
      setImagePreview(publicUrl);

    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload image');
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
    setSettings(prev => ({ 
      ...prev, 
      botImage: '',
      useCustomImage: false 
    }));
    setImagePreview(null);
  };

  const handleSave = async () => {
    if (!selectedBot) return;

    setLoading(true);
    try {
      await updateChatbot(selectedBot.id, {
        configuration: {
          ...selectedBot.configuration,
          ...settings
        }
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      alert('Failed to save settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (!selectedBot) return;
    
    const config = selectedBot.configuration || {};
    setSettings({
      primaryColor: config.primaryColor || '#2563eb',
      secondaryColor: config.secondaryColor || '#64748b',
      fontFamily: config.fontFamily || 'system',
      fontSize: config.fontSize || 'medium',
      borderRadius: config.borderRadius || 'medium',
      botImage: config.botImage || '',
      useCustomImage: config.useCustomImage || false,
      position: config.position || 'bottom-right',
      size: config.size || 'normal',
      showWelcomeMessage: config.showWelcomeMessage !== undefined ? config.showWelcomeMessage : true,
      minimizeAfterConversation: config.minimizeAfterConversation || false,
      enableSoundNotifications: config.enableSoundNotifications !== undefined ? config.enableSoundNotifications : true,
      communicationStyle: config.communicationStyle || 'professional',
      responseLength: config.responseLength || 'medium',
      tone: config.tone || 'helpful',
      language: config.language || 'en',
      welcomeMessage: config.welcomeMessage || 'Hello! How can I help you today?',
      fallbackMessage: config.fallbackMessage || 'I\'m sorry, I didn\'t understand that. Could you please rephrase?',
      collectEmail: config.collectEmail !== undefined ? config.collectEmail : true,
      showTypingIndicator: config.showTypingIndicator !== undefined ? config.showTypingIndicator : true,
      enableVoice: config.enableVoice || false,
      voiceId: config.voiceId || 'alloy',
      speechSpeed: config.speechSpeed || 1.0,
      enableRateLimit: config.enableRateLimit !== undefined ? config.enableRateLimit : true,
      maxMessagesPerHour: config.maxMessagesPerHour || 100,
      profanityFilter: config.profanityFilter !== undefined ? config.profanityFilter : true,
      contextMemory: config.contextMemory || 10,
      enableAnalytics: config.enableAnalytics !== undefined ? config.enableAnalytics : true,
      customCSS: config.customCSS || ''
    });
    setImagePreview(config.botImage || null);
  };

  if (!selectedBot) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Bot className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Select a chatbot to configure its settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Configure Chatbot</h1>
          <p className="text-slate-600 mt-1">Customize {selectedBot.name} appearance and behavior</p>
        </div>
        <div className="flex items-center space-x-3">
          {success && (
            <span className="text-green-600 text-sm font-medium">Settings saved!</span>
          )}
          <button 
            onClick={handleReset}
            className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset</span>
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg border border-slate-200">
            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="p-6 space-y-6">
                <h2 className="text-xl font-semibold text-slate-800">Appearance Settings</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Primary Color
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={settings.primaryColor}
                        onChange={(e) => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-12 h-12 border border-slate-300 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.primaryColor}
                        onChange={(e) => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Secondary Color
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={settings.secondaryColor}
                        onChange={(e) => setSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        className="w-12 h-12 border border-slate-300 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.secondaryColor}
                        onChange={(e) => setSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Font Family
                    </label>
                    <select
                      value={settings.fontFamily}
                      onChange={(e) => setSettings(prev => ({ ...prev, fontFamily: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="system">System Default</option>
                      <option value="inter">Inter</option>
                      <option value="roboto">Roboto</option>
                      <option value="poppins">Poppins</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Font Size
                    </label>
                    <select
                      value={settings.fontSize}
                      onChange={(e) => setSettings(prev => ({ ...prev, fontSize: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                </div>

                {/* Bot Avatar */}
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
                          checked={!settings.useCustomImage}
                          onChange={() => setSettings(prev => ({ ...prev, useCustomImage: false }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-slate-700">Use default avatar (first letter)</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="avatarType"
                          checked={settings.useCustomImage}
                          onChange={() => setSettings(prev => ({ ...prev, useCustomImage: true }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-slate-700">Upload custom image</span>
                      </label>
                    </div>

                    {settings.useCustomImage && (
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
                              type="file"
                              accept="image/*"
                              onChange={handleFileSelect}
                              className="hidden"
                              id="avatar-upload"
                            />
                            <label
                              htmlFor="avatar-upload"
                              className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
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
                            </label>
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
                          style={{ backgroundColor: settings.useCustomImage ? 'transparent' : settings.primaryColor }}
                        >
                          {settings.useCustomImage && imagePreview ? (
                            <img 
                              src={imagePreview} 
                              alt="Bot preview"
                              className="w-full h-full object-cover rounded-full"
                            />
                          ) : (
                            selectedBot.name.charAt(0) || 'B'
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{selectedBot.name}</p>
                          <p className="text-xs text-slate-500">Online</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Widget Settings Tab */}
            {activeTab === 'widget' && (
              <div className="p-6 space-y-6">
                <h2 className="text-xl font-semibold text-slate-800">Widget Settings</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Position
                    </label>
                    <select
                      value={settings.position}
                      onChange={(e) => setSettings(prev => ({ ...prev, position: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="center">Center</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Size
                    </label>
                    <select
                      value={settings.size}
                      onChange={(e) => setSettings(prev => ({ ...prev, size: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="compact">Compact</option>
                      <option value="normal">Normal</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Behavior</h3>
                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        checked={settings.showWelcomeMessage}
                        onChange={(e) => setSettings(prev => ({ ...prev, showWelcomeMessage: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="ml-2 text-sm text-slate-700">Show welcome message automatically</span>
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        checked={settings.minimizeAfterConversation}
                        onChange={(e) => setSettings(prev => ({ ...prev, minimizeAfterConversation: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="ml-2 text-sm text-slate-700">Minimize after conversation ends</span>
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        checked={settings.enableSoundNotifications}
                        onChange={(e) => setSettings(prev => ({ ...prev, enableSoundNotifications: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                      />
                      <span className="ml-2 text-slate-700 text-sm">Enable sound notifications</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Personality Tab */}
            {activeTab === 'personality' && (
              <div className="p-6 space-y-6">
                <h2 className="text-xl font-semibold text-slate-800">Personality Settings</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Communication Style
                    </label>
                    <div className="flex items-center space-x-4">
                      {['casual', 'professional', 'friendly', 'formal'].map((style) => (
                        <label key={style} className="flex items-center">
                          <input
                            type="radio"
                            name="communicationStyle"
                            value={style}
                            checked={settings.communicationStyle === style}
                            onChange={(e) => setSettings(prev => ({ ...prev, communicationStyle: e.target.value }))}
                            className="mr-2"
                          />
                          <span className="text-sm text-slate-700 capitalize">{style}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Response Length
                    </label>
                    <div className="flex items-center space-x-6">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="responseLength"
                          value="brief"
                          checked={settings.responseLength === 'brief'}
                          onChange={(e) => setSettings(prev => ({ ...prev, responseLength: e.target.value }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-slate-700">Brief</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="responseLength"
                          value="medium"
                          checked={settings.responseLength === 'medium'}
                          onChange={(e) => setSettings(prev => ({ ...prev, responseLength: e.target.value }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-slate-700">Medium</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="responseLength"
                          value="detailed"
                          checked={settings.responseLength === 'detailed'}
                          onChange={(e) => setSettings(prev => ({ ...prev, responseLength: e.target.value }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-slate-700">Detailed</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Tone
                    </label>
                    <select
                      value={settings.tone}
                      onChange={(e) => setSettings(prev => ({ ...prev, tone: e.target.value }))}
                      className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="helpful">Helpful</option>
                      <option value="authoritative">Authoritative</option>
                      <option value="empathetic">Empathetic</option>
                      <option value="enthusiastic">Enthusiastic</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Language
                    </label>
                    <select
                      value={settings.language}
                      onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
                      className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="it">Italian</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Behavior Tab */}
            {activeTab === 'behavior' && (
              <div className="p-6 space-y-6">
                <h2 className="text-xl font-semibold text-slate-800">Behavior Settings</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Welcome Message
                    </label>
                    <textarea
                      value={settings.welcomeMessage}
                      onChange={(e) => setSettings(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="Enter your welcome message..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Fallback Message
                    </label>
                    <textarea
                      value={settings.fallbackMessage}
                      onChange={(e) => setSettings(prev => ({ ...prev, fallbackMessage: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="Message when the bot doesn't understand..."
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.collectEmail}
                        onChange={(e) => setSettings(prev => ({ ...prev, collectEmail: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-slate-700">Collect user email addresses</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.showTypingIndicator}
                        onChange={(e) => setSettings(prev => ({ ...prev, showTypingIndicator: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-slate-700">Show typing indicator</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Voice Tab */}
            {activeTab === 'voice' && (
              <div className="p-6 space-y-6">
                <h2 className="text-xl font-semibold text-slate-800">Voice Settings</h2>
                
                <div className="space-y-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.enableVoice}
                      onChange={(e) => setSettings(prev => ({ ...prev, enableVoice: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">Enable voice responses</span>
                  </label>

                  {settings.enableVoice && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Voice Selection
                        </label>
                        <select
                          value={settings.voiceId}
                          onChange={(e) => setSettings(prev => ({ ...prev, voiceId: e.target.value }))}
                          className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        >
                          <option value="alloy">Alloy (Neutral)</option>
                          <option value="echo">Echo (Professional)</option>
                          <option value="fable">Fable (Friendly)</option>
                          <option value="onyx">Onyx (Deep)</option>
                          <option value="nova">Nova (Bright)</option>
                          <option value="shimmer">Shimmer (Gentle)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Speech Speed: {settings.speechSpeed}x
                        </label>
                        <input
                          type="range"
                          min="0.5"
                          max="2"
                          step="0.1"
                          value={settings.speechSpeed}
                          onChange={(e) => setSettings(prev => ({ ...prev, speechSpeed: parseFloat(e.target.value) }))}
                          className="w-full max-w-md"
                        />
                        <div className="flex justify-between text-xs text-slate-500 max-w-md">
                          <span>0.5x</span>
                          <span>1x</span>
                          <span>2x</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="p-6 space-y-6">
                <h2 className="text-xl font-semibold text-slate-800">Security Settings</h2>
                
                <div className="space-y-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.enableRateLimit}
                      onChange={(e) => setSettings(prev => ({ ...prev, enableRateLimit: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">Enable rate limiting</span>
                  </label>

                  {settings.enableRateLimit && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Max Messages Per Hour
                      </label>
                      <input
                        type="number"
                        value={settings.maxMessagesPerHour}
                        onChange={(e) => setSettings(prev => ({ ...prev, maxMessagesPerHour: parseInt(e.target.value) }))}
                        className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                  )}

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.profanityFilter}
                      onChange={(e) => setSettings(prev => ({ ...prev, profanityFilter: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">Enable profanity filter</span>
                  </label>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Context Memory (messages)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={settings.contextMemory}
                      onChange={(e) => setSettings(prev => ({ ...prev, contextMemory: parseInt(e.target.value) }))}
                      className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Number of previous messages to remember for context
                    </p>
                  </div>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.enableAnalytics}
                      onChange={(e) => setSettings(prev => ({ ...prev, enableAnalytics: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">Enable analytics tracking</span>
                  </label>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Custom CSS
                    </label>
                    <textarea
                      value={settings.customCSS}
                      onChange={(e) => setSettings(prev => ({ ...prev, customCSS: e.target.value }))}
                      rows={8}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
                      placeholder="/* Add custom CSS here */&#10;.chatbot-widget {&#10;  /* Your styles */&#10;}"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;