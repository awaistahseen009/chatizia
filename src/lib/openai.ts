import { OpenAI } from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  message: string;
  sources?: string[];
  error?: string;
}

export const generateChatResponse = async (
  messages: ChatMessage[],
  context?: string
): Promise<ChatResponse> => {
  try {
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // Prepare messages with context if available
    const systemMessage: ChatMessage = {
      role: 'system',
      content: context 
        ? `You are a helpful AI assistant. Use the following context to answer questions accurately and helpfully. If the context doesn't contain relevant information, you can use your general knowledge but mention that the information isn't from the provided documents.

Context:
${context}

Instructions:
- Answer based on the context when possible
- Be helpful and conversational
- If you don't know something, say so
- Keep responses concise but informative`
        : 'You are a helpful AI assistant. Answer questions accurately and helpfully.'
    };

    const chatMessages = [systemMessage, ...messages];

    console.log('🤖 Generating chat response with OpenAI...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: chatMessages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const message = response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
    
    console.log('✅ Chat response generated successfully');
    
    return {
      message,
      sources: context ? ['Knowledge Base'] : undefined
    };
  } catch (error) {
    console.error('❌ Error generating chat response:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return {
          message: 'I apologize, but the AI service is not properly configured. Please contact support.',
          error: 'API key not configured'
        };
      } else if (error.message.includes('quota') || error.message.includes('billing')) {
        return {
          message: 'I apologize, but the AI service is temporarily unavailable due to quota limits. Please try again later.',
          error: 'Quota exceeded'
        };
      }
    }
    
    return {
      message: 'I apologize, but I encountered an error while processing your request. Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export { openai };