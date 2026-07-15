import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children, token }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Map());

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Connect to backend server
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const newSocket = io(backendUrl, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
      withCredentials: true
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Listen for global user status updates
    newSocket.on('user_status_changed', ({ userId, status, lastActive }) => {
      setOnlineUsers(prev => {
        const next = new Map(prev);
        next.set(userId, { status, lastActive });
        return next;
      });
    });

    setSocket(newSocket);

    // Clean up connection on unmount
    return () => {
      newSocket.off('user_status_changed');
      newSocket.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, setOnlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};
