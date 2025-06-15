import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Paperclip, Mic, Volume2, Minimize2, Maximize2, Brain, ExternalLink, Play, Pause, MicOff, FileText, Expand, User } from 'lucide-react';
import { useChatbot as useChatbotContext } from '../contexts/ChatbotContext';
import { useChatbot } from '../hooks/useChatbot';
import { openai } from '../lib/openai';
import { supabase } from '../lib/supabase';

interface ChatbotPreviewProps {
  visible: boolean;
  onClose: () => void;
  chatbot?: any;
  embedded?: boolean;
}

interface VoiceMessage {
  audioUrl: string;
  duration?: number;
  isPlaying?: boolean;
}

interface ExtendedMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'agent';
  timestamp: Date;
  sources?: string[];
  voice?: VoiceMessage;
}

const ChatbotPreview: React.FC<ChatbotPreviewProps> = ({ visible, onClose, chatbot: propChatbot, embedded = false }) => {
  // Safely use context - it might not be available in embedded mode
  let selectedBot = null;
  try {
    const context = useChatbotContext();
    selectedBot = context?.selectedBot;
  } catch (error) {
    // Context not available, which is fine for embedded mode
    console.log('ChatbotProvider context not available - using prop chatbot');
  }

  const bot = propChatbot || selectedBot;
  const { messages: hookMessages, isTyping, sendMessage, initializeChat, agentTakenOver, assignedAgent } = useChatbot(bot);
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [replyMode, setReplyMode] = useState<'text' | 'voice'>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [showTranscript, setShowTranscript] = useState<Record<string, boolean>>({});
  const [microphoneSupported, setMicrophoneSupported] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // ElevenLabs configuration
  const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
  const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
  const VOICE_ID = '56AoDkrOh6qfVPDXZ7Pt';

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time subscription for messages
  useEffect(() => {
    if (!bot || !visible || !currentSessionId) return;

    console.log('🔄 Setting up real-time message subscription for chatbot:', bot.id);

    // Subscribe to messages for this specific conversation
    const messageSubscription = supabase
      .channel(`chatbot-messages-${currentSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${currentSessionId}`,
        },
        (payload) => {
          console.log('💬 New message received in chatbot preview:', payload.new);
          
          // Only add assistant messages (bot or agent responses)
          if (payload.new.role === 'assistant') {
            const newMessage: ExtendedMessage = {
              id: payload.new.id,
              text: payload.new.content,
              sender: payload.new.agent_id ? 'agent' : 'bot',
              timestamp: new Date(payload.new.created_at),
            };

            setMessages(prev => {
              // Check if message already exists to avoid duplicates
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) {
                console.log('💬 Message already exists in chatbot preview, skipping duplicate');
                return prev;
              }
              
              console.log('💬 Adding new message to chatbot preview:', newMessage);
              return [...prev, newMessage];
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔄 Cleaning up message subscription');
      messageSubscription.unsubscribe();
    };
  }, [bot?.id, visible, currentSessionId]);

  // Check microphone permissions and support
  useEffect(() => {
    const checkMicrophoneSupport = async () => {
      try {
        // Check if we're in a secure context (HTTPS or localhost)
        if (!window.isSecureContext) {
          console.log('⚠️ Microphone requires secure context (HTTPS)');
          setMicrophoneSupported(false);
          return;
        }

        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.log('⚠️ getUserMedia not supported');
          setMicrophoneSupported(false);
          return;
        }

        // Check permissions policy
        if ('permissions' in navigator) {
          const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (permission.state === 'denied') {
            console.log('⚠️ Microphone permission denied');
            setMicrophoneSupported(false);
            return;
          }
        }

        setMicrophoneSupported(true);
      } catch (error) {
        console.log('⚠️ Error checking microphone support:', error);
        setMicrophoneSupported(false);
      }
    };

    checkMicrophoneSupport();
  }, []);

  useEffect(() => {
    if (bot && visible) {
      initializeChat();
      // Use session ID from props if available (for embedded mode)
      if (bot.currentSessionId && !currentSessionId) {
        setCurrentSessionId(bot.currentSessionId);
        console.log('🔄 Using session ID from props:', bot.currentSessionId);
      } else if (!currentSessionId) {
        // Generate session ID when chat initializes
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        setCurrentSessionId(sessionId);
        console.log('🔄 Generated session ID:', sessionId);
      }
    }
  }, [bot, visible]);

  // Convert hook messages to extended messages
  useEffect(() => {
    const extendedMessages: ExtendedMessage[] = hookMessages.map(msg => ({
      id: msg.id,
      text: msg.text,
      sender: msg.sender,
      timestamp: msg.timestamp,
      sources: msg.sources,
    }));
    setMessages(extendedMessages);
  }, [hookMessages]);

  // Auto-generate voice for bot responses in voice mode (but don't auto-play)
  useEffect(() => {
    if (replyMode === 'voice' && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if ((lastMessage.sender === 'bot' || lastMessage.sender === 'agent') && !lastMessage.voice && !isTyping) {
        generateBotVoiceResponse(lastMessage);
      }
    }
  }, [messages, replyMode, isTyping]);

  const generateBotVoiceResponse = async (message: ExtendedMessage) => {
    if (!ELEVENLABS_API_KEY) {
      console.warn('ElevenLabs API key not configured');
      setErrorMessage('Voice features unavailable: API key missing');
      return;
    }

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: message.text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Text-to-speech failed: ${response.status} ${errorText}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Update the message with voice data (but don't auto-play)
      setMessages(prev => prev.map(msg => 
        msg.id === message.id 
          ? { ...msg, voice: { audioUrl, duration: 0 } }
          : msg
      ));

    } catch (error) {
      console.error('Failed to generate voice response:', error);
      setErrorMessage('Failed to generate bot voice response');
    }
  };

  const startRecording = async () => {
    if (!OPENAI_API_KEY) {
      setErrorMessage('Voice features require OpenAI API key in VITE_OPENAI_API_KEY');
      return;
    }

    if (!microphoneSupported) {
      setErrorMessage('Microphone not supported or permission denied. Voice features require HTTPS and microphone permissions.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        if (audioBlob.size > 0) {
          console.log(`Audio Blob Size: ${audioBlob.size} bytes, Duration: ${recordingTime}s, Type: ${audioBlob.type}`);
          await processVoiceMessage(audioBlob, recordingTime);
        } else {
          setErrorMessage('No audio data captured. Please try again.');
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      setErrorMessage(null);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setErrorMessage('Microphone permission denied. Please allow microphone access and try again.');
        } else if (error.name === 'NotFoundError') {
          setErrorMessage('No microphone found. Please connect a microphone and try again.');
        } else {
          setErrorMessage('Failed to access microphone. Please check permissions and try again.');
        }
      } else {
        setErrorMessage('Failed to access microphone. Please check permissions and try again.');
      }
      setMicrophoneSupported(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const processVoiceMessage = async (audioBlob: Blob, durationSeconds: number) => {
    setIsProcessingVoice(true);
    
    try {
      console.log(`Sending audio: Size=${audioBlob.size} bytes, Type=${audioBlob.type}, Duration=${durationSeconds}s`);

      if (!openai) {
        throw new Error('OpenAI client not initialized. Please check your API key configuration.');
      }

      const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en',
        response_format: 'text'
      });

      console.log('Transcription response:', transcription);
      
      const transcribedText = typeof transcription === 'string' ? transcription : transcription.text;

      if (!transcribedText || transcribedText.trim().length === 0) {
        throw new Error('No speech detected in the recording. Please speak clearly and try again.');
      }

      const audioUrl = URL.createObjectURL(audioBlob);

      const userVoiceMessage: ExtendedMessage = {
        id: `voice-${Date.now()}`,
        text: transcribedText,
        sender: 'user',
        timestamp: new Date(),
        voice: { audioUrl }
      };

      setMessages(prev => [...prev, userVoiceMessage]);
      await sendMessage(transcribedText);

    } catch (error) {
      console.error('Voice processing failed:', error);
      const message = error instanceof Error 
        ? error.message.includes('API key') 
          ? 'Voice transcription failed: Please check your OpenAI API key configuration.'
          : error.message
        : 'Voice processing failed. Please try again.';
      setErrorMessage(message);
    } finally {
      setIsProcessingVoice(false);
      setRecordingTime(0);
    }
  };

  const playVoiceMessage = (messageId: string, audioUrl: string) => {
    audioRefs.current.forEach((audio, id) => {
      if (id !== messageId) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    let audio = audioRefs.current.get(messageId);
    
    if (!audio) {
      audio = new Audio(audioUrl);
      audioRefs.current.set(messageId, audio);
      
      audio.onended = () => {
        setPlayingMessageId(null);
      };
      
      audio.onerror = () => {
        console.error('Audio playback error');
        setPlayingMessageId(null);
        setErrorMessage('Failed to play audio message');
      };
    }

    if (playingMessageId === messageId) {
      audio.pause();
      setPlayingMessageId(null);
    } else {
      audio.currentTime = 0;
      audio.play().then(() => {
        setPlayingMessageId(messageId);
      }).catch(error => {
        console.error('Audio play error:', error);
        setErrorMessage('Failed to play audio message');
      });
    }
  };

  const toggleTranscript = (messageId: string) => {
    setShowTranscript(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isTyping) return;

    const messageText = inputText.trim();
    setInputText('');

    await sendMessage(messageText);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!visible) return null;

  // Ensure we have a valid bot configuration with safe defaults
  const botConfig = bot || {
    id: 'preview-bot',
    name: 'AI Assistant',
    description: '',
    configuration: {
      primaryColor: '#2563eb',
      position: 'bottom-right',
      welcomeMessage: 'Hello! How can I help you today?',
      useCustomImage: false,
      botImage: ''
    }
  };

  // Ensure configuration exists with safe defaults
  const safeConfig = {
    primaryColor: '#2563eb',
    position: 'bottom-right',
    welcomeMessage: 'Hello! How can I help you today?',
    useCustomImage: false,
    botImage: '',
    ...botConfig.configuration
  };

  // Ensure name is always a string
  const safeName = botConfig.name || 'AI Assistant';
  const primaryColor = safeConfig.primaryColor || '#2563eb';
  const botImage = safeConfig.botImage;
  const useCustomImage = safeConfig.useCustomImage && botImage;

  // Check for agent intervention from props
  const agentInterventionDetected = bot?.agentInterventionDetected || agentTakenOver;
  const currentAgentName = bot?.currentAgentName || assignedAgent?.name;

  // Determine container classes based on fullscreen state and embedded mode
  const containerClasses = embedded 
    ? "w-full h-full min-h-screen" 
    : isFullscreen 
      ? "fixed inset-0 z-50" 
      : "fixed right-6 top-20 bottom-6 w-80 z-50";

  return (
    <div className={containerClasses}>
      <div className="bg-white rounded-lg shadow-2xl border border-slate-200 h-full flex flex-col overflow-hidden">
        <div 
          className="p-4 border-b border-slate-200 flex items-center justify-between"
          style={{ backgroundColor: `${primaryColor}15` }}
        >
          <div className="flex items-center space-x-3">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium overflow-hidden"
              style={{ backgroundColor: useCustomImage ? 'transparent' : (bot.configuration?.primaryColor || '#2563eb') }}
            >
              {useCustomImage ? (
                <img 
                  src={botImage} 
                  alt={safeName}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    // Fallback to letter avatar if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement!.style.backgroundColor = primaryColor;
                    target.parentElement!.textContent = safeName.charAt(0).toUpperCase();
                  }}
                />
              ) : (
                safeName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h3 className="font-medium text-slate-800">{safeName}</h3>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-xs text-slate-500">
                  {agentInterventionDetected ? 
                    `Agent: ${currentAgentName || 'Human Agent'}` : 
                    'Online'
                  }
                  {embedded ? '' : ' • Preview Mode'}
                </p>
                {bot?.knowledge_base_id && (
                  <div className="flex items-center space-x-1 ml-2">
                    <Brain className="w-3 h-3 text-purple-500" />
                    <span className="text-xs text-purple-600">KB</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {!embedded && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1 rounded hover:bg-slate-100 transition-colors"
                title={isFullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
              >
                <Expand className="w-4 h-4 text-slate-400" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 rounded hover:bg-slate-100 transition-colors"
                title={isMinimized ? 'Maximize' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 className="w-4 h-4 text-slate-400" /> : <Minimize2 className="w-4 h-4 text-slate-400" />}
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          )}
        </div>

        {!isMinimized && (
          <>
            {/* Agent Takeover Notice */}
            {agentInterventionDetected && (
              <div className="p-3 bg-green-50 border-b border-green-200">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">
                    Connected to {currentAgentName || 'Human Agent'} (Human Agent)
                  </span>
                </div>
              </div>
            )}

            <div className="p-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-center space-x-1 bg-white rounded-lg p-1">
                <button
                  onClick={() => setReplyMode('text')}
                  className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    replyMode === 'text' 
                      ? 'bg-blue-100 text-blue-700 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>Text</span>
                </button>
                <button
                  onClick={() => setReplyMode('voice')}
                  disabled={!microphoneSupported}
                  className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    replyMode === 'voice' 
                      ? 'bg-blue-100 text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  } ${!microphoneSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Voice</span>
                </button>
              </div>
              {!microphoneSupported && (
                <p className="text-xs text-amber-600 mt-2 text-center">
                  Voice features require HTTPS and microphone permissions
                </p>
              )}
              {!OPENAI_API_KEY && (
                <p className="text-xs text-amber-600 mt-2 text-center">
                  Voice features require OpenAI API key
                </p>
              )}
              {errorMessage && (
                <div className="mt-2 p-2 bg-red-100 text-red-600 text-xs text-center rounded">
                  {errorMessage}
                  <button
                    onClick={() => setErrorMessage(null)}
                    className="ml-2 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="flex items-start space-x-2 max-w-[85%]">
                    {(message.sender === 'bot' || message.sender === 'agent') && (
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 mt-1 overflow-hidden"
                        style={{ backgroundColor: useCustomImage ? 'transparent' : primaryColor }}
                      >
                        {message.sender === 'agent' ? (
                          <User className="w-4 h-4" />
                        ) : useCustomImage ? (
                          <img 
                            src={botImage} 
                            alt={safeName}
                            className="w-full h-full object-cover rounded-full"
                            onError={(e) => {
                              // Fallback to letter avatar if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.parentElement!.style.backgroundColor = primaryColor;
                              target.parentElement!.textContent = safeName.charAt(0).toUpperCase();
                            }}
                          />
                        ) : (
                          safeName.charAt(0).toUpperCase()
                        )}
                      </div>
                    )}
                    <div
                      className={`px-3 py-2 rounded-lg ${
                        message.sender === 'user'
                          ? 'text-white'
                          : message.sender === 'agent'
                          ? 'bg-green-100 text-green-800 border border-green-200'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                      style={
                        message.sender === 'user' 
                          ? { backgroundColor: primaryColor }
                          : {}
                      }
                    >
                      {/* Voice message display - only show in voice mode */}
                      {message.voice && replyMode === 'voice' && (
                        <div className="mb-2">
                          <div className="flex items-center space-x-2 bg-black/10 rounded-lg p-2">
                            <button
                              onClick={() => playVoiceMessage(message.id, message.voice!.audioUrl)}
                              className="p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                            >
                              {playingMessageId === message.id ? (
                                <Pause className="w-3 h-3" />
                              ) : (
                                <Play className="w-3 h-3" />
                              )}
                            </button>
                            <div className="flex-1 h-1 bg-white/20 rounded-full">
                              <div className="h-full bg-white/40 rounded-full" style={{ width: '0%' }}></div>
                            </div>
                            <Volume2 className="w-3 h-3 opacity-60" />
                            <button
                              onClick={() => toggleTranscript(message.id)}
                              className="p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                              title="Toggle transcript"
                            >
                              <FileText className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Text content - show transcript only if toggled on in voice mode, or always in text mode */}
                      {(replyMode === 'text' || !message.voice || showTranscript[message.id]) && (
                        <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                      )}
                      
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <div className="flex items-center space-x-1 text-xs text-slate-500">
                            <Brain className="w-3 h-3" />
                            <span>Sources: Knowledge Base</span>
                          </div>
                        </div>
                      )}
                      
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2 max-w-[85%]">
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 mt-1 overflow-hidden"
                      style={{ backgroundColor: useCustomImage ? 'transparent' : primaryColor }}
                    >
                      {useCustomImage ? (
                        <img 
                          src={botImage} 
                          alt={safeName}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            // Fallback to letter avatar if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.style.backgroundColor = primaryColor;
                            target.parentElement!.textContent = safeName.charAt(0).toUpperCase();
                          }}
                        />
                      ) : (
                        safeName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="bg-slate-100 px-3 py-2 rounded-lg">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isProcessingVoice && (
                <div className="flex justify-center">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-blue-700">Processing voice message...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-200">
              {replyMode === 'text' ? (
                <div className="flex items-end space-x-2">
                  <div className="flex-1 relative">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={agentInterventionDetected ? "Agent is handling this conversation..." : "Type your message..."}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:border-transparent outline-none text-sm resize-none"
                      style={{ focusRingColor: primaryColor }}
                      rows={1}
                      disabled={isTyping || agentInterventionDetected}
                    />
                  </div>
                  <div className="flex items-center space-x-1">
                    <button 
                      className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Attach file"
                      disabled={isTyping || agentInterventionDetected}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleSendMessage}
                      className="p-2 text-white rounded-lg transition-colors disabled:opacity-50"
                      style={{ backgroundColor: primaryColor }}
                      disabled={!inputText.trim() || isTyping || agentInterventionDetected}
                      title="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isProcessingVoice || !OPENAI_API_KEY || !microphoneSupported || agentInterventionDetected}
                        className={`p-4 rounded-full transition-all duration-200 ${
                          isRecording 
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg scale-110' 
                            : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={
                          agentInterventionDetected
                            ? 'Agent is handling this conversation'
                            : !microphoneSupported 
                            ? 'Microphone not supported or permission denied'
                            : !OPENAI_API_KEY
                            ? 'OpenAI API key required for voice features'
                            : isRecording 
                            ? 'Stop recording' 
                            : 'Start voice recording'
                        }
                      >
                        {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                      </button>
                      
                      {isRecording && (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-slate-700">
                            {formatTime(recordingTime)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-slate-500">
                      {agentInterventionDetected
                        ? 'Agent is handling this conversation'
                        : !microphoneSupported
                        ? 'Voice features require HTTPS and microphone permissions'
                        : isRecording 
                        ? 'Recording... Tap the microphone to stop'
                        : isProcessingVoice
                        ? 'Processing your voice message...'
                        : 'Tap the microphone to start recording'}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center space-x-2">
                  {bot?.knowledge_base_id && !agentInterventionDetected && (
                    <div className="flex items-center space-x-1">
                      <Brain className="w-3 h-3 text-purple-500" />
                      <span className="text-purple-600">Knowledge base connected</span>
                    </div>
                  )}
                  {replyMode === 'voice' && ELEVENLABS_API_KEY && (
                    <div className="flex items-center space-x-1">
                      <Volume2 className="w-3 h-3 text-blue-500" />
                      <span className="text-blue-600">Voice AI enabled</span>
                    </div>
                  )}
                  {agentInterventionDetected && (
                    <div className="flex items-center space-x-1">
                      <User className="w-3 h-3 text-green-500" />
                      <span className="text-green-600">Human agent active</span>
                    </div>
                  )}
                </div>
                
                {OPENAI_API_KEY ? (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>AI powered</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span>Demo mode</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export { ChatbotPreview as default };