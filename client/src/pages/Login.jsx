import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, Mail, MessageCircle, User } from 'lucide-react';

const Login = ({ onNavigate }) => {
  const { login, requestPasswordReset, confirmPasswordReset } = useAuth();
  
  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password Reset States
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStep, setResetStep] = useState(1); // 1 = request, 2 = confirm
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Wszystkie pola są wymagane');
      return;
    }
    setError('');
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
    }
  };

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');
    if (!resetEmail) {
      setResetError('Podaj adres e-mail');
      return;
    }
    setLoading(true);

    const result = await requestPasswordReset(resetEmail);
    setLoading(false);
    if (result.success) {
      setResetMessage(`Token wygenerowany pomyślnie. Skopiuj go: ${result.resetToken}`);
      setResetToken(result.resetToken); // autofill for dev ease
      setResetStep(2);
    } else {
      setResetError(result.error);
    }
  };

  const handleResetConfirm = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');
    if (!resetToken || !newPassword) {
      setResetError('Token i nowe hasło są wymagane');
      return;
    }
    setLoading(true);

    const result = await confirmPasswordReset(resetToken, newPassword);
    setLoading(false);
    if (result.success) {
      setResetMessage('Hasło zostało pomyślnie zresetowane! Możesz się zalogować.');
      setTimeout(() => {
        setShowReset(false);
        setResetStep(1);
        setResetEmail('');
        setResetToken('');
        setNewPassword('');
        setResetMessage('');
      }, 3000);
    } else {
      setResetError(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/30 animate-pulse">
          <MessageCircle size={36} className="text-white" />
        </div>
        <h2 className="mt-6 text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 to-indigo-300 bg-clip-text text-transparent">
          Witaj w Antigravity Chat
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Zaloguj się na swoje konto, aby kontynuować
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 py-8 px-6 shadow-2xl rounded-3xl sm:px-10">
          
          {!showReset ? (
            // --- LOGIN FORM ---
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Adres E-mail
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent text-sm placeholder-slate-600 text-slate-100 transition-all duration-300"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Hasło
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent text-sm placeholder-slate-600 text-slate-100 transition-all duration-300"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setShowReset(true);
                    setResetStep(1);
                    setResetError('');
                    setResetMessage('');
                  }}
                  className="font-medium text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Zapomniałeś hasła?
                </button>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-600 disabled:opacity-50 transition-all duration-300"
                >
                  {loading ? 'Logowanie...' : 'Zaloguj się'}
                </button>
              </div>

              <div className="mt-6 text-center text-sm">
                <span className="text-slate-400">Nie masz konta? </span>
                <button
                  type="button"
                  onClick={() => onNavigate('register')}
                  className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Zarejestruj się
                </button>
              </div>
            </form>
          ) : (
            // --- PASSWORD RESET FLOW ---
            <div>
              <h3 className="text-lg font-medium text-slate-200 mb-4">
                {resetStep === 1 ? 'Resetowanie hasła' : 'Wprowadź nowe hasło'}
              </h3>

              {resetError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-sm mb-4">
                  {resetError}
                </div>
              )}

              {resetMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-sm mb-4 break-all">
                  {resetMessage}
                </div>
              )}

              {resetStep === 1 ? (
                // Request Reset
                <form className="space-y-4" onSubmit={handleResetRequest}>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      Adres E-mail powiązany z kontem
                    </label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="mt-1 block w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent text-sm text-slate-100"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowReset(false)}
                      className="w-1/2 py-2.5 px-4 border border-slate-800 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-850 hover:text-slate-300 transition-colors"
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-1/2 py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl text-sm font-medium text-white shadow-md disabled:opacity-50 transition-all"
                    >
                      {loading ? 'Wysyłanie...' : 'Wyślij prośbę'}
                    </button>
                  </div>
                </form>
              ) : (
                // Confirm Reset
                <form className="space-y-4" onSubmit={handleResetConfirm}>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      Token resetowania hasła
                    </label>
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      className="mt-1 block w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent text-sm text-slate-100"
                      placeholder="Wklej skopiowany token"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300">
                      Nowe Hasło
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent text-sm text-slate-100"
                      placeholder="Min. 6 znaków"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setResetStep(1)}
                      className="w-1/2 py-2.5 px-4 border border-slate-800 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-850 hover:text-slate-300 transition-colors"
                    >
                      Wstecz
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-1/2 py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl text-sm font-medium text-white shadow-md disabled:opacity-50 transition-all"
                    >
                      {loading ? 'Resetowanie...' : 'Resetuj hasło'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;
