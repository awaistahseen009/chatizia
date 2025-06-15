import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Agent } from '../hooks/useAgents';

interface AgentContextType {
  currentAgent: Agent | null;
  setCurrentAgent: (agent: Agent | null) => void;
  isAgentAuthenticated: boolean;
  agentSignOut: () => void;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export const AgentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  const isAgentAuthenticated = !!currentAgent;

  const agentSignOut = () => {
    setCurrentAgent(null);
    // Clear all agent-related storage across all domains
    localStorage.removeItem('agent_session');
    sessionStorage.removeItem('agent_session');
    
    // Clear cookies for current domain and parent domain
    const hostname = window.location.hostname;
    document.cookie = 'agent_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + hostname;
    
    // Also clear for parent domain if subdomain
    if (hostname.includes('.')) {
      const parentDomain = hostname.split('.').slice(-2).join('.');
      document.cookie = 'agent_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.' + parentDomain;
    }
    
    // Clear without domain specification as well
    document.cookie = 'agent_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  };

  // Store agent session when currentAgent changes
  useEffect(() => {
    if (currentAgent && sessionChecked) {
      const sessionData = JSON.stringify({
        agentId: currentAgent.id,
        email: currentAgent.email,
        name: currentAgent.name,
        timestamp: Date.now()
      });
      
      // Store in multiple places for cross-browser/tab persistence
      localStorage.setItem('agent_session', sessionData);
      sessionStorage.setItem('agent_session', sessionData);
      
      // Store in cookies (cross-tab and cross-domain)
      const expiryDate = new Date();
      expiryDate.setTime(expiryDate.getTime() + (24 * 60 * 60 * 1000)); // 24 hours
      
      // Set cookie for current domain
      document.cookie = `agent_session=${encodeURIComponent(sessionData)}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;
      
      // Also set for parent domain if on subdomain
      const hostname = window.location.hostname;
      if (hostname.includes('.') && hostname !== 'localhost') {
        const parentDomain = hostname.split('.').slice(-2).join('.');
        document.cookie = `agent_session=${encodeURIComponent(sessionData)}; expires=${expiryDate.toUTCString()}; path=/; domain=.${parentDomain}; SameSite=Lax`;
      }
    }
  }, [currentAgent, sessionChecked]);

  // Check for existing session on mount - ONLY ONCE
  useEffect(() => {
    if (sessionChecked) return;

    const checkExistingSession = () => {
      try {
        // Check localStorage first
        let sessionData = localStorage.getItem('agent_session');
        
        // If not in localStorage, check sessionStorage
        if (!sessionData) {
          sessionData = sessionStorage.getItem('agent_session');
        }
        
        // If not in storage, check cookies
        if (!sessionData) {
          const cookies = document.cookie.split(';');
          const agentCookie = cookies.find(cookie => cookie.trim().startsWith('agent_session='));
          if (agentCookie) {
            sessionData = decodeURIComponent(agentCookie.split('=')[1]);
          }
        }
        
        if (sessionData) {
          const { agentId, email, name, timestamp } = JSON.parse(sessionData);
          
          // Check if session is less than 24 hours old
          const isSessionValid = Date.now() - timestamp < 24 * 60 * 60 * 1000;
          
          if (isSessionValid && agentId && email && name) {
            console.log('🔄 Restoring agent session for:', name);
            setCurrentAgent({
              id: agentId,
              email: email,
              name: name,
              user_id: '',
              agent_id: '',
              password: '',
              created_at: '',
              updated_at: ''
            });
          } else {
            // Clear expired session
            localStorage.removeItem('agent_session');
            sessionStorage.removeItem('agent_session');
            const hostname = window.location.hostname;
            document.cookie = 'agent_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + hostname;
            if (hostname.includes('.')) {
              const parentDomain = hostname.split('.').slice(-2).join('.');
              document.cookie = 'agent_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.' + parentDomain;
            }
            document.cookie = 'agent_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          }
        }
      } catch (error) {
        console.error('Error parsing agent session:', error);
        localStorage.removeItem('agent_session');
        sessionStorage.removeItem('agent_session');
        const hostname = window.location.hostname;
        document.cookie = 'agent_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + hostname;
        if (hostname.includes('.')) {
          const parentDomain = hostname.split('.').slice(-2).join('.');
          document.cookie = 'agent_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.' + parentDomain;
        }
        document.cookie = 'agent_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      } finally {
        setSessionChecked(true);
      }
    };

    checkExistingSession();
  }, [sessionChecked]);

  return (
    <AgentContext.Provider
      value={{
        currentAgent,
        setCurrentAgent,
        isAgentAuthenticated,
        agentSignOut,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
};

export const useAgent = () => {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
};