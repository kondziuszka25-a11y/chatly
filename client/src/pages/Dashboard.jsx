import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import InfoPanel from '../components/InfoPanel';
import { 
  SettingsModal, CreateGroupModal, NotificationsModal 
} from '../components/Modals';
import { ArrowLeft } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [activeChatId, setActiveChatId] = useState(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [conversations, setConversations] = useState([]);

  // Modals States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  // Fetch initial conversations list
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await api.get('/conversations');
        setConversations(response.data);
      } catch (err) {
        console.error('Error fetching conversations:', err);
      }
    };
    if (user) {
      fetchConversations();
    }
  }, [user]);

  // Listen for real-time conversation list updates
  useEffect(() => {
    if (!socket) return;

    const handleConversationUpdated = async (updatedConv) => {
      setConversations(prev => {
        const exists = prev.find(c => c.id === updatedConv.id);
        
        if (exists) {
          // If conversation already exists in sidebar, update it
          return prev.map(c => {
            if (c.id === updatedConv.id) {
              return {
                ...c,
                name: updatedConv.name,
                avatarUrl: updatedConv.avatarUrl,
                updatedAt: updatedConv.updatedAt,
                lastMessage: updatedConv.lastMessage,
                sortDate: updatedConv.lastMessage ? updatedConv.lastMessage.createdAt : updatedConv.updatedAt
              };
            }
            return c;
          }).sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.sortDate) - new Date(a.sortDate);
          });
        } else {
          // Fetch full conversation details to insert
          fetchAndInsertConversation(updatedConv.id);
          return prev;
        }
      });
    };

    const fetchAndInsertConversation = async (id) => {
      try {
        const response = await api.get(`/conversations/${id}`);
        const c = response.data;
        
        // Load latest messages
        const msgResponse = await api.get(`/messages/${id}?limit=1`);
        const lastMsg = msgResponse.data[0] || null;

        const formatted = {
          ...c,
          lastMessage: lastMsg ? {
            id: lastMsg.id,
            senderId: lastMsg.senderId,
            content: lastMsg.content,
            fileUrl: lastMsg.fileUrl,
            fileType: lastMsg.fileType,
            createdAt: lastMsg.createdAt
          } : null,
          sortDate: lastMsg ? lastMsg.createdAt : c.updatedAt
        };

        setConversations(prev => {
          const exists = prev.find(item => item.id === id);
          if (exists) return prev;
          const next = [formatted, ...prev];
          return next.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.sortDate) - new Date(a.sortDate);
          });
        });
      } catch (err) {
        console.error('Error fetching conversation detail:', err);
      }
    };

    socket.on('conversation_updated', handleConversationUpdated);

    return () => {
      socket.off('conversation_updated', handleConversationUpdated);
    };
  }, [socket]);

  // Handle Select Chat
  const handleSelectChat = (id) => {
    setActiveChatId(id);
    setIsInfoOpen(false); // default to closed when changing chat
  };

  // Group created callback
  const handleGroupCreated = (newGroup) => {
    const formatted = {
      id: newGroup.id,
      name: newGroup.name,
      avatarUrl: newGroup.avatarUrl,
      isGroup: newGroup.isGroup,
      ownerId: newGroup.ownerId,
      createdAt: newGroup.createdAt,
      updatedAt: newGroup.updatedAt,
      isPinned: false,
      lastReadAt: new Date().toISOString(),
      members: newGroup.members.map(m => ({
        userId: m.user.id,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        status: m.user.status,
        lastActive: m.user.lastActive,
        joinedAt: m.joinedAt
      })),
      lastMessage: null,
      sortDate: new Date().toISOString()
    };

    setConversations(prev => [formatted, ...prev]);
    setActiveChatId(formatted.id);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      {/* --- SIDEBAR LIST --- */}
      {/* Hidden on mobile if activeChatId is set */}
      <div className={`h-full flex-shrink-0 ${activeChatId ? 'hidden md:flex' : 'flex w-full md:w-auto'}`}>
        <Sidebar
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
          conversations={conversations}
          setConversations={setConversations}
        />
      </div>

      {/* --- ACTIVE CHAT PANEL --- */}
      {/* Hidden on mobile if activeChatId is not set */}
      <div className={`flex-1 h-full flex ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
        {activeChatId ? (
          <div className="flex-1 h-full flex relative overflow-hidden">
            
            {/* Mobile Back Button layout */}
            <div className="flex-1 h-full flex flex-col relative">
              {/* Back button container overlay for mobile */}
              <div className="absolute top-4 left-4 z-20 md:hidden">
                <button 
                  onClick={() => handleSelectChat(null)}
                  className="p-2 bg-slate-900/90 rounded-full border border-slate-800 text-slate-400 hover:text-white"
                >
                  <ArrowLeft size={16} />
                </button>
              </div>

              {/* Chat log viewport */}
              <ChatArea
                conversationId={activeChatId}
                isInfoOpen={isInfoOpen}
                onToggleInfo={() => setIsInfoOpen(!isInfoOpen)}
                conversations={conversations}
                setConversations={setConversations}
              />
            </div>

            {/* --- DETAILED INFOPANEL (Toggled from ChatHeader) --- */}
            {isInfoOpen && (
              <div className="absolute inset-y-0 right-0 z-30 md:static h-full flex-shrink-0">
                <InfoPanel
                  conversationId={activeChatId}
                  onClose={() => setIsInfoOpen(false)}
                  conversations={conversations}
                  setConversations={setConversations}
                  onSelectChat={handleSelectChat}
                />
              </div>
            )}

          </div>
        ) : (
          <div className="flex-1 h-full flex flex-col justify-center items-center bg-slate-950 text-slate-600">
            <p className="text-sm">Wybierz lub wyszukaj rozmówcę, by zacząć pisać</p>
          </div>
        )}
      </div>

      {/* --- DIALOG MODALS --- */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />

      <CreateGroupModal 
        isOpen={isCreateGroupOpen} 
        onClose={() => setIsCreateGroupOpen(false)} 
        onGroupCreated={handleGroupCreated} 
      />

      <NotificationsModal 
        isOpen={isNotificationsOpen} 
        onClose={() => setIsNotificationsOpen(false)} 
        onSelectChat={handleSelectChat}
      />

    </div>
  );
};

export default Dashboard;
