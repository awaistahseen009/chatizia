import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAgent } from '../contexts/AgentContext';

interface ProtectedAgentRouteProps {
  children: React.ReactNode;
}

const ProtectedAgentRoute: React.FC<ProtectedAgentRouteProps> = ({ children }) => {
  const { isAgentAuthenticated } = useAgent();
  const location = useLocation();

  if (!isAgentAuthenticated) {
    return <Navigate to="/agent-login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedAgentRoute;