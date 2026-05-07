import { useState, useEffect } from 'react';
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

interface FriendRequest {
  id: string;
  senderId: string;
  sender: {
    id: string;
    username: string;
    avatar: string | null;
    phone: string;
  };
  createdAt: string;
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [friendsRes, requestsRes] = await Promise.all([
      api.get('/friends'),
      api.get('/friends/requests'),
    ]);
    setFriends(friendsRes.data);
    setRequests(requestsRes.data);
  }

  async function handleAddFriend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await api.post('/friends/request', { phone: phoneInput });
      setMessage('Friend request sent!');
      setPhoneInput('');
      await loadAll();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(requestId: string) {
    try {
      await api.post(`/friends/accept/${requestId}`);
      await loadAll();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e.response?.data?.error || 'Failed to accept');
    }
  }

  async function handleRemoveFriend(friendshipId: string) {
    if (!confirm('Remove this friend?')) return;
    try {
      await api.delete(`/friends/${friendshipId}`);
      setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Friends</h1>

      {/* Add friend */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-300">Add Friend by Phone</h2>
        <form onSubmit={handleAddFriend} className="flex gap-2">
          <input
            type="tel"
            className="input flex-1"
            placeholder="+12345678900"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
          />
          <button
            type="submit"
            className="btn-ghost px-4"
            disabled={loading || !phoneInput}
          >
            {loading ? '...' : 'Add'}
          </button>
        </form>
        {message && <p className="text-green-400 text-sm">{message}</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('friends')}
          className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
            tab === 'friends' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Friends ({friends.length})
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`flex-1 py-2 rounded-lg font-medium transition-colors relative ${
            tab === 'requests' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Requests
          {requests.length > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 bg-red-600 rounded-full text-xs flex items-center justify-center">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* Friends list */}
      {tab === 'friends' && (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">
              <div className="text-3xl mb-2">👥</div>
              <div>No friends yet. Add someone by phone!</div>
            </div>
          ) : (
            friends.map((f) => (
              <div
                key={f.friendshipId}
                className="card flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{f.friend.avatar || '🎭'}</span>
                  <div>
                    <div className="font-medium">{f.friend.username}</div>
                    <div className="text-xs text-gray-500">{f.friend.phone}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFriend(f.friendshipId)}
                  className="text-sm text-gray-600 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Requests list */}
      {tab === 'requests' && (
        <div className="space-y-2">
          {requests.length === 0 ? (
            <div className="card text-center text-gray-500 py-8">
              <div className="text-3xl mb-2">📭</div>
              <div>No pending requests</div>
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="card flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{req.sender.avatar || '🎭'}</span>
                  <div>
                    <div className="font-medium">{req.sender.username}</div>
                    <div className="text-xs text-gray-500">{req.sender.phone}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleAccept(req.id)}
                  className="btn-safe text-sm px-3 py-1.5"
                >
                  Accept
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
