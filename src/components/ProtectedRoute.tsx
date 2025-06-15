import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Don't show loading for protected routes
  if (loading) {
    return null;
  }

  if (!user) {
    // Redirect to signin with the current location
    return <Navigate to="/signin\" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;