import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import { 
  X, Camera, Sun, Moon, Ban, Bell, Check, Trash2, Users, FolderCheck
} from 'lucide-react';

// ==========================================
// 1. SETTINGS MODAL
// ==========================================
export const SettingsModal = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [blockedUsers, setBlockedUsers] = useState([]);
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setUsername(user.username);
      setEmail(user.email);
      setAvatarPreview(user.avatarUrl || '');
      setAvatar(null);
      setError('');
      setMessage('');
      fetchBlockedUsers();
    }
  }, [user, isOpen]);

  const fetchBlockedUsers = async () => {
    try {
      const response = await api.get('/users/blocked');
      setBlockedUsers(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const result = await updateProfile(username, email, avatar);
    setLoading(false);
    
    if (result.success) {
      setMessage('Profil zaktualizowany pomyślnie!');
    } else {
      setError(result.error);
    }
  };

  const handleUnblock = async (blockedId) => {
    try {
      await api.post('/users/unblock', { blockedId });
      setBlockedUsers(prev => prev.filter(b => b.id !== blockedId));
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-40 p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto custom-scrollbar text-slate-200">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-200 transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-6 text-slate-100">Ustawienia Konta</h2>

        {/* Theme Settings */}
        <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-850 mb-6">
          <div>
            <p className="text-sm font-semibold text-slate-200">Tryb Wyglądu</p>
            <p className="text-xs text-slate-500">Zmień motyw kolorystyczny aplikacji</p>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs hover:bg-slate-800 transition-colors text-indigo-400"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
          </button>
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Edycja Profilu</h3>

          {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs">{error}</div>}
          {message && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs">{message}</div>}

          {/* Avatar Upload */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={avatarPreview || `https://api.dicebear.com/7.x/initials/svg?seed=${username}`}
                alt="Avatar Preview"
                className="w-16 h-16 rounded-2xl object-cover bg-slate-950 border border-slate-800"
              />
              <label className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-white cursor-pointer shadow-md">
                <Camera size={12} />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarChange} 
                />
              </label>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300">Zdjęcie profilowe</p>
              <p className="text-[10px] text-slate-500">Dopuszczalne pliki JPEG/PNG o maks. rozmiarze 5MB</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Nazwa użytkownika</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-violet-600 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Adres E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-violet-600 text-slate-200"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-medium shadow-md disabled:opacity-50 transition-all"
            >
              {loading ? 'Zapisywanie...' : 'Zapisz zmiany'}
            </button>
          </div>
        </form>

        {/* Blocked Users Section */}
        <div className="mt-8 pt-6 border-t border-slate-800 space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Ban size={14} className="text-rose-500" />
            Zablokowani użytkownicy ({blockedUsers.length})
          </h3>
          {blockedUsers.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Brak zablokowanych użytkowników</p>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {blockedUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between p-2 bg-slate-950 rounded-xl border border-slate-850">
                  <div className="flex items-center gap-2 min-w-0">
                    <img 
                      src={u.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`} 
                      alt={u.username} 
                      className="w-7 h-7 rounded-lg object-cover bg-slate-900" 
                    />
                    <span className="text-xs text-slate-250 font-medium truncate">{u.username}</span>
                  </div>
                  <button
                    onClick={() => handleUnblock(u.id)}
                    className="px-2.5 py-1.5 border border-slate-800 hover:bg-slate-900 rounded-lg text-[10px] text-slate-400 hover:text-white transition-colors"
                  >
                    Odblokuj
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};


// ==========================================
// 2. CREATE GROUP MODAL
// ==========================================
export const CreateGroupModal = ({ isOpen, onClose, onGroupCreated }) => {
  const { user } = useAuth();
  
  const [groupName, setGroupName] = useState('');
  const [groupAvatar, setGroupAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch users to add to group
  useEffect(() => {
    if (!isOpen) return;
    setGroupName('');
    setGroupAvatar(null);
    setAvatarPreview('');
    setSelectedUserIds([]);
    setError('');
    fetchUsers('');
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchUsers(searchQuery);
    }
  }, [searchQuery]);

  const fetchUsers = async (query) => {
    try {
      const response = await api.get(`/users/search?q=${query || 'a'}`); // list some default users
      setUsersList(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setGroupAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleToggleSelectUser = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!groupName.trim()) {
      setError('Nazwa grupy jest wymagana');
      return;
    }
    if (selectedUserIds.length === 0) {
      setError('Wybierz co najmniej jednego członka');
      return;
    }
    setLoading(true);

    const formData = new FormData();
    formData.append('isGroup', 'true');
    formData.append('name', groupName);
    formData.append('memberIds', JSON.stringify(selectedUserIds));
    if (groupAvatar) {
      formData.append('avatar', groupAvatar);
    }

    try {
      const response = await api.post('/conversations', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onGroupCreated(response.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się stworzyć grupy.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-40 p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto custom-scrollbar text-slate-200">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-200 transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-6 text-slate-100">Utwórz grupę</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs">{error}</div>}

          {/* Group Avatar Upload */}
          <div className="flex items-center gap-4 justify-center py-2">
            <div className="relative">
              <img
                src={avatarPreview || `https://api.dicebear.com/7.x/identicon/svg?seed=placeholder-group`}
                alt="Group Avatar Preview"
                className="w-16 h-16 rounded-2xl object-cover bg-slate-950 border border-slate-800"
              />
              <label className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-white cursor-pointer shadow-md">
                <Camera size={12} />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarChange} 
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Nazwa grupy</label>
            <input
              type="text"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="np. Antygrawitacyjny Zespół"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-violet-600 text-slate-200"
            />
          </div>

          {/* Member Search */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Wybierz członków</label>
            <input
              type="text"
              placeholder="Szukaj znajomych..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm focus:outline-none mb-2"
            />

            <div className="max-h-48 overflow-y-auto space-y-1.5 bg-slate-950 p-2 rounded-xl border border-slate-850">
              {usersList.length === 0 ? (
                <p className="text-xs text-slate-650 text-center py-4">Wpisz zapytanie, aby wyszukać</p>
              ) : (
                usersList.map(u => {
                  const isChecked = selectedUserIds.includes(u.id);

                  return (
                    <div 
                      key={u.id}
                      onClick={() => handleToggleSelectUser(u.id)}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img 
                          src={u.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`} 
                          alt={u.username} 
                          className="w-7 h-7 rounded-lg object-cover bg-slate-850" 
                        />
                        <span className="text-xs text-slate-350 font-medium truncate">{u.username}</span>
                      </div>
                      
                      <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                        isChecked 
                          ? 'bg-violet-600 border-violet-500 text-white' 
                          : 'border-slate-800 bg-slate-900 text-transparent'
                      }`}>
                        <Check size={12} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
            >
              <FolderCheck size={14} />
              {loading ? 'Tworzenie...' : 'Utwórz grupę'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};


// ==========================================
// 3. NOTIFICATIONS DROPDOWN / POPUP
// ==========================================
export const NotificationsModal = ({ isOpen, onClose, onSelectChat }) => {
  const [notifications, setNotifications] = useState([]);
  
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await handleMarkRead(notif.id);
    }
    if (notif.conversationId) {
      onSelectChat(notif.conversationId);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-40 p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl p-5 relative max-h-[80vh] overflow-y-auto custom-scrollbar text-slate-200">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-200 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center justify-between mb-4 pr-6">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-1.5">
            <Bell size={18} className="text-violet-400" />
            Powiadomienia
          </h2>
          {notifications.some(n => !n.isRead) && (
            <button
              onClick={handleMarkAllRead}
              className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold"
            >
              Oznacz wszystkie jako przeczytane
            </button>
          )}
        </div>

        <div className="space-y-2 overflow-y-auto max-h-[55vh] pr-1">
          {notifications.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-8">Brak powiadomień</p>
          ) : (
            notifications.map(n => (
              <div 
                key={n.id}
                className={`p-3 rounded-2xl border flex items-start gap-3 transition-colors ${
                  n.isRead 
                    ? 'bg-slate-950/40 border-slate-900' 
                    : 'bg-slate-950 border-slate-800/80 shadow-md'
                }`}
              >
                {/* Triggering User avatar */}
                <div className="relative">
                  <img
                    src={n.sender?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${n.sender?.username || 'System'}`}
                    alt="sender avatar"
                    className="w-8 h-8 rounded-lg object-cover bg-slate-900"
                  />
                  {!n.isRead && <span className="absolute -top-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-violet-500 border-2 border-slate-950" />}
                </div>

                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleNotificationClick(n)}>
                  <p className={`text-xs text-slate-200 break-words leading-relaxed ${!n.isRead && 'font-semibold text-white'}`}>
                    {n.content}
                  </p>
                  <span className="text-[9px] text-slate-550 block mt-1.5">
                    {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleDeleteNotification(n.id)}
                    className="p-1 text-slate-600 hover:text-rose-400 hover:bg-slate-900 rounded"
                    title="Usuń powiadomienie"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
