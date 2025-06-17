import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Smile, 
  Paperclip, 
  MoreVertical, 
  Phone, 
  Video, 
  Info,
  Heart,
  ThumbsUp,
  Laugh,
  Angry,
  Sad,
  User,
  Bot,
  CheckCheck,
  Check,
  Circle,
  Image as ImageIcon,
  File,
  X,
  ArrowLeft,
  Settings,
  Search,
  Mic,
  Camera
} from 'lucide-react';
import { socketChatManager } from '../lib/socketChatManager';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'agent';
  created_at: string;
  sender_name?: string;
  avatar?: string;
  message_type?: 'text' | 'image' | 'file';
  read_by?: string[];
  reactions?: { emoji: string; user_id: string; user_name: string }[];
}

interface TypingUser {
  user_id: string;
  user_name: string;
}

interface OnlineUser {
  user_id: string;
  user_name: string;
  is_online: boolean;
  last_seen?: string;
}

interface SocialChatInterfaceProps {
  conversationId: string;
  currentUser: { id: string; name: string; avatar?: string };
  chatPartner: { id: string; name: string; avatar?: string; role: 'agent' | 'bot' };
  onClose?: () => void;
  embedded?: boolean;
}

const SocialChatInterface: React.FC<SocialChatInterfaceProps> = ({
  conversationId,
  currentUser,
  chatPartner,
  onClose,
  embedded = false
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emojis = ['❤️', '👍', '😂', '😮', '😢', '😡', '🔥', '👏', '🎉', '💯'];
  const quickReactions = ['👍', '❤️', '😂', '😮'];

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket connection and subscription
  useEffect(() => {
    const unsubscribe = socketChatManager.subscribe({
      conversationId,
      userId: currentUser.id,
      userName: currentUser.name,
      onMessage: (message) => {
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });
        
        // Mark message as read if it's not from current user
        if (message.role !== 'user' || message.sender_name !== currentUser.name) {
          setTimeout(() => {
            socketChatManager.markMessageAsRead(conversationId, message.id);
          }, 1000);
        }
      },
      onTyping: (typing) => {
        if (typing.user_id === currentUser.id) return;
        
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.user_id !== typing.user_id);
          if (typing.is_typing) {
            return [...filtered, { user_id: typing.user_id, user_name: typing.user_name }];
          }
          return filtered;
        });
      },
      onOnlineStatus: (status) => {
        setOnlineUsers(prev => {
          const filtered = prev.filter(u => u.user_id !== status.user_id);
          return [...filtered, {
            user_id: status.user_id,
            user_name: status.user_name,
            is_online: status.is_online,
            last_seen: status.last_seen
          }];
        });
      },
      onMessageRead: (data) => {
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.message_id) {
            const readBy = msg.read_by || [];
            if (!readBy.includes(data.user_id)) {
              return { ...msg, read_by: [...readBy, data.user_id] };
            }
          }
          return msg;
        }));
      },
      onReaction: (data) => {
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.message_id) {
            const reactions = msg.reactions || [];
            const existingReaction = reactions.find(r => r.user_id === data.user_id);
            
            if (existingReaction) {
              // Update existing reaction
              return {
                ...msg,
                reactions: reactions.map(r => 
                  r.user_id === data.user_id 
                    ? { ...r, emoji: data.emoji }
                    : r
                )
              };
            } else {
              // Add new reaction
              return {
                ...msg,
                reactions: [...reactions, {
                  emoji: data.emoji,
                  user_id: data.user_id,
                  user_name: data.user_name
                }]
              };
            }
          }
          return msg;
        }));
      }
    });

    // Update connection status
    const checkConnection = () => {
      setIsConnected(socketChatManager.isConnected());
    };
    
    checkConnection();
    const connectionInterval = setInterval(checkConnection, 1000);

    // Update online status
    socketChatManager.updateOnlineStatus(conversationId, true);

    return () => {
      socketChatManager.updateOnlineStatus(conversationId, false);
      unsubscribe();
      clearInterval(connectionInterval);
    };
  }, [conversationId, currentUser.id, currentUser.name]);

  // Handle typing indicator
  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      socketChatManager.sendTypingIndicator(conversationId, true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketChatManager.sendTypingIndicator(conversationId, false);
    }, 1000);
  };

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !isConnected) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    
    // Stop typing
    if (isTyping) {
      setIsTyping(false);
      socketChatManager.sendTypingIndicator(conversationId, false);
    }

    try {
      await socketChatManager.sendMessage(
        conversationId,
        messageContent,
        'user',
        undefined,
        'text'
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      // Re-add message to input on failure
      setNewMessage(messageContent);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!file || !isConnected) return;

    const fileType = file.type.startsWith('image/') ? 'image' : 'file';
    const fileName = file.name;
    
    try {
      // For demo purposes, we'll send the file name as the message content
      // In a real implementation, you'd upload the file to a storage service first
      await socketChatManager.sendMessage(
        conversationId,
        `📎 ${fileName}`,
        'user',
        undefined,
        fileType
      );
      
      setSelectedFile(null);
      setShowAttachments(false);
    } catch (error) {
      console.error('Failed to send file:', error);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      handleFileUpload(file);
    }
  };

  // Add reaction to message
  const handleAddReaction = (messageId: string, emoji: string) => {
    socketChatManager.addReaction(conversationId, messageId, emoji);
    setShowEmojiPicker(null);
  };

  // Format time
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return date.toLocaleDateString();
  };

  // Get message status icon
  const getMessageStatus = (message: Message) => {
    if (message.role !== 'user') return null;
    
    const readBy = message.read_by || [];
    const isRead = readBy.some(userId => userId !== currentUser.id);
    
    if (isRead) {
      return <CheckCheck className="w-3 h-3 text-blue-500" />;
    }
    return <Check className="w-3 h-3 text-slate-400" />;
  };

  // Check if user is online
  const isUserOnline = (userId: string) => {
    return onlineUsers.some(user => user.user_id === userId && user.is_online);
  };

  return (
    <div className={`flex flex-col h-full bg-white ${embedded ? '' : 'rounded-lg shadow-xl border border-slate-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center space-x-3">
          {!embedded && onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-200 rounded-full transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </button>
          )}
          
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium overflow-hidden">
              {chatPartner.avatar ? (
                <img src={chatPartner.avatar} alt={chatPartner.name} className="w-full h-full object-cover" />
              ) : chatPartner.role === 'agent' ? (
                <User className="w-5 h-5" />
              ) : (
                <Bot className="w-5 h-5" />
              )}
            </div>
            {isUserOnline(chatPartner.id) && (
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            )}
          </div>
          
          <div>
            <h3 className="font-semibold text-slate-800">{chatPartner.name}</h3>
            <div className="flex items-center space-x-1">
              {isUserOnline(chatPartner.id) ? (
                <>
                  <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                  <span className="text-xs text-green-600">Online</span>
                </>
              ) : (
                <span className="text-xs text-slate-500">
                  {chatPartner.role === 'agent' ? 'Agent' : 'AI Assistant'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button className="p-2 hover:bg-white/50 rounded-full transition-colors">
            <Phone className="w-4 h-4 text-slate-600" />
          </button>
          <button className="p-2 hover:bg-white/50 rounded-full transition-colors">
            <Video className="w-4 h-4 text-slate-600" />
          </button>
          <button className="p-2 hover:bg-white/50 rounded-full transition-colors">
            <Info className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <div className="flex items-center space-x-2">
            <Circle className="w-2 h-2 fill-yellow-500 text-yellow-500 animate-pulse" />
            <span className="text-xs text-yellow-700">Connecting...</span>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-50/30 to-white">
        {messages.map((message) => {
          const isOwnMessage = message.role === 'user' && message.sender_name === currentUser.name;
          const isAgent = message.role === 'agent';
          const isBot = message.role === 'assistant';
          
          return (
            <div
              key={message.id}
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group`}
            >
              <div className={`flex items-end space-x-2 max-w-[80%] ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                {/* Avatar */}
                {!isOwnMessage && (
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mb-1">
                    {isAgent ? (
                      <div className="w-full h-full bg-green-500 flex items-center justify-center text-white">
                        <User className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                )}

                {/* Message Bubble */}
                <div className="flex flex-col">
                  <div
                    className={`relative px-4 py-2 rounded-2xl max-w-sm break-words ${
                      isOwnMessage
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-md'
                        : isAgent
                        ? 'bg-green-100 text-green-800 border border-green-200 rounded-bl-md'
                        : 'bg-slate-100 text-slate-800 rounded-bl-md'
                    }`}
                  >
                    {/* Message Content */}
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>

                    {/* Message Time & Status */}
                    <div className={`flex items-center justify-between mt-1 space-x-2`}>
                      <span className={`text-xs ${
                        isOwnMessage ? 'text-white/70' : 'text-slate-500'
                      }`}>
                        {formatTime(message.created_at)}
                      </span>
                      {isOwnMessage && getMessageStatus(message)}
                    </div>

                    {/* Quick Reactions */}
                    <div className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center space-x-1 bg-white rounded-full shadow-lg border border-slate-200 px-2 py-1">
                        {quickReactions.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleAddReaction(message.id, emoji)}
                            className="hover:scale-110 transition-transform"
                          >
                            <span className="text-sm">{emoji}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                          className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                        >
                          <Smile className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Reactions */}
                  {message.reactions && message.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {message.reactions.map((reaction, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-1 bg-white rounded-full px-2 py-1 border border-slate-200 shadow-sm"
                          title={`${reaction.user_name} reacted with ${reaction.emoji}`}
                        >
                          <span className="text-xs">{reaction.emoji}</span>
                          <span className="text-xs text-slate-600">1</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Emoji Picker */}
                  {showEmojiPicker === message.id && (
                    <div className="absolute z-10 mt-2 bg-white rounded-lg shadow-lg border border-slate-200 p-2">
                      <div className="grid grid-cols-5 gap-1">
                        {emojis.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleAddReaction(message.id, emoji)}
                            className="p-2 hover:bg-slate-100 rounded transition-colors"
                          >
                            <span className="text-lg">{emoji}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex justify-start">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
              <div className="bg-slate-100 px-3 py-2 rounded-2xl rounded-bl-md">
                <span className="text-sm text-slate-600">
                  {typingUsers[0].user_name} is typing...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200 p-4 bg-white">
        {/* Attachment Preview */}
        {selectedFile && (
          <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {selectedFile.type.startsWith('image/') ? (
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                ) : (
                  <File className="w-4 h-4 text-slate-500" />
                )}
                <span className="text-sm text-slate-700">{selectedFile.name}</span>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-1 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          </div>
        )}

        {/* Input Row */}
        <div className="flex items-end space-x-3">
          {/* Attachment Button */}
          <div className="relative">
            <button
              onClick={() => setShowAttachments(!showAttachments)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Attachment Menu */}
            {showAttachments && (
              <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-slate-200 p-2">
                <div className="flex flex-col space-y-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-2 px-3 py-2 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <File className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700">File</span>
                  </button>
                  <button
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'image/*';
                        fileInputRef.current.click();
                      }
                    }}
                    className="flex items-center space-x-2 px-3 py-2 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <ImageIcon className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-slate-700">Image</span>
                  </button>
                  <button className="flex items-center space-x-2 px-3 py-2 hover:bg-slate-100 rounded-md transition-colors">
                    <Camera className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-slate-700">Camera</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Type a message..." : "Connecting..."}
              className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none max-h-32 bg-slate-50"
              rows={1}
              disabled={!isConnected}
              style={{
                minHeight: '48px',
                height: 'auto',
              }}
            />
            
            {/* Emoji Button */}
            <button
              onClick={() => setShowEmojiPicker(showEmojiPicker === 'input' ? null : 'input')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>

          {/* Voice/Send Button */}
          <div className="flex items-center space-x-2">
            {newMessage.trim() ? (
              <button
                onClick={handleSendMessage}
                disabled={!isConnected}
                className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                <Send className="w-5 h-5" />
              </button>
            ) : (
              <button className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Input Emoji Picker */}
        {showEmojiPicker === 'input' && (
          <div className="absolute bottom-full right-4 mb-2 bg-white rounded-lg shadow-lg border border-slate-200 p-3 z-10">
            <div className="grid grid-cols-8 gap-2">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setNewMessage(prev => prev + emoji);
                    setShowEmojiPicker(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded transition-colors"
                >
                  <span className="text-lg">{emoji}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept="*/*"
        />
      </div>
    </div>
  );
};

export default SocialChatInterface;