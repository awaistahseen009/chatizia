import React, { useState } from 'react';
import { X, Copy, Check, Globe, Shield } from 'lucide-react';
import DomainManagement from './DomainManagement';

interface EmbedCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatbot: any;
}

const EmbedCodeModal: React.FC<EmbedCodeModalProps> = ({ isOpen, onClose, chatbot }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('domains');

  if (!isOpen || !chatbot) return null;

  const basicEmbedCode = `<script>
  (function(d, s, id) {
    var js, cjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "${window.location.origin}/embed/chatbot.js";
    js.setAttribute('data-chatbot-id', '${chatbot.id}');
    cjs.parentNode.insertBefore(js, cjs);
  }(document, 'script', 'chatbot-embed'));
</script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(basicEmbedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: 'domains', label: 'Domain Security', icon: Shield },
    { id: 'embed', label: 'Basic Embed', icon: Globe }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Embed & Security</h2>
              <p className="text-slate-600 mt-1">Configure domain security and get embed code for {chatbot.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="flex items-center mt-6 border-b border-slate-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'domains' && (
            <DomainManagement 
              chatbotId={chatbot.id} 
              chatbotName={chatbot.name}
            />
          )}

          {activeTab === 'embed' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Basic Embed Code</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-5 h-5 bg-yellow-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">!</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-yellow-800">Security Notice</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        This basic embed code allows the chatbot to run on any domain. For enhanced security, 
                        use the Domain Security tab to configure domain whitelisting and token authentication.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-600">Copy and paste this code before the closing &lt;/body&gt; tag</p>
                  <button
                    onClick={handleCopy}
                    className="flex items-center space-x-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-600" />
                        <span className="text-sm text-slate-600">Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-green-400 text-sm">
                    <code>{basicEmbedCode}</code>
                  </pre>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800">Installation Instructions</h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                      1
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">Copy the embed code above</p>
                      <p className="text-sm text-slate-600">This code will add the chatbot widget to your website</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                      2
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">Paste it before the closing &lt;/body&gt; tag</p>
                      <p className="text-sm text-slate-600">Add the code to every page where you want the chatbot to appear</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                      3
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">Configure domain security (recommended)</p>
                      <p className="text-sm text-slate-600">Use the Domain Security tab to restrict usage to your domains</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">!</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-800">Important Notes</h4>
                    <ul className="text-sm text-blue-700 mt-2 space-y-1">
                      <li>• The chatbot will automatically adapt to your website's design</li>
                      <li>• It works on all modern browsers and mobile devices</li>
                      <li>• The widget loads asynchronously and won't slow down your site</li>
                      <li>• Widget appearance can be configured in the Settings page</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmbedCodeModal;