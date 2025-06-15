import { openai } from './openai';

export interface SentimentResult {
  sentiment: 'happy' | 'neutral' | 'unhappy';
  confidence: number;
  shouldEscalate: boolean;
}

export const analyzeSentiment = async (messages: string[]): Promise<SentimentResult> => {
  try {
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured for sentiment analysis');
      return {
        sentiment: 'neutral',
        confidence: 0,
        shouldEscalate: false
      };
    }

    if (messages.length === 0) {
      return {
        sentiment: 'neutral',
        confidence: 0,
        shouldEscalate: false
      };
    }

    const conversationText = messages.join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a sentiment analysis expert. Analyze the sentiment of the following conversation messages and determine if the user seems unhappy or frustrated.

Respond with ONLY a JSON object in this exact format:
{
  "sentiment": "happy" | "neutral" | "unhappy",
  "confidence": 0.0-1.0,
  "shouldEscalate": boolean
}

Guidelines:
- "happy": User is satisfied, positive, or expressing gratitude
- "neutral": Normal conversation, no strong emotions
- "unhappy": User is frustrated, angry, confused, or expressing dissatisfaction
- shouldEscalate should be true if sentiment is "unhappy" and confidence > 0.7
- Consider the overall tone and context of the conversation`
        },
        {
          role: 'user',
          content: conversationText
        }
      ],
      max_tokens: 100,
      temperature: 0.1,
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      throw new Error('No response from OpenAI');
    }

    try {
      const parsed = JSON.parse(result) as SentimentResult;
      
      // Validate the response structure
      if (!['happy', 'neutral', 'unhappy'].includes(parsed.sentiment)) {
        throw new Error('Invalid sentiment value');
      }

      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        throw new Error('Invalid confidence value');
      }

      if (typeof parsed.shouldEscalate !== 'boolean') {
        throw new Error('Invalid shouldEscalate value');
      }

      return parsed;
    } catch (parseError) {
      console.error('Failed to parse sentiment analysis result:', parseError);
      return {
        sentiment: 'neutral',
        confidence: 0,
        shouldEscalate: false
      };
    }
  } catch (error) {
    console.error('Sentiment analysis failed:', error);
    return {
      sentiment: 'neutral',
      confidence: 0,
      shouldEscalate: false
    };
  }
};

export const shouldEscalateConversation = (sentimentHistory: SentimentResult[]): boolean => {
  if (sentimentHistory.length === 0) return false;

  // Check if the last sentiment analysis suggests escalation
  const lastSentiment = sentimentHistory[sentimentHistory.length - 1];
  return lastSentiment.shouldEscalate;
};