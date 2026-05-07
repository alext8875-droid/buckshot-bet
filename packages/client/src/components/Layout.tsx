import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, wallet, logout } = useAuthStore();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/friends', label: 'Friends', icon: '👥' },
    { path: '/wallet', label: 'Wallet', icon: '💰' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔫</span>
          <span className="font-bold text-lg tracking-tight">Buckshot Bet</span>
        </div>

        <div className="flex items-center gap-4">
          {wallet && (
            <Link
              to="/wallet"
              className="flex items-center gap-1.5 bg-gray-800 rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-gray-700 transition-colors"
            >
              <span>🪙</span>
              <span className="text-yellow-400">{wallet.coins.toLocaleString()}</span>
            </Link>
          )}

          {user && (
            <div className="flex items-center gap-2">
              <span className="text-xl">{user.avatar || '🎭'}</span>
              <span className="text-sm text-gray-400 hidden sm:block">{user.username}</span>
            </div>
          )}

          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-red-400 transition-colors"
          >
            Out
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 container mx-auto max-w-2xl px-4 py-6">{children}</main>

      {/* Bottom nav */}
      <nav className="bg-gray-900 border-t border-gray-800 px-4 py-2 flex justify-around sticky bottom-0">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-1 px-4 py-1 rounded-lg transition-colors ${
              location.pathname === item.path
                ? 'text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
