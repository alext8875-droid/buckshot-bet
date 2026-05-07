import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { GameInvite } from '../stores/useGameStore';
import { useAuthStore } from '../stores/useAuthStore';

interface Props {
  invite: GameInvite;
  onClose: () => void;
}

export default function GameInviteModal({ invite, onClose }: Props) {
  const navigate = useNavigate();
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    try {
      setLoading(true);
      await api.post(`/games/${invite.sessionId}/join`);
      await refreshMe();
      onClose();
      navigate(`/game/${invite.sessionId}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error.response?.data?.error || 'Failed to join game');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card max-w-sm w-full border-yellow-600/50 shadow-2xl shadow-red-900/20">
        <div className="text-center space-y-4">
          <div className="text-5xl animate-bounce">🔫</div>
          <h2 className="text-xl font-bold">Challenge Received!</h2>

          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-lg">
              <span>{invite.from.avatar || '🎭'}</span>
              <span className="font-semibold">{invite.from.username}</span>
            </div>
            <p className="text-gray-400 text-sm">is challenging you to Buckshot Roulette</p>
            <div className="flex items-center justify-center gap-1.5 text-yellow-400 font-bold text-lg">
              <span>🪙</span>
              <span>{invite.betAmount} coins</span>
            </div>
          </div>

          <p className="text-gray-500 text-sm">Do you have the nerve to face them?</p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn-ghost flex-1"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              disabled={loading}
              className="btn-danger flex-1 text-lg"
            >
              {loading ? 'Joining...' : 'Accept 🔫'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
