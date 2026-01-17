import React, { useState, useEffect } from 'react';
import { User, AuthState } from './types';
import * as Storage from './services/storage';
import { syncTime } from './services/totpService';
import { AdminPanel } from './components/AdminPanel';
import { UserPanel } from './components/UserPanel';
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    currentUser: null,
  });
  const [usernameInput, setUsernameInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Kích hoạt đồng bộ thời gian khi app chạy lần đầu
  useEffect(() => {
    syncTime();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      // Find user (Async operation with GitHub)
      const user = await Storage.findUserByUsername(usernameInput.trim());

      if (user) {
        setAuth({
          isAuthenticated: true,
          currentUser: user,
        });
      } else {
        setError('User not found. Contact administrator.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error. Please check configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setAuth({
      isAuthenticated: false,
      currentUser: null,
    });
    setUsernameInput('');
  };

  if (auth.isAuthenticated && auth.currentUser) {
    if (auth.currentUser.isAdmin) {
      return <AdminPanel onLogout={handleLogout} />;
    }
    return <UserPanel user={auth.currentUser} onLogout={handleLogout} />;
  }

  // Login Screen
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px]" />
      </div>

      <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 p-8 rounded-3xl shadow-2xl relative z-10">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4 transform rotate-3">
             <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Welcome Back</h1>
          <p className="text-slate-400 text-sm">Secure Authentication Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 ml-1 uppercase tracking-wider">Username</label>
            <div className="relative group">
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Enter your username"
                disabled={isLoading}
                className="w-full bg-slate-900/80 border border-slate-600 text-slate-100 rounded-xl px-5 py-4 pl-12 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all group-hover:border-slate-500 placeholder:text-slate-600 disabled:opacity-50"
              />
              <Lock className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-indigo-400" />
            </div>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm p-3 rounded-lg text-center animate-pulse">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Connecting...' : 'Access Dashboard'}
            {!isLoading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <div className="mt-8 text-center">
           <p className="text-slate-500 text-xs">
             Restricted Access System. <br /> Only authorized personnel may proceed.
           </p>
        </div>
      </div>
    </div>
  );
};

export default App;