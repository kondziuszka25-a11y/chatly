import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import { MessageCircle } from 'lucide-react';

const AppContent = () => {
  const { user, token, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('login');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="p-4 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-2xl shadow-xl shadow-indigo-500/20 mb-4 animate-bounce">
          <MessageCircle size={32} className="text-white" />
        </div>
        <p className="text-sm font-medium tracking-wide animate-pulse">Inicjalizacja sesji...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full h-full bg-slate-950">
        {currentPage === 'login' ? (
          <Login onNavigate={setCurrentPage} />
        ) : (
          <Register onNavigate={setCurrentPage} />
        )}
      </div>
    );
  }

  return (
    <SocketProvider token={token}>
      <Dashboard />
    </SocketProvider>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
