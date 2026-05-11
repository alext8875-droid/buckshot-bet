import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import api from '../lib/api';

interface Friend {
  friendshipId: string;
  friend: {
    id: string;
    username: string;
    avatar: string | null;
    phone: string;
  };
}

interface GameHistoryItem {
  sessionId: string;
  result: string | null;
  betAmount: number;
  pot: number;
  status: string;
  winnerId: string | null;
  createdAt: string;
  players: { userId: string; username: string; avatar: string | null; result: string | null }[];
}

const BET_PRESETS = [10, 25, 50, 100, 200];

export default function HomePage() {
  const navigate = useNavigate();
  const { user, wallet, refreshMe } = useAuthStore();
  const { sendInvite } = useGameStore();

  const [showChallenge, setShowChallenge] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [betAmount, setBetAmount] = useState(50);
  const [customBet, setCustomBet] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadHistory();
    if (showChallenge) {
      loadFriends();
    }
  }, [showChallenge]);

  async function loadFriends() {
    try {
      const res = await api.get('/friends');
      setFriends(res.data);
    } catch {
      // ignore
    }
  }

  async function loadHistory() {
    try {
      setLoadingHistory(true);
      const res = await api.get('/games/history');
      setHistory(res.data.slice(0, 5));
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleChallenge() {
    if (!selectedFriend) return;
    try {
      setChallengeLoading(true);
      const res = await api.post('/games/create', {
        betAmount,
        opponentId: selectedFriend.friend.id,
      });
      const sessionId = res.data.session.id;
      sendInvite(sessionId, selectedFriend.friend.id, betAmount);
      await refreshMe();
      setShowChallenge(false);
      navigate(`/game/${sessionId}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error.response?.data?.error || 'Failed to create game');
    } finally {
      setChallengeLoading(false);
    }
  }

  function getResultBadge(item: GameHistoryItem) {
    if (item.status !== 'finished') return <span className="text-yellow-400 text-xs">In Progress</span>;
    if (!item.winnerId) return <span className="text-gray-400 text-xs">No result</span>;
    const won = item.winnerId === user?.id;
    return won
      ? <span className="text-green-400 font-bold text-xs">WON +{item.pot - item.betAmount}</span>
      : <span className="text-red-400 font-bold text-xs">LOST -{item.betAmount}</span>;
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="card bg-gradient-to-br from-gray-900 to-gray-950 border-gray-700">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{user?.avatar || '🎭'}</span>
          <div>
            <h1 className="text-xl font-bold">{user?.username}</h1>
            <div className="flex items-center gap-1.5 text-yellow-400 font-semibold">
              <span>🪙</span>
              <span>{wallet?.coins.toLocaleString() ?? 0} coins</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowChallenge(true)}
          className="card border-red-900/50 hover:border-red-700 transition-colors text-left space-y-2 cursor-pointer"
        >
          <div className="text-3xl">🔫</div>
          <div className="font-bold">Challenge Friend</div>
          <div className="text-sm text-gray-400">Start a game</div>
        </button>

        <button
          onClick={() => navigate('/friends')}
          className="card hover:border-gray-700 transition-colors text-left space-y-2 cursor-pointer"
        >
          <div className="text-3xl">👥</div>
          <div className="font-bold">Friends</div>
          <div className="text-sm text-gray-400">Manage friends</div>
        </button>
      </div>

      {/* Recent games */}
      <div className="space-y-3">
        <h2 className="font-bold text-gray-300">Recent Games</h2>
        {loadingHistory ? (
          <div className="text-gray-500 text-center py-4">Loading...</div>
        ) : history.length === 0 ? (
          <div className="card text-center text-gray-500 py-6">
            <div className="text-3xl mb-2">🎲</div>
            <div>No games yet. Challenge a friend!</div>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((game) => {
              const opponent = game.players.find((p) => p.userId !== user?.id);
              return (
                <div
                  key={game.sessionId}
                  onClick={() => navigate(`/game/${game.sessionId}`)}
                  className="card hover:border-gray-700 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{opponent?.avatar || '🎭'}</span>
                    <div>
                      <div className="font-medium text-sm">{opponent?.username ?? 'Unknown'}</div>
                      <div className="text-xs text-gray-500">
                        🪙 {game.betAmount} each · {new Date(game.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  {getResultBadge(game)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Challenge Modal */}
      {showChallenge && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card max-w-sm w-full space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Challenge a Friend</h2>
              <button
                onClick={() => { setShowChallenge(false); setSelectedFriend(null); setIsCustom(false); setCustomBet(''); }}
                className="text-gray-500 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            {/* Friend picker */}
            <div>
              <label className="text-sm text-gray-400 block mb-2">Select opponent</label>
              {friends.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-4 bg-gray-800 rounded-lg">
                  No friends yet.{' '}
                  <button
                    onClick={() => { setShowChallenge(false); navigate('/friends'); }}
                    className="text-red-400 underline"
                  >
                    Add some!
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {friends.map((f) => (
                    <button
                      key={f.friendshipId}
                      onClick={() => setSelectedFriend(f)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        selectedFriend?.friendshipId === f.friendshipId
                          ? 'bg-red-900/40 border border-red-700'
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      <span className="text-xl">{f.friend.avatar || '🎭'}</span>
                      <span className="font-medium">{f.friend.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bet amount */}
            <div>
              <label className="text-sm text-gray-400 block mb-2">
                Bet Amount: <span className="text-yellow-400 font-bold">🪙 {betAmount}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {BET_PRESETS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => { setBetAmount(amount); setIsCustom(false); setCustomBet(''); }}
                    className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                      !isCustom && betAmount === amount
                        ? 'bg-red-700 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
                <button
                  onClick={() => { setIsCustom(true); setCustomBet(String(betAmount)); }}
                  className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isCustom
                      ? 'bg-red-700 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Custom
                </button>
              </div>
              {isCustom && (
                <input
                  type="number"
                  min={10}
                  max={10000}
                  value={customBet}
                  onChange={(e) => {
                    setCustomBet(e.target.value);
                    const parsed = parseInt(e.target.value, 10);
                    if (!isNaN(parsed) && parsed >= 10) setBetAmount(parsed);
                  }}
                  placeholder="Enter amount (min 10)"
                  className="input mt-2"
                  autoFocus
                />
              )}
              {wallet && betAmount > wallet.coins && (
                <p className="text-red-400 text-xs mt-2">Insufficient coins (you have {wallet.coins})</p>
              )}
            </div>

            <button
              onClick={handleChallenge}
              disabled={
                !selectedFriend ||
                challengeLoading ||
                (wallet ? betAmount > wallet.coins : false)
              }
              className="btn-danger w-full py-3 text-lg"
            >
              {challengeLoading ? 'Sending...' : `Challenge! 🔫`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
