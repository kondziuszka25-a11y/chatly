import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import { 
  Send, Image, Smile, Info, Pin, Edit3, Trash2, X, Maximize2, MoreVertical, MessageSquare
} from 'lucide-react';

const ChatArea = ({ 
  conversationId, 
  onToggleInfo, 
  isInfoOpen, 
  conversations, 
  setConversations 
}) => {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');
  const [showEmojiPickerId, setShowEmojiPickerId] = useState(null);

  const [activeChat, setActiveChat] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [previewImage, setPreviewImage] = useState(null); // Full screen preview

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  // Find the active conversation details
  useEffect(() => {
    const chat = conversations.find(c => c.id === conversationId);
    setActiveChat(chat || null);
    setMessages([]);
    setTypingUsers(new Set());
  }, [conversationId, conversations]);

  // Fetch Message History
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await api.get(`/messages/${conversationId}`);
        setMessages(response.data);
        scrollToBottom();
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    };

    if (conversationId) {
      fetchMessages();
      // Join conversation room in socket
      if (socket) {
        socket.emit('join_conversation', conversationId);
      }
    }

    return () => {
      if (socket && conversationId) {
        socket.emit('leave_conversation', conversationId);
      }
    };
  }, [conversationId, socket]);

  // Handle Socket Events for Real-Time Messages & Status updates
  useEffect(() => {
    if (!socket) return;

    // Receive message
    const handleMessageReceived = (newMessage) => {
      if (newMessage.conversationId === conversationId) {
        setMessages(prev => [...prev, newMessage]);
        scrollToBottom();
        // Mark conversation as read on HTTP route
        api.post(`/messages/${conversationId}/read`).catch(err => {});
      }
    };

    // Message edited
    const handleMessageEdited = (editedMessage) => {
      if (editedMessage.conversationId === conversationId) {
        setMessages(prev => prev.map(m => m.id === editedMessage.id ? editedMessage : m));
      }
    };

    // Message deleted
    const handleMessageDeleted = (deletedMessage) => {
      if (deletedMessage.conversationId === conversationId) {
        setMessages(prev => prev.map(m => m.id === deletedMessage.id ? deletedMessage : m));
      }
    };

    // Typing status change
    const handleTypingStatus = ({ conversationId: msgConvId, userId: typingId, username, isTyping }) => {
      if (msgConvId === conversationId && typingId !== user.id) {
        setTypingUsers(prev => {
          const next = new Set(prev);
          if (isTyping) {
            next.add(username);
          } else {
            next.delete(username);
          }
          return next;
        });
      }
    };

    // Message reaction added
    const handleReactionAdded = ({ messageId, reaction }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          const exists = m.reactions.some(r => r.id === reaction.id || r.userId === reaction.userId);
          const updatedReactions = exists
            ? m.reactions.map(r => r.userId === reaction.userId ? reaction : r)
            : [...m.reactions, reaction];
          return { ...m, reactions: updatedReactions };
        }
        return m;
      }));
    };

    // Message reaction removed
    const handleReactionRemoved = ({ messageId, userId: reactionUserId }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          return { ...m, reactions: m.reactions.filter(r => r.userId !== reactionUserId) };
        }
        return m;
      }));
    };

    socket.on('message_received', handleMessageReceived);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('typing_status', handleTypingStatus);
    socket.on('reaction_added', handleReactionAdded);
    socket.on('reaction_removed', handleReactionRemoved);

    return () => {
      socket.off('message_received', handleMessageReceived);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('typing_status', handleTypingStatus);
      socket.off('reaction_added', handleReactionAdded);
      socket.off('reaction_removed', handleReactionRemoved);
    };
  }, [conversationId, socket, user]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Handle typing debounce
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (!socket || !conversationId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing', { conversationId, isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing', { conversationId, isTyping: false });
    }, 2000);
  };

  // Handle file select (image only)
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Check size limit: 5MB
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert('Rozmiar pliku nie może przekraczać 5MB!');
      return;
    }

    setFile(selectedFile);
    setFilePreview(URL.createObjectURL(selectedFile));
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFilePreview(null);
  };

  // Submit Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && !file) return;

    const formData = new FormData();
    formData.append('conversationId', conversationId);
    if (inputText) formData.append('content', inputText);
    if (file) formData.append('file', file);

    setInputText('');
    setFile(null);
    setFilePreview(null);

    // Stop typing immediately
    if (socket && conversationId) {
      isTypingRef.current = false;
      socket.emit('typing', { conversationId, isTyping: false });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    try {
      const response = await api.post('/messages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // The response message will be appended via the socket list listener
      // but just in case socket is down, we double-verify
    } catch (err) {
      console.error('Send message failed:', err);
    }
  };

  // Edit Message submit
  const handleEditSubmit = async (messageId) => {
    if (!editText.trim()) return;
    try {
      await api.put(`/messages/${messageId}`, { content: editText });
      setEditingMessageId(null);
      setEditText('');
    } catch (err) {
      console.error('Edit message failed:', err);
    }
  };

  // Delete Message submit
  const handleDeleteSubmit = async (messageId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę wiadomość?')) return;
    try {
      await api.delete(`/messages/${messageId}`);
    } catch (err) {
      console.error('Delete message failed:', err);
    }
  };

  // Reaction Handling
  const handleToggleReaction = async (messageId, emoji) => {
    setShowEmojiPickerId(null);
    
    // Find if user already reacted with the exact emoji
    const msg = messages.find(m => m.id === messageId);
    const existing = msg?.reactions?.find(r => r.userId === user.id);
    
    try {
      if (existing && existing.emoji === emoji) {
        // Delete reaction
        await api.delete(`/messages/${messageId}/reactions`);
      } else {
        // Add reaction
        await api.post(`/messages/${messageId}/reactions`, { emoji });
      }
    } catch (err) {
      console.error('Toggling reaction failed:', err);
    }
  };

  // Toggle conversation Pin
  const handleTogglePin = async () => {
    if (!activeChat) return;
    try {
      const response = await api.post(`/conversations/${conversationId}/pin`);
      
      // Update local conversations state
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, isPinned: response.data.isPinned } : c
      ));
    } catch (err) {
      console.error('Toggling pin failed:', err);
    }
  };

  // Format Status Label for Header
  const formatStatus = () => {
    if (!activeChat) return '';
    if (activeChat.isGroup) {
      return `${activeChat.members.length} członków`;
    }

    const otherMember = activeChat.members.find(m => m.userId !== user.id);
    if (!otherMember) return '';

    // Read real-time maps
    const liveStatus = onlineUsers.get(otherMember.userId);
    const status = liveStatus?.status || otherMember.status;
    const lastActive = liveStatus?.lastActive || otherMember.lastActive;

    if (status === 'ONLINE') {
      return <span className="text-emerald-400 font-medium">online</span>;
    }

    // Format offline message
    const date = new Date(lastActive);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return `aktywny dzisiaj o ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `aktywny ${date.toLocaleDateString()}`;
  };

  if (!activeChat) {
    return (
      <div className="flex-1 h-full flex flex-col justify-center items-center bg-slate-950 text-slate-500">
        <MessageSquare size={64} className="text-slate-800 mb-4 animate-bounce" />
        <p className="text-lg">Wybierz rozmowę, aby rozpocząć czatowanie</p>
      </div>
    );
  }

  // Get active chat display details
  let displayName = activeChat.name;
  let displayAvatar = activeChat.avatarUrl;
  if (!activeChat.isGroup) {
    const otherMember = activeChat.members.find(m => m.userId !== user.id);
    displayName = otherMember?.username || 'Użytkownik';
    displayAvatar = otherMember?.avatarUrl || null;
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-950 relative overflow-hidden">
      
      {/* --- HEADER --- */}
      <div className="p-4 bg-slate-900/60 backdrop-blur-md border-b border-slate-850 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={displayAvatar || (activeChat.isGroup 
              ? `https://api.dicebear.com/7.x/identicon/svg?seed=${displayName}`
              : `https://api.dicebear.com/7.x/initials/svg?seed=${displayName}`
            )}
            alt={displayName}
            className="w-10 h-10 rounded-2xl object-cover bg-slate-850 flex-shrink-0"
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-100 truncate">{displayName}</h3>
            <p className="text-[10px] text-slate-450 truncate">
              {formatStatus()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Pin Toggle */}
          <button
            onClick={handleTogglePin}
            className={`p-2 hover:bg-slate-800 rounded-xl transition-colors ${
              activeChat.isPinned ? 'text-violet-400 rotate-45' : 'text-slate-500'
            }`}
            title={activeChat.isPinned ? 'Odepnij rozmowę' : 'Przypnij rozmowę'}
          >
            <Pin size={18} />
          </button>
          
          {/* Info SidePanel Toggle */}
          <button
            onClick={onToggleInfo}
            className={`p-2 hover:bg-slate-800 rounded-xl transition-colors ${
              isInfoOpen ? 'text-violet-400' : 'text-slate-500'
            }`}
            title="Szczegóły"
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      {/* --- MESSAGES BOX --- */}
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-slate-650">
            <p className="text-sm italic">Początek historii rozmowy</p>
            <p className="text-xs mt-1">Przywitaj się! 👋</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === user.id;
            const hasReactions = msg.reactions && msg.reactions.length > 0;

            return (
              <div 
                key={msg.id} 
                className={`flex gap-3 max-w-[85%] ${
                  isMe ? 'ml-auto flex-row-reverse text-right' : 'mr-auto text-left'
                }`}
              >
                {/* Avatar for others in group */}
                {!isMe && activeChat.isGroup && (
                  <img
                    src={msg.sender.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${msg.sender.username}`}
                    alt={msg.sender.username}
                    className="w-8 h-8 rounded-xl object-cover bg-slate-800 flex-shrink-0 mt-0.5"
                    title={msg.sender.username}
                  />
                )}

                <div className="space-y-1">
                  {/* Sender name for others in group */}
                  {!isMe && activeChat.isGroup && (
                    <span className="text-[10px] text-slate-500 font-semibold ml-1">
                      {msg.sender.username}
                    </span>
                  )}

                  {/* Message Bubble wrapper */}
                  <div className="relative group flex items-center gap-2">
                    
                    {/* Hover actions picker menu */}
                    <div className={`hidden group-hover:flex items-center gap-1.5 absolute top-1/2 -translate-y-1/2 z-10 px-2 py-1 bg-slate-900 border border-slate-800 rounded-xl shadow-lg ${
                      isMe ? 'right-full mr-2' : 'left-full ml-2'
                    }`}>
                      {/* Quick Reactions */}
                      {['👍', '❤️', '😂', '😮', '😢'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleToggleReaction(msg.id, emoji)}
                          className="hover:scale-130 transition-transform text-sm"
                        >
                          {emoji}
                        </button>
                      ))}

                      {/* Edit (Me only, and not deleted) */}
                      {isMe && !msg.isDeleted && (
                        <button
                          onClick={() => {
                            setEditingMessageId(msg.id);
                            setEditText(msg.content);
                          }}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                          title="Edytuj"
                        >
                          <Edit3 size={13} />
                        </button>
                      )}

                      {/* Delete (Me only) */}
                      {isMe && !msg.isDeleted && (
                        <button
                          onClick={() => handleDeleteSubmit(msg.id)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400"
                          title="Usuń"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* Bubble Content */}
                    <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                      msg.isDeleted 
                        ? 'bg-slate-900/40 text-slate-600 border border-slate-900/60 italic'
                        : isMe
                          ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white rounded-tr-none'
                          : 'bg-slate-850 text-slate-200 rounded-tl-none border border-slate-800/40'
                    }`}>
                      
                      {/* Inline Editing */}
                      {editingMessageId === msg.id ? (
                        <div className="space-y-2 py-1 text-left min-w-[200px]">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none"
                            rows={2}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setEditingMessageId(null)}
                              className="px-2 py-1 border border-slate-700 rounded text-[10px]"
                            >
                              Anuluj
                            </button>
                            <button
                              onClick={() => handleEditSubmit(msg.id)}
                              className="px-2 py-1 bg-violet-600 rounded text-[10px] text-white"
                            >
                              Zapisz
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Normal text display
                        <div>
                          {/* Image Attachment Rendering */}
                          {msg.fileUrl && msg.fileType?.startsWith('image/') && (
                            <div className="mb-2 relative rounded-lg overflow-hidden max-w-[240px] border border-black/10 group-photo">
                              <img
                                src={`${backendUrl}${msg.fileUrl}`}
                                alt="Załącznik"
                                className="w-full h-auto object-cover max-h-[160px] cursor-zoom-in"
                                onClick={() => setPreviewImage(`${backendUrl}${msg.fileUrl}`)}
                              />
                              <button 
                                onClick={() => setPreviewImage(`${backendUrl}${msg.fileUrl}`)}
                                className="absolute bottom-2 right-2 p-1 bg-slate-950/80 rounded-md text-white opacity-0 group-photo-hover:opacity-100 transition-opacity"
                              >
                                <Maximize2 size={12} />
                              </button>
                            </div>
                          )}

                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          
                          {/* Metadata (Edited, Timestamp) */}
                          <div className="flex items-center justify-end gap-1 mt-1">
                            {msg.isEdited && (
                              <span className="text-[8px] opacity-60 italic">(edytowana)</span>
                            )}
                            <span className="text-[8px] opacity-50 block">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Render Message Reactions overlay */}
                  {hasReactions && (
                    <div className={`flex gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800/80 px-2 py-0.5 rounded-full text-xs cursor-pointer shadow-md select-none">
                        {/* Render unique emojis */}
                        {Array.from(new Set(msg.reactions.map(r => r.emoji))).map(emoji => (
                          <span key={emoji}>{emoji}</span>
                        ))}
                        <span className="text-[9px] text-slate-450 ml-1 font-bold">
                          {msg.reactions.length}
                        </span>
                        
                        {/* Hover Tooltip (Show who reacted) */}
                        <div className="hidden hover-tooltip absolute bg-slate-950 border border-slate-800 p-2 rounded-xl text-[10px] text-slate-300 z-25 max-w-[150px] shadow-xl">
                          {msg.reactions.map(r => r.user.username).join(', ')}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator inside scrolling box */}
        {typingUsers.size > 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-500 italic ml-2">
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            <span>
              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'pisze...' : 'piszą...'}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* --- IMAGE ATTACHMENT PREVIEW DRAWER --- */}
      {filePreview && (
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between z-10 animate-fade-in">
          <div className="flex items-center gap-3">
            <img 
              src={filePreview} 
              alt="Podgląd wysyłania" 
              className="w-14 h-14 object-cover rounded-xl border border-slate-800 bg-slate-950" 
            />
            <div>
              <p className="text-xs font-semibold text-slate-350 truncate max-w-[200px]">{file.name}</p>
              <p className="text-[10px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <button 
            onClick={handleRemoveFile}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* --- FOOTER INPUT --- */}
      <form onSubmit={handleSendMessage} className="p-3 bg-slate-900 border-t border-slate-850 flex items-center gap-2">
        {/* Attachment Picker */}
        <label className="p-2.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex-shrink-0">
          <Image size={20} />
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileChange} 
          />
        </label>

        {/* Input Bar */}
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder={file ? 'Dodaj opis do zdjęcia...' : 'Napisz wiadomość...'}
          className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-600 focus:border-transparent text-sm text-slate-200 placeholder-slate-600"
        />

        {/* Submit Button */}
        <button
          type="submit"
          className="p-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl shadow-md shadow-violet-500/10 flex-shrink-0 transition-all duration-300"
        >
          <Send size={18} />
        </button>
      </form>

      {/* --- IMAGE OVERLAY PREVIEW MODAL --- */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <button 
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 bg-slate-900/60 rounded-full text-white hover:bg-slate-850 hover:text-rose-400 transition-all shadow-lg"
          >
            <X size={24} />
          </button>
          <img 
            src={previewImage} 
            alt="Powiększenie załącznika" 
            className="max-w-[90%] max-h-[85%] object-contain rounded-lg border border-slate-800 shadow-2xl"
          />
        </div>
      )}

    </div>
  );
};

export default ChatArea;
