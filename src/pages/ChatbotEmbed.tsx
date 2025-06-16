import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChatbotSecurity } from '../lib/chatbotSecurity';
import ChatbotPreview from '../components/ChatbotPreview';
import LoadingSpinner from '../components/LoadingSpinner';
import { realtimeService } from '../lib/realtime';

const ChatbotEmbed: React.FC = () => {
  const { chatbotId } = useParams<{ chatbotId: string }>();
  const [searchParams] = useSearchParams();
  const [chatbot, setChatbot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [securityValidated, setSecurityValidated] = useState(false);
  const [agentInterventionDetected, setAgentInterventionDetected] = useState(false);
  const [currentAgentName, setCurrentAgentName] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const isEmbedded = searchParams.get('embedded') === 'true';
  const token = searchParams.get('token');
  const domain = searchParams.get('domain');

  useEffect(() => {
    const initializeChatbot = async () => {
      if (!chatbotId) {
        setError('Chatbot ID not provided');
        setLoading(false);
        return;
      }

      try {
        console.log('🚀 Initializing chatbot embed:', { chatbotId, isEmbedded, hasToken: !!token });

        // Try direct query first for better reliability
        console.log('📊 Fetching chatbot data...');
        const { data: chatbotData, error: chatbotError } = await supabase
          .from('chatbots')
          .select(`
            id,
            name,
            description,
            status,
            configuration,
            knowledge_base_id
          `)
          .eq('id', chatbotId)
          .eq('status', 'active')
          .single();

        if (chatbotError || !chatbotData) {
          console.error('❌ Failed to fetch chatbot:', chatbotError);
          setError('Chatbot not found or inactive');
          setLoading(false);
          return;
        }

        // Ensure we have valid chatbot data with required fields
        if (!chatbotData.id || !chatbotData.name) {
          console.error('❌ Invalid chatbot data:', chatbotData);
          setError('Invalid chatbot configuration');
          setLoading(false);
          return;
        }

        // Check if chatbot is active
        if (chatbotData.status !== 'active') {
          console.log('❌ Chatbot is not active:', chatbotData.status);
          setError('This chatbot is currently unavailable');
          setLoading(false);
          return;
        }

        // Ensure configuration exists with defaults
        const safeConfiguration = {
          primaryColor: '#2563eb',
          position: 'bottom-right',
          welcomeMessage: 'Hello! How can I help you today?',
          personality: 'helpful',
          useCustomImage: false,
          botImage: '',
          ...chatbotData.configuration
        };

        const safeChatbot = {
          ...chatbotData,
          name: chatbotData.name || 'AI Assistant',
          description: chatbotData.description || '',
          configuration: safeConfiguration
        };

        console.log('✅ Chatbot data loaded:', safeChatbot.name);
        
        // Generate session ID for this chat session
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        setCurrentSessionId(sessionId);
        console.log('🔄 Generated session ID:', sessionId);
        
        setChatbot(safeChatbot);

        // Validate domain security if token is provided
        if (token) {
          const referrerDomain = ChatbotSecurity.getReferrerDomain();
          const targetDomain = domain || referrerDomain;

          console.log('🔒 Validating domain security:', { targetDomain, token: token.substring(0, 8) + '...' });

          if (!targetDomain) {
            console.log('⚠️ Unable to determine domain, allowing access without validation');
            setSecurityValidated(true);
            setLoading(false);
            return;
          }

          const validation = await ChatbotSecurity.validateDomainAndToken(
            targetDomain,
            token,
            chatbotId
          );

          if (!validation.isValid) {
            console.log('❌ Domain validation failed:', validation.error);
            setError(validation.error || 'Access denied');
            setLoading(false);
            return;
          }

          console.log('✅ Domain validation successful');
          setSecurityValidated(true);
        } else {
          // Allow access without token (less secure)
          console.log('⚠️ No token provided, allowing basic access');
          setSecurityValidated(true);
        }

      } catch (err) {
        console.error('❌ Error initializing chatbot:', err);
        setError('Failed to initialize chatbot');
      } finally {
        setLoading(false);
      }
    };

    initializeChatbot();
  }, [chatbotId, token, domain]);

  // Set up real-time subscriptions for agent intervention
  useEffect(() => {
    if (!chatbotId || !currentSessionId) return;

    console.log('🔄 Setting up real-time agent intervention detection for chatbot:', chatbotId);

    // Subscribe to agent intervention events
    realtimeService.subscribeToSessionAgentIntervention(chatbotId, currentSessionId, (data) => {
      if (data.agent) {
        console.log('🔔 Agent intervention detected in embed:', data.agent.name);
        setAgentInterventionDetected(true);
        setCurrentAgentName(data.agent.name);
      } else {
        console.log('🤖 Agent handed conversation back to bot');
        setAgentInterventionDetected(false);
        setCurrentAgentName(null);
      }
    });

    return () => {
      console.log('🔄 Cleaning up agent intervention subscription');
      realtimeService.unsubscribeAll();
    };
  }, [chatbotId, currentSessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">⚠</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Chatbot Unavailable</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!chatbot || !securityValidated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 max-w-md mx-auto">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-slate-400 text-2xl">🤖</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Chatbot Unavailable</h2>
          <p className="text-slate-600">This chatbot is not available or access is restricted.</p>
        </div>
      </div>
    );
  }

  // Render embedded chatbot - ALWAYS show the widget
  if (isEmbedded) {
    return (
      <div className="w-full h-full min-h-screen">
        <ChatbotPreview 
          visible={true} 
          onClose={() => {}} 
          chatbot={{
            ...chatbot,
            agentInterventionDetected,
            currentAgentName,
            currentSessionId
          }}
          embedded={true}
        />
      </div>
    );
  }

  // Render full-page chatbot
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">{chatbot.name}</h1>
            {chatbot.description && (
              <p className="text-slate-600">{chatbot.description}</p>
            )}
          </div>
          
          <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ height: '600px' }}>
            <ChatbotPreview 
              visible={true} 
              onClose={() => {}} 
              chatbot={{
                ...chatbot,
                agentInterventionDetected,
                currentAgentName,
                currentSessionId
              }}
              embedded={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotEmbed;