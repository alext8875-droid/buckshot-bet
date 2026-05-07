import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/useAuthStore';
import { useGameStore } from './stores/useGameStore';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import FriendsPage from './pages/FriendsPage';
import WalletPage from './pages/WalletPage';
import GamePage from './pages/GamePage';
import Layout from './components/Layout';
import GameInviteModal from './components/GameInviteModal';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  const { token, refreshMe } = useAuthStore();
  const { joinUserRoom, setupListeners, pendingInvite, setPendingInvite } = useGameStore();

  useEffect(() => {
    if (token) {
      refreshMe();
      joinUserRoom();
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const cleanup = setupListeners((invite) => {
      console.log('[App] Received game invite:', invite);
    });
    return cleanup;
  }, [token]);

  return (
    <>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <HomePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <Layout>
                <FriendsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/wallet"
          element={
            <ProtectedRoute>
              <Layout>
                <WalletPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/game/:sessionId"
          element={
            <ProtectedRoute>
              <GamePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {pendingInvite && (
        <GameInviteModal
          invite={pendingInvite}
          onClose={() => setPendingInvite(null)}
        />
      )}
    </>
  );
}
