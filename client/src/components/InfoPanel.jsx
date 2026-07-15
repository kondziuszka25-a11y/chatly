import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { 
  Users, Image, Ban, LogOut, Edit, Camera, Plus, Trash, UserCheck, ShieldAlert
} from 'lucide-react';

const InfoPanel = ({ 
  conversationId, 
  onClose, 
  conversations, 
  setConversations,
  onSelectChat
}) => {
  const { user } = useAuth();
  const [activeChat, setActiveChat] = useState(null);
  
  // Group details States
  const [editName, setEditName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [groupAvatar, setGroupAvatar] = useState(null);

  // Add Member States
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Shared Media State
  const [mediaList, setMediaList] = useState([]);
  
  // Block state for 1:1
  const [isBlocked, setIsBlocked] = useState(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    const chat = conversations.find(c => c.id === conversationId);
    setActiveChat(chat || null);
    if (chat) {
      setEditName(chat.name || '');
      setIsEditing(false);
      
      // Load Shared Media Gallery
      fetchSharedMedia();

      // Check block status for 1:1
      if (!chat.isGroup) {
        checkBlockStatus(chat);
      }
    }
  }, [conversationId, conversations]);

  const fetchSharedMedia = async () => {
    try {
      const response = await api.get(`/messages/${conversationId}?limit=100`);
      // Filter messages containing image files
      const media = response.data.filter(m => m.fileUrl && m.fileType?.startsWith('image/'));
      setMediaList(media);
    } catch (err) {
      console.error('Error fetching media:', err);
    }
  };

  const checkBlockStatus = async (chat) => {
    try {
      const otherMember = chat.members.find(m => m.userId !== user.id);
      if (!otherMember) return;
      const response = await api.get('/users/blocked');
      const blocked = response.data.some(b => b.id === otherMember.userId);
      setIsBlocked(blocked);
    } catch (err) {
      console.error('Error checking block status:', err);
    }
  };

  // Update Group details
  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!editName.trim() && !groupAvatar) return;

    const formData = new FormData();
    if (editName) formData.append('name', editName);
    if (groupAvatar) formData.append('avatar', groupAvatar);

    try {
      const response = await api.put(`/conversations/${conversationId}/settings`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const updated = response.data;
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, name: updated.name, avatarUrl: updated.avatarUrl } : c
      ));
      setIsEditing(false);
      setGroupAvatar(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd aktualizacji grupy.');
    }
  };

  // Add Member search
  useEffect(() => {
    const search = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        const response = await api.get(`/users/search?q=${searchQuery}`);
        // Filter out users who are already group members
        const currentMemberIds = activeChat.members.map(m => m.userId);
        const filtered = response.data.filter(u => !currentMemberIds.includes(u.id));
        setSearchResults(filtered);
      } catch (err) {
        console.error(err);
      }
    };

    const delay = setTimeout(search, 300);
    return () => clearTimeout(delay);
  }, [searchQuery, activeChat]);

  const handleAddMember = async (targetUserId) => {
    try {
      const response = await api.post(`/conversations/${conversationId}/members`, { userId: targetUserId });
      const updated = response.data;

      // Map member model correctly
      const updatedMembers = updated.members.map(m => ({
        userId: m.user.id,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        status: m.user.status,
        lastActive: m.user.lastActive,
        joinedAt: m.joinedAt
      }));

      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, members: updatedMembers } : c
      ));
      setShowAddMember(false);
      setSearchQuery('');
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd dodawania członka.');
    }
  };

  // Remove Member
  const handleRemoveMember = async (targetUserId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tego członka?')) return;
    try {
      await api.delete(`/conversations/${conversationId}/members/${targetUserId}`);
      setConversations(prev => prev.map(c => {
        if (c.id === conversationId) {
          return { ...c, members: c.members.filter(m => m.userId !== targetUserId) };
        }
        return c;
      }));
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd usuwania członka.');
    }
  };

  // Leave Group
  const handleLeaveGroup = async () => {
    if (!window.confirm('Czy na pewno chcesz opuścić tę grupę?')) return;
    try {
      await api.post(`/conversations/${conversationId}/leave`);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      onSelectChat(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd opuszczania grupy.');
    }
  };

  // Block/Unblock Toggle for 1:1
  const handleToggleBlock = async () => {
    if (!activeChat) return;
    const otherMember = activeChat.members.find(m => m.userId !== user.id);
    if (!otherMember) return;

    try {
      if (isBlocked) {
        // Unblock
        await api.post('/users/unblock', { blockedId: otherMember.userId });
        setIsBlocked(false);
      } else {
        // Block
        if (window.confirm(`Czy na pewno chcesz zablokować użytkownika ${otherMember.username}?`)) {
          await api.post('/users/block', { blockedId: otherMember.userId });
          setIsBlocked(true);
        }
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd blokady.');
    }
  };

  if (!activeChat) return null;

  let displayName = activeChat.name;
  let displayAvatar = activeChat.avatarUrl;
  let otherUserId = null;

  if (!activeChat.isGroup) {
    const otherMember = activeChat.members.find(m => m.userId !== user.id);
    displayName = otherMember?.username || 'Użytkownik';
    displayAvatar = otherMember?.avatarUrl || null;
    otherUserId = otherMember?.userId;
  }

  const isOwner = activeChat.isGroup && activeChat.ownerId === user.id;

  return (
    <div className="w-full md:w-80 h-full flex flex-col bg-slate-900 border-l border-slate-800 text-slate-200 overflow-y-auto custom-scrollbar p-4 space-y-6">
      
      {/* --- AVATAR & NAME DETAILS --- */}
      <div className="flex flex-col items-center text-center space-y-3 pb-4 border-b border-slate-800">
        <div className="relative">
          <img
            src={displayAvatar || (activeChat.isGroup 
              ? `https://api.dicebear.com/7.x/identicon/svg?seed=${displayName}`
              : `https://api.dicebear.com/7.x/initials/svg?seed=${displayName}`
            )}
            alt={displayName}
            className="w-24 h-24 rounded-3xl object-cover bg-slate-850 border border-slate-800"
          />
        </div>

        {activeChat.isGroup && isEditing ? (
          // Editing group name form
          <form onSubmit={handleUpdateGroup} className="w-full space-y-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none text-center"
            />
            <label className="flex items-center justify-center gap-1.5 text-xs text-indigo-400 cursor-pointer">
              <Camera size={14} />
              Zmień avatar
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={(e) => setGroupAvatar(e.target.files[0])} 
              />
            </label>
            {groupAvatar && (
              <span className="text-[10px] text-slate-450 block truncate">{groupAvatar.name}</span>
            )}
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 border border-slate-700 rounded-lg text-xs"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-violet-600 rounded-lg text-xs text-white"
              >
                Zapisz
              </button>
            </div>
          </form>
        ) : (
          <div className="w-full">
            <h3 className="text-lg font-bold text-slate-100 flex items-center justify-center gap-2">
              <span className="truncate">{displayName}</span>
              {activeChat.isGroup && (
                <button 
                  onClick={() => setIsEditing(true)} 
                  className="p-1 text-slate-500 hover:text-slate-350"
                >
                  <Edit size={14} />
                </button>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeChat.isGroup ? 'Czat grupowy' : 'Czat prywatny'}
            </p>
          </div>
        )}
      </div>

      {/* --- MEMBERS SECTION (GROUPS ONLY) --- */}
      {activeChat.isGroup && (
        <div className="space-y-3 pb-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} />
              Członkowie ({activeChat.members.length})
            </span>
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="p-1 hover:bg-slate-800 rounded-lg text-indigo-400 hover:text-indigo-300"
              title="Dodaj członka"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Add member box */}
          {showAddMember && (
            <div className="space-y-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
              <input
                type="text"
                placeholder="Szukaj użytkownika..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-850 rounded-xl text-xs focus:outline-none"
              />
              <div className="max-h-36 overflow-y-auto space-y-1">
                {searchResults.length === 0 ? (
                  <p className="text-[10px] text-slate-600 text-center py-2">Brak pasujących użytkowników</p>
                ) : (
                  searchResults.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-1 hover:bg-slate-900 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <img 
                          src={u.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`} 
                          alt={u.username} 
                          className="w-6 h-6 rounded-md object-cover bg-slate-800" 
                        />
                        <span className="text-xs truncate text-slate-200">{u.username}</span>
                      </div>
                      <button
                        onClick={() => handleAddMember(u.id)}
                        className="p-1 bg-violet-600 hover:bg-violet-500 rounded text-white"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Members list */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {activeChat.members.map(member => {
              const isMemberOwner = member.userId === activeChat.ownerId;
              const isCurrentMember = member.userId === user.id;

              return (
                <div key={member.userId} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={member.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${member.username}`}
                      alt={member.username}
                      className="w-7 h-7 rounded-lg object-cover bg-slate-850"
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-300 truncate flex items-center gap-1">
                        <span>{member.username}</span>
                        {isCurrentMember && <span className="text-[9px] opacity-60 text-slate-400">(Ja)</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isMemberOwner && (
                      <span className="text-[8px] bg-amber-500/10 border border-amber-500/30 text-amber-500 px-1.5 py-0.5 rounded-md font-bold">
                        Właściciel
                      </span>
                    )}

                    {/* Delete member (Owner only, can't delete self) */}
                    {isOwner && !isCurrentMember && (
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-800 rounded text-rose-500"
                        title="Usuń"
                      >
                        <Trash size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- ACTIONS SECTION --- */}
      <div className="space-y-2 pb-4 border-b border-slate-800">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
          Opcje rozmowy
        </span>

        {activeChat.isGroup ? (
          // Leave Group (Everyone)
          <button
            onClick={handleLeaveGroup}
            className="w-full flex items-center gap-2 px-3 py-2 bg-slate-850 hover:bg-rose-550/10 hover:text-rose-400 border border-slate-800 hover:border-rose-500/20 text-slate-300 rounded-xl text-xs transition-colors"
          >
            <LogOut size={14} />
            Opóść grupę
          </button>
        ) : (
          // Block / Unblock User (1:1 chats only)
          <button
            onClick={handleToggleBlock}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors border ${
              isBlocked
                ? 'bg-emerald-600/10 hover:bg-emerald-650/20 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-600/10 hover:bg-rose-650/20 border-rose-500/30 text-rose-450'
            }`}
          >
            {isBlocked ? <UserCheck size={14} /> : <Ban size={14} />}
            {isBlocked ? 'Odblokuj użytkownika' : 'Zablokuj użytkownika'}
          </button>
        )}
      </div>

      {/* --- SHARED MEDIA GALLERY --- */}
      <div className="space-y-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Image size={14} />
          Udostępnione multimedia
        </span>

        {mediaList.length === 0 ? (
          <p className="text-xs text-slate-650 italic text-center py-4">Brak zdjęć w tym czacie</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {mediaList.map(msg => (
              <div 
                key={msg.id} 
                className="aspect-square rounded-lg overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <img
                  src={`${backendUrl}${msg.fileUrl}`}
                  alt="Shared media item"
                  className="w-full h-full object-cover"
                  onClick={() => window.open(`${backendUrl}${msg.fileUrl}`, '_blank')}
                />
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default InfoPanel;
