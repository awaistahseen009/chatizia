import React, { useState } from 'react';
import { 
  Plus, 
  Globe, 
  Copy, 
  Check, 
  Trash2, 
  RefreshCw, 
  AlertCircle,
  Shield,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import { useChatbotDomains } from '../hooks/useChatbotDomains';

interface DomainManagementProps {
  chatbotId: string;
  chatbotName: string;
}

const DomainManagement: React.FC<DomainManagementProps> = ({ chatbotId, chatbotName }) => {
  const { domains, loading, addDomain, deleteDomain, updateDomain, regenerateToken } = useChatbotDomains(chatbotId);
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    setAddingDomain(true);
    setError(null);

    try {
      await addDomain(newDomain.trim());
      setNewDomain('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add domain');
    } finally {
      setAddingDomain(false);
    }
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleCopyEmbedCode = (domain: string, token: string) => {
    const embedCode = `<script>
  (function(d, s, id) {
    var js, cjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "${window.location.origin}/embed/chatbot.js";
    js.setAttribute('data-chatbot-id', '${chatbotId}');
    js.setAttribute('data-token', '${token}');
    js.setAttribute('data-domain', '${domain}');
    cjs.parentNode.insertBefore(js, cjs);
  }(document, 'script', 'chatbot-embed'));
</script>`;

    navigator.clipboard.writeText(embedCode);
    setCopiedToken(`embed-${domain}`);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const toggleTokenVisibility = (domainId: string) => {
    setShowTokens(prev => ({
      ...prev,
      [domainId]: !prev[domainId]
    }));
  };

  const handleToggleActive = async (domainId: string, isActive: boolean) => {
    try {
      await updateDomain(domainId, { is_active: !isActive });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update domain status');
    }
  };

  const handleRegenerateToken = async (domainId: string) => {
    if (!confirm('Are you sure you want to regenerate this token? The old token will stop working immediately.')) {
      return;
    }

    try {
      await regenerateToken(domainId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate token');
    }
  };

  const handleDeleteDomain = async (domainId: string, domain: string) => {
    if (!confirm(`Are you sure you want to delete the domain "${domain}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDomain(domainId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete domain');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Shield className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Domain Security</h3>
          <p className="text-sm text-slate-600">Manage allowed domains for {chatbotName}</p>
        </div>
      </div>

      {/* Add Domain Form */}
      <div className="bg-slate-50 rounded-lg p-4">
        <form onSubmit={handleAddDomain} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Add New Domain
            </label>
            <div className="flex space-x-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  disabled={addingDomain}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Enter domain without protocol (e.g., example.com, not https://example.com)
                </p>
              </div>
              <button
                type="submit"
                disabled={addingDomain || !newDomain.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>{addingDomain ? 'Adding...' : 'Add'}</span>
              </button>
            </div>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Domains List */}
      {domains.length > 0 ? (
        <div className="space-y-4">
          {domains.map((domain) => (
            <div key={domain.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Globe className="w-5 h-5 text-slate-400" />
                  <div>
                    <h4 className="font-medium text-slate-800">{domain.domain}</h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        domain.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {domain.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs text-slate-500">
                        Added {new Date(domain.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleToggleActive(domain.id, domain.is_active)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      domain.is_active
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {domain.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDeleteDomain(domain.id, domain.domain)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete domain"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Token Section */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">Security Token</label>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleTokenVisibility(domain.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        title={showTokens[domain.id] ? 'Hide token' : 'Show token'}
                      >
                        {showTokens[domain.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleCopyToken(domain.token)}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Copy token"
                      >
                        {copiedToken === domain.token ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRegenerateToken(domain.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Regenerate token"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-md p-3 font-mono text-sm">
                    {showTokens[domain.id] ? domain.token : '•'.repeat(32)}
                  </div>
                </div>

                {/* Embed Code */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">Embed Code</label>
                    <button
                      onClick={() => handleCopyEmbedCode(domain.domain, domain.token)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                    >
                      {copiedToken === `embed-${domain.domain}` ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-slate-900 rounded-md p-3 text-green-400 text-xs font-mono overflow-x-auto">
                    <pre>{`<script>
  (function(d, s, id) {
    var js, cjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "${window.location.origin}/embed/chatbot.js";
    js.setAttribute('data-chatbot-id', '${chatbotId}');
    js.setAttribute('data-token', '${domain.token}');
    js.setAttribute('data-domain', '${domain.domain}');
    cjs.parentNode.insertBefore(js, cjs);
  }(document, 'script', 'chatbot-embed'));
</script>`}</pre>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border border-slate-200 rounded-lg">
          <Globe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-800 mb-2">No domains configured</h3>
          <p className="text-slate-500 mb-4">
            Add domains where your chatbot is allowed to run for enhanced security.
          </p>
        </div>
      )}

      {/* Security Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Security Features</h4>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• Domain whitelisting prevents unauthorized usage</li>
              <li>• Unique tokens authenticate each domain</li>
              <li>• Tokens can be regenerated if compromised</li>
              <li>• Domains can be temporarily disabled without deletion</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DomainManagement;