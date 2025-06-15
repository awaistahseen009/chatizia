import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ChatbotPreview from './ChatbotPreview';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const location = useLocation();

  const showPreview = location.pathname === '/chatbots' || location.pathname === '/settings';

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <Header />
        
        <main className="p-6">
          <div className={`transition-all duration-300 ${showPreview && previewVisible ? 'mr-80' : 'mr-0'}`}>
            {children}
          </div>
        </main>
      </div>

      {showPreview && (
        <ChatbotPreview 
          visible={previewVisible} 
          onClose={() => setPreviewVisible(false)} 
        />
      )}
    </div>
  );
};

export default Layout;