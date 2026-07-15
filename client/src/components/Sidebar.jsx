import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import { 
  Search, Pin, MessageSquare, Users, Settings, LogOut, Bell, PlusCircle, Check
} from 'lucide-react';

const Sidebar = ({ 
  activeChatId, 
  onSelectChat, 
  onOpenSettings, 
  onOpenNotifications, 
  onOpenCreateGroup,
  conversations,
  setConversations
}) => {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // Load notifications to show unread badge count
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/notifications');
        const unread = response.data.filter(n => !n.isRead).length;
        setUnreadNotificationsCount(unread);
      } catch (err) {
        console.error('Error fetching notifications count:', err);
      }
    };
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  // Listen for socket events to update unread badge counts
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = () => {
      setUnreadNotificationsCount(prev => prev + 1);
    };

    socket.on('new_notification', handleNewNotification);

    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [socket]);

  // Handle live user search
  useEffect(() => {
    const search = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const response = await api.get(`/users/search?q=${searchQuery}`);
        setSearchResults(response.data);
      } catch (err) {
        console.error('User search error:', err);
      } finally {
        setSearching(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      search();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Start 1:1 conversation from search result
  const handleStartChat = async (targetUser) => {
    try {
      const response = await api.post('/conversations', {
        isGroup: false,
        userId: targetUser.id
      });
      
      const newConv = response.data;
      
      // Enforce formatting for consistency
      const formattedConv = {
        id: newConv.id,
        name: newConv.name,
        avatarUrl: newConv.avatarUrl,
        isGroup: newConv.isGroup,
        ownerId: newConv.ownerId,
        createdAt: newConv.createdAt,
        updatedAt: newConv.updatedAt,
        isPinned: false,
        lastReadAt: new Date().toISOString(),
        members: newConv.members.map(m => ({
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

      setConversations(prev => {
        const exists = prev.find(c => c.id === formattedConv.id);
        if (exists) return prev;
        return [formattedConv, ...prev];
      });

      setSearchQuery('');
      setSearchResults([]);
      onSelectChat(formattedConv.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Nie udało się rozpocząć rozmowy.');
    }
  };

  // Helper to format timestamps
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full md:w-80 h-full flex flex-col bg-slate-900 border-r border-slate-800 text-slate-200">
      {/* --- HEADER --- */}
      <div className="p-4 border-b border-slate-850 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-lg text-white">
            <MessageSquare size={20} />
          </div>
          <span className="font-bold text-lg tracking-wide bg-gradient-to-r from-violet-400 to-indigo-300 bg-clip-text text-transparent">
            Czat
          </span>
        </div>
        <div className="flex gap-2">
          {/* Create Group Button */}
          <button 
            onClick={onOpenCreateGroup}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
            title="Nowa Grupa"
          >
            <PlusCircle size={20} />
          </button>
          
          {/* Notifications Button */}
          <button 
            onClick={onOpenNotifications}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-colors relative"
            title="Powiadomienia"
          >
            <Bell size={20} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 block h-4 w-4 rounded-full bg-rose-600 text-[10px] font-bold text-white flex items-center justify-center border border-slate-900 animate-bounce">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* --- SEARCH BAR --- */}
      <div className="p-3">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj użytkowników..."
            className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-600 focus:border-transparent text-sm placeholder-slate-600"
          />
        </div>
      </div>

      {/* --- CONVERSATIONS / SEARCH RESULTS --- */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-1">
        {searchQuery.trim() !== '' ? (
          // --- SEARCH RESULTS VIEW ---
          <div>
            <div className="text-xs font-semibold text-slate-500 px-3 mb-2 uppercase tracking-wider">
              Wyniki wyszukiwania
            </div>
            {searching ? (
              <div className="text-sm text-slate-500 text-center py-4">Wyszukiwanie...</div>
            ) : searchResults.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-4">Brak wyników</div>
            ) : (
              searchResults.map(resultUser => (
                <button
                  key={resultUser.id}
                  onClick={() => handleStartChat(resultUser)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/60 transition-colors text-left"
                >
                  <div className="relative">
                    <img
                      src={resultUser.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${resultUser.username}`}
                      alt={resultUser.username}
                      className="w-10 h-10 rounded-xl object-cover bg-slate-800"
                    />
                    <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-slate-900 ${
                      resultUser.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-slate-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">{resultUser.username}</p>
                    <p className="text-xs text-slate-500 truncate">{resultUser.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          // --- CONVERSATION LIST VIEW ---
          <div>
            {conversations.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8">
                Brak rozmów.<br />Wyszukaj kogoś, by zacząć!
              </div>
            ) : (
              conversations.map(conv => {
                // Determine conversational label
                let displayName = conv.name;
                let displayAvatar = conv.avatarUrl;
                let statusBadge = null;

                if (!conv.isGroup) {
                  const otherMember = conv.members.find(m => m.userId !== user.id);
                  displayName = otherMember ? otherMember.username : 'Użytkownik';
                  displayAvatar = otherMember ? otherMember.avatarUrl : null;
                  
                  const isOnline = otherMember?.status === 'ONLINE';
                  statusBadge = (
                    <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-slate-900 ${
                      isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                    }`} />
                  );
                }

                const isActive = activeChatId === conv.id;
                const isUnread = conv.lastMessage && new Date(conv.lastMessage.createdAt) > new Date(conv.lastReadAt);

                return (
                  <button
                    key={conv.id}
                    onClick={() => onSelectChat(conv.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left ${
                      isActive 
                        ? 'bg-gradient-to-r from-violet-600/30 to-indigo-600/10 border-l-4 border-violet-500' 
                        : 'hover:bg-slate-800/40 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={displayAvatar || (conv.isGroup 
                          ? `https://api.dicebear.com/7.x/identicon/svg?seed=${displayName}`
                          : `https://api.dicebear.com/7.x/initials/svg?seed=${displayName}`
                        )}
                        alt={displayName}
                        className="w-11 h-11 rounded-2xl object-cover bg-slate-800"
                      />
                      {statusBadge}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold truncate ${
                          isUnread ? 'text-white font-extrabold' : 'text-slate-300'
                        }`}>
                          {displayName}
                        </span>
                        <span className="text-[10px] text-slate-500 flex-shrink-0 ml-1">
                          {formatTime(conv.sortDate)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-0.5">
                        <p className={`text-xs truncate max-w-[80%] ${
                          isUnread ? 'text-indigo-300 font-semibold' : 'text-slate-500'
                        }`}>
                          {conv.lastMessage ? (
                            <span>
                              {conv.lastMessage.senderId === user.id ? 'Ja: ' : ''}
                              {conv.lastMessage.content}
                            </span>
                          ) : (
                            <span className="italic text-slate-650">Brak wiadomości</span>
                          )}
                        </p>
                        
                        <div className="flex items-center gap-1.5">
                          {conv.isPinned && <Pin size={10} className="text-violet-400 rotate-45" />}
                          {isUnread && <span className="h-2 w-2 rounded-full bg-violet-500" />}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* --- FOOTER (USER PROFILE & SETTINGS) --- */}
      <div className="p-3 bg-slate-950 border-t border-slate-850 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username}`}
            alt={user?.username}
            className="w-9 h-9 rounded-xl object-cover bg-slate-800 flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.username}</p>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              aktywny
            </span>
          </div>
        </div>

        <div className="flex gap-1.5">
          <button 
            onClick={onOpenSettings}
            className="p-2 hover:bg-slate-900 rounded-xl text-slate-500 hover:text-slate-300 transition-colors"
            title="Ustawienia profilu"
          >
            <Settings size={18} />
          </button>
          <button 
            onClick={logout}
            className="p-2 hover:bg-slate-900 rounded-xl text-slate-500 hover:text-rose-400 transition-colors"
            title="Wyloguj się"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
