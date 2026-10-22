import React, { useState, useEffect } from 'react';
import { User, AuthState } from './types';
import * as Storage from './services/storage';
import { DEFAULT_ADMIN } from './constants';
import { syncTime } from './services/totpService';
import { AdminPanel } from './components/AdminPanel';
import { UserPanel } from './components/UserPanel';
import { Lock, ArrowRight, ShieldCheck, AlertTriangle, Home } from 'lucide-react';

// Khớp với "base" trong vite.config.ts
const BASE_PATH = '/chatgpt2faa';

// Đọc tên cổng từ URL: /chatgpt2faa/<ten-admin> (hoặc dự phòng dạng #/<ten-admin>).
// Trả về null nếu đang ở link gốc (cổng của admin gốc).
const parsePortalSlug = (): string | null => {
  let segment = '';
  const path = window.location.pathname;
  const rest = path.startsWith(BASE_PATH) ? path.slice(BASE_PATH.length) : path;
  segment = rest.split('/').filter(Boolean)[0] || '';

  if (!segment && window.location.hash) {
    segment = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)[0] || '';
  }

  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    currentUser: null,
  });
  const [usernameInput, setUsernameInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Trạng thái cổng: 'loading' (đang xác định chủ cổng) | 'ready' | 'invalid' (link sai)
  const [portalState, setPortalState] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [portalSlug, setPortalSlug] = useState<string | null>(null);
  // Chủ cổng khi vào bằng link con; null = cổng chính của admin gốc
  const [portalAdmin, setPortalAdmin] = useState<User | null>(null);

  // Kích hoạt đồng bộ thời gian khi app chạy lần đầu
  useEffect(() => {
    syncTime();
  }, []);

  // Xác định chủ cổng từ URL ngay khi mở trang
  useEffect(() => {
    const slug = parsePortalSlug();
    setPortalSlug(slug);
    if (!slug) {
      setPortalAdmin(null);
      setPortalState('ready');
      return;
    }
    let cancelled = false;
    (async () => {
      const admin = await Storage.findAdminByUsername(slug);
      if (cancelled) return;
      if (admin) {
        setPortalAdmin(admin);
        setPortalState('ready');
      } else {
        setPortalState('invalid');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const input = usernameInput.trim();
      let user: User | null = null;

      if (!portalAdmin && input.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase()) {
        // Ở cổng chính, admin gốc đăng nhập qua hàm cũ để giữ cơ chế tự khôi phục tài khoản
        const found = await Storage.findUserByUsername(input);
        user = found && found.isAdmin ? found : null;
      } else {
        // Trong một cổng: chỉ chấp nhận chủ cổng hoặc user do chủ cổng tạo
        const owner = portalAdmin ?? DEFAULT_ADMIN;
        user = await Storage.findUserInPortal(input, owner);
      }

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
      return <AdminPanel currentUser={auth.currentUser} onLogout={handleLogout} />;
    }
    return <UserPanel user={auth.currentUser} onLogout={handleLogout} />;
  }

  // Đang xác định chủ cổng
  if (portalState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <p className="text-slate-400 text-sm animate-pulse">Đang tải...</p>
      </div>
    );
  }

  // Link cổng không tồn tại (không có admin nào mang tên này)
  if (portalState === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 p-8 rounded-3xl shadow-2xl text-center">
          <div className="w-16 h-16 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Link không hợp lệ</h1>
          <p className="text-slate-400 text-sm mb-6">
            Không có cổng quản trị nào mang tên <span className="text-slate-200 font-medium">"{portalSlug}"</span>.
            Hãy kiểm tra lại đường link admin đã gửi cho bạn.
          </p>
          <a
            href={`${BASE_PATH}/`}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-indigo-500/25 transition-all"
          >
            <Home className="w-5 h-5" /> Tới trang đăng nhập chính
          </a>
        </div>
      </div>
    );
  }

  const isSubPortal = !!portalAdmin && !Storage.isRootAdmin(portalAdmin);

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
          {isSubPortal && (
            <span className="mt-3 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              Cổng của admin: {portalAdmin.username}
            </span>
          )}
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
