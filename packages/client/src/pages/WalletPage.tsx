import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../stores/useAuthStore';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

const TX_ICONS: Record<string, string> = {
  bet_placed: '🎲',
  bet_won: '🏆',
  bet_lost: '💀',
  deposit: '💳',
  bonus: '🎁',
};

const TX_COLORS: Record<string, string> = {
  bet_placed: 'text-yellow-400',
  bet_won: 'text-green-400',
  bet_lost: 'text-red-400',
  deposit: 'text-blue-400',
  bonus: 'text-purple-400',
};

export default function WalletPage() {
  const { wallet, refreshMe } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  async function loadWallet() {
    try {
      setLoading(true);
      const res = await api.get('/wallet');
      setTransactions(res.data.transactions);
      await refreshMe();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function formatAmount(amount: number) {
    if (amount > 0) return `+${amount}`;
    return `${amount}`;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Wallet</h1>

      {/* Balance card */}
      <div className="card bg-gradient-to-br from-yellow-900/20 to-gray-900 border-yellow-800/30 text-center py-8 space-y-2">
        <div className="text-5xl">🪙</div>
        <div className="text-4xl font-bold text-yellow-400">
          {wallet?.coins.toLocaleString() ?? 0}
        </div>
        <div className="text-gray-400">Virtual Coins</div>

        <button
          onClick={() => setShowDepositModal(true)}
          className="btn-ghost mt-4 mx-auto px-8"
        >
          + Add Funds
        </button>
      </div>

      {/* Transactions */}
      <div className="space-y-3">
        <h2 className="font-bold text-gray-300">Transaction History</h2>

        {loading ? (
          <div className="text-center text-gray-500 py-4">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="card text-center text-gray-500 py-8">
            <div className="text-3xl mb-2">📋</div>
            <div>No transactions yet</div>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{TX_ICONS[tx.type] || '💰'}</span>
                  <div>
                    <div className="text-sm font-medium capitalize">
                      {tx.type.replace(/_/g, ' ')}
                    </div>
                    {tx.note && (
                      <div className="text-xs text-gray-500">{tx.note}</div>
                    )}
                    <div className="text-xs text-gray-600">
                      {new Date(tx.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className={`font-bold ${TX_COLORS[tx.type] || 'text-white'}`}>
                  {formatAmount(tx.amount)} 🪙
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deposit stub modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card max-w-sm w-full text-center space-y-4">
            <div className="text-5xl">🚧</div>
            <h2 className="text-xl font-bold">Coming Soon</h2>
            <p className="text-gray-400">
              Real money deposits coming soon. Contact us for early access.
            </p>
            <p className="text-sm text-gray-500">
              For now, enjoy your <span className="text-yellow-400">1,000 free coins</span> welcome bonus!
            </p>
            <button
              onClick={() => setShowDepositModal(false)}
              className="btn-ghost w-full"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
