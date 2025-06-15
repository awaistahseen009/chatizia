import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatbotProvider } from './contexts/ChatbotContext';
import { AgentProvider } from './contexts/AgentContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedAgentRoute from './components/ProtectedAgentRoute';

// Auth Components
import SignUpForm from './components/auth/SignUpForm';
import SignInForm from './components/auth/SignInForm';
import ForgotPasswordForm from './components/auth/ForgotPasswordForm';

// Dashboard Pages
import Dashboard from './pages/Dashboard';
import Chatbots from './pages/Chatbots';
import Documents from './pages/Documents';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import Agents from './pages/Agents';
import ChatbotEmbed from './pages/ChatbotEmbed';

// Agent Pages
import AgentLogin from './pages/AgentLogin';
import AgentDashboard from './pages/AgentDashboard';

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  // Don't show loading spinner at app start
  if (loading && user === undefined) {
    return null;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/signup" 
        element={user ? <Navigate to="/dashboard" replace /> : <SignUpForm />} 
      />
      <Route 
        path="/signin" 
        element={user ? <Navigate to="/dashboard" replace /> : <SignInForm />} 
      />
      <Route 
        path="/forgot-password" 
        element={user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordForm />} 
      />

      {/* Agent Routes */}
      <Route path="/agent-login" element={<AgentLogin />} />
      <Route 
        path="/agent-dashboard" 
        element={
          <ProtectedAgentRoute>
            <AgentDashboard />
          </ProtectedAgentRoute>
        } 
      />

      {/* Public Chatbot Embed Route - Wrapped in ChatbotProvider */}
      <Route 
        path="/chatbot/:chatbotId" 
        element={
          <ChatbotProvider>
            <ChatbotEmbed />
          </ChatbotProvider>
        } 
      />

      {/* Protected Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <ChatbotProvider>
            <Layout>
              <Dashboard />
            </Layout>
          </ChatbotProvider>
        </ProtectedRoute>
      } />
      
      <Route path="/chatbots" element={
        <ProtectedRoute>
          <ChatbotProvider>
            <Layout>
              <Chatbots />
            </Layout>
          </ChatbotProvider>
        </ProtectedRoute>
      } />
      
      <Route path="/documents" element={
        <ProtectedRoute>
          <ChatbotProvider>
            <Layout>
              <Documents />
            </Layout>
          </ChatbotProvider>
        </ProtectedRoute>
      } />
      
      <Route path="/analytics" element={
        <ProtectedRoute>
          <ChatbotProvider>
            <Layout>
              <Analytics />
            </Layout>
          </ChatbotProvider>
        </ProtectedRoute>
      } />
      
      <Route path="/settings" element={
        <ProtectedRoute>
          <ChatbotProvider>
            <Layout>
              <Settings />
            </Layout>
          </ChatbotProvider>
        </ProtectedRoute>
      } />
      
      <Route path="/billing" element={
        <ProtectedRoute>
          <ChatbotProvider>
            <Layout>
              <Billing />
            </Layout>
          </ChatbotProvider>
        </ProtectedRoute>
      } />

      <Route path="/agents" element={
        <ProtectedRoute>
          <ChatbotProvider>
            <Layout>
              <Agents />
            </Layout>
          </ChatbotProvider>
        </ProtectedRoute>
      } />

      {/* Default redirects */}
      <Route path="/" element={
        user ? <Navigate to="/dashboard" replace /> : <Navigate to="/signin" replace />
      } />
      
      {/* Catch all route */}
      <Route path="*" element={
        user ? <Navigate to="/dashboard" replace /> : <Navigate to="/signin" replace />
      } />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <AgentProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AgentProvider>
    </AuthProvider>
  );
}

export default App;