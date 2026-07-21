import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get('/auth/me');
        setUser(response.data.user);
      } catch (error) {
        console.error('Session verification failed:', error);
        // Clear session only on explicit 401/403 unauthorized errors
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          setUser(null);
          setToken(null);
          localStorage.removeItem('token');
        }
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user: loggedUser, token: authToken } = response.data;
      
      setUser(loggedUser);
      setToken(authToken);
      localStorage.setItem('token', authToken);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Logowanie nie powiodło się.'
      };
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await api.post('/auth/register', { username, email, password });
      const { user: registeredUser, token: authToken } = response.data;
      
      setUser(registeredUser);
      setToken(authToken);
      localStorage.setItem('token', authToken);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Rejestracja nie powiodła się.'
      };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error on server:', error);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
    }
  };

  const updateProfile = async (username, email, avatarFile) => {
    try {
      const formData = new FormData();
      if (username) formData.append('username', username);
      if (email) formData.append('email', email);
      if (avatarFile) formData.append('avatar', avatarFile);

      const response = await api.put('/users/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Nie udało się zaktualizować profilu.'
      };
    }
  };

  const requestPasswordReset = async (email) => {
    try {
      const response = await api.post('/auth/reset-password-request', { email });
      return { success: true, resetToken: response.data.resetToken };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Nie udało się wysłać prośby o reset haseł.'
      };
    }
  };

  const confirmPasswordReset = async (tokenVal, newPassword) => {
    try {
      await api.post('/auth/reset-password-confirm', { token: tokenVal, newPassword });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Nie udało się zresetować hasła.'
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        updateProfile,
        requestPasswordReset,
        confirmPasswordReset
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
