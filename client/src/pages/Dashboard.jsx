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
import { ArrowLeft, MessageCircle } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [activeChatId, setActiveChatId] = useState(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [conversations, setConversations] = useState([]);

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

    // conversation_updated — update metadata or members in sidebar list
    const handleConversationUpdated = async (updatedConv) => {
      // If this was triggered by a member removal/leave (membersChanged flag),
      // fetch fresh conversation data to get updated member list
      if (updatedConv.membersChanged) {
        try {
          const response = await api.get(`/conversations/${updatedConv.id}`);
          const freshConv = response.data;
          setConversations(prev => prev.map(c => {
            if (c.id === updatedConv.id) {
              return { ...c, ...freshConv };
            }
            return c;
          }));
        } catch (err) {
          // Conversation may have been deleted
          console.error('Error refreshing conversation after member change:', err);
        }
        return;
      }

      setConversations(prev => {
        const exists = prev.find(c => c.id === updatedConv.id);
        
        if (exists) {
          return prev.map(c => {
            if (c.id === updatedConv.id) {
              return {
                ...c,
                name: updatedConv.name ?? c.name,
                avatarUrl: updatedConv.avatarUrl ?? c.avatarUrl,
                updatedAt: updatedConv.updatedAt ?? c.updatedAt,
                members: updatedConv.members ?? c.members,
                ownerId: updatedConv.ownerId ?? c.ownerId,
                lastMessage: updatedConv.lastMessage !== undefined ? updatedConv.lastMessage : c.lastMessage,
                sortDate: updatedConv.lastMessage ? updatedConv.lastMessage.createdAt : (updatedConv.updatedAt ?? c.sortDate)
              };
            }
            return c;
          }).sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.sortDate) - new Date(a.sortDate);
          });
        } else {
          // Fetch full conversation details to insert (new group invite etc.)
          fetchAndInsertConversation(updatedConv.id);
          return prev;
        }
      });
    };

    // group_left — remove conversation from user's list (was kicked/removed)
    const handleGroupLeft = ({ conversationId }) => {
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      setActiveChatId(prev => prev === conversationId ? null : prev);
    };

    const fetchAndInsertConversation = async (id) => {
      try {
        const response = await api.get(`/conversations/${id}`);
        const c = response.data;
        
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

    // user_profile_updated — update usernames and avatars in existing conversations globally
    const handleUserProfileUpdated = ({ userId, username, avatarUrl }) => {
      setConversations(prev => prev.map(conv => ({
        ...conv,
        members: conv.members.map(member => {
          if (member.userId === userId) {
            return { ...member, username, avatarUrl };
          }
          return member;
        })
      })));
    };

    socket.on('conversation_updated', handleConversationUpdated);
    socket.on('group_left', handleGroupLeft);
    socket.on('user_profile_updated', handleUserProfileUpdated);

    return () => {
      socket.off('conversation_updated', handleConversationUpdated);
      socket.off('group_left', handleGroupLeft);
      socket.off('user_profile_updated', handleUserProfileUpdated);
    };
  }, [socket]);

  const handleSelectChat = (id) => {
    setActiveChatId(id);
    setIsInfoOpen(false);
  };

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
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans">
      
      {/* --- SIDEBAR LIST --- */}
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
      <div className={`flex-1 h-full flex ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
        {activeChatId ? (
          <div className="flex-1 h-full flex relative overflow-hidden">
            
            <div className="flex-1 h-full flex flex-col relative">
              {/* Mobile Back Button */}
              <div className="absolute top-4 left-4 z-20 md:hidden">
                <button 
                  onClick={() => handleSelectChat(null)}
                  className="p-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-full border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white shadow-sm"
                >
                  <ArrowLeft size={16} />
                </button>
              </div>

              <ChatArea
                conversationId={activeChatId}
                isInfoOpen={isInfoOpen}
                onToggleInfo={() => setIsInfoOpen(!isInfoOpen)}
                conversations={conversations}
                setConversations={setConversations}
              />
            </div>

            {/* --- DETAILED INFOPANEL --- */}
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
          <div className="flex-1 h-full flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-600 gap-4">
            <div className="p-5 bg-gradient-to-tr from-violet-600/10 to-indigo-600/10 dark:from-violet-600/5 dark:to-indigo-600/5 border border-violet-200 dark:border-violet-800/30 rounded-3xl">
              <MessageCircle size={48} className="text-violet-300 dark:text-violet-700" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-500">Wybierz rozmowę</p>
              <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">lub wyszukaj kogoś, by zacząć pisać</p>
            </div>
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
