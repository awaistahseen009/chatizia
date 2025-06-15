import { supabase } from './supabase';

export interface DomainValidationResult {
  isValid: boolean;
  chatbotId?: string;
  domain?: string;
  error?: string;
}

export class ChatbotSecurity {
  /**
   * Validates domain and token for chatbot access
   */
  static async validateDomainAndToken(
    domain: string, 
    token: string, 
    chatbotId: string
  ): Promise<DomainValidationResult> {
    try {
      // Clean the domain (remove protocol, www, trailing slash)
      const cleanDomain = domain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
        .toLowerCase();

      console.log('🔒 Validating domain access:', { cleanDomain, chatbotId, token: token.substring(0, 8) + '...' });

      // Query the chatbot_domains table directly
      const { data, error } = await supabase
        .from('chatbot_domains')
        .select('*')
        .eq('chatbot_id', chatbotId)
        .eq('domain', cleanDomain)
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (error) {
        console.log('❌ Domain validation failed:', error.message);
        return {
          isValid: false,
          error: 'Domain not authorized for this chatbot'
        };
      }

      if (!data) {
        console.log('❌ No matching domain/token combination found');
        return {
          isValid: false,
          error: 'Invalid domain or token'
        };
      }

      console.log('✅ Domain validation successful');
      return {
        isValid: true,
        chatbotId: data.chatbot_id,
        domain: data.domain
      };
    } catch (err) {
      console.error('❌ Domain validation error:', err);
      return {
        isValid: false,
        error: 'Validation service unavailable'
      };
    }
  }

  /**
   * Gets the referrer domain from the current request
   */
  static getReferrerDomain(): string | null {
    try {
      if (typeof window === 'undefined') return null;
      
      const referrer = document.referrer || window.location.href;
      if (!referrer) return null;

      const url = new URL(referrer);
      return url.hostname;
    } catch (err) {
      console.error('Error getting referrer domain:', err);
      return null;
    }
  }

  /**
   * Initializes chatbot with domain security validation
   */
  static async initializeChatbot(params: {
    chatbotId: string;
    token?: string;
    domain?: string;
    onSuccess: () => void;
    onError: (error: string) => void;
  }) {
    const { chatbotId, token, domain, onSuccess, onError } = params;

    try {
      // If no token provided, allow basic access (less secure)
      if (!token) {
        console.log('⚠️ No token provided, allowing basic access');
        onSuccess();
        return;
      }

      // Get domain from parameter or referrer
      const targetDomain = domain || this.getReferrerDomain();
      
      if (!targetDomain) {
        onError('Unable to determine domain for security validation');
        return;
      }

      // Validate domain and token
      const validation = await this.validateDomainAndToken(targetDomain, token, chatbotId);
      
      if (validation.isValid) {
        console.log('✅ Chatbot security validation passed');
        onSuccess();
      } else {
        console.log('❌ Chatbot security validation failed:', validation.error);
        onError(validation.error || 'Access denied');
      }
    } catch (err) {
      console.error('❌ Chatbot initialization error:', err);
      onError('Failed to initialize chatbot');
    }
  }
}

// Export for use in embed script
(window as any).ChatbotSecurity = ChatbotSecurity;