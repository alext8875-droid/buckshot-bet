import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore, GameState, PlayerState, Item } from '../stores/useGameStore';
import { useAuthStore } from '../stores/useAuthStore';
import api from '../lib/api';

const ITEM_LABELS: Record<Item, string> = {
  magnifier: '🔍 Magnifier',
  cigarettes: '🚬 Cigarettes',
  handcuffs: '🔒 Handcuffs',
  beer: '🍺 Beer',
  inverter: '🔄 Inverter',
};

const ITEM_DESCRIPTIONS: Record<Item, string> = {
  magnifier: 'Peek at next shell',
  cigarettes: '+1 HP (up to max)',
  handcuffs: 'Skip opponent next turn',
  beer: 'Eject top shell',
  inverter: 'Flip next shell',
};

function HPHearts({ hp, maxHp }: { hp: number; maxHp: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: maxHp }).map((_, i) => (
        <span
          key={i}
          className={`text-lg transition-all duration-300 ${i < hp ? 'hp-heart' : 'hp-empty'}`}
        >
          ❤️
        </span>
      ))}
    </div>
  );
}

function ShellRack({
  shellCount,
  roundShellTotal,
  totalVisible,
  revealedShell,
  isCurrentPlayer,
}: {
  shellCount: { live: number; blank: number };
  roundShellTotal: number;
  totalVisible: number;
  revealedShell: 'live' | 'blank' | null;
  isCurrentPlayer: boolean;
}) {
  const shells = Array.from({ length: totalVisible }).map((_, i) => {
    if (i === 0 && revealedShell && isCurrentPlayer) {
      return revealedShell === 'live' ? '🔴' : '🟢';
    }
    return '❓';
  });

  const isRoundStart = shellCount.live + shellCount.blank === roundShellTotal;

  return (
    <div className="flex flex-col items-center gap-2">
      {isRoundStart && (
        <div className="text-sm text-gray-400 font-medium">
          Shells: <span className="text-red-400">{shellCount.live} live</span>
          {' · '}
          <span className="text-green-400">{shellCount.blank} blank</span>
        </div>
      )}
      <div className="flex flex-wrap gap-1 justify-center">
        {shells.map((shell, i) => (
          <span key={i} className="text-2xl" title={i === 0 && revealedShell ? `Next: ${revealedShell}` : 'Unknown'}>
            {shell}
          </span>
        ))}
      </div>
    </div>
  );
}

function PlayerPanel({
  player,
  isCurrentTurn,
  isMe,
  label,
  animating,
}: {
  player: PlayerState;
  isCurrentTurn: boolean;
  isMe: boolean;
  label: string;
  animating: boolean;
}) {
  return (
    <div
      className={`card flex-1 space-y-3 transition-all duration-300 ${
        isCurrentTurn
          ? 'border-red-600 shadow-lg shadow-red-900/30'
          : 'border-gray-800 opacity-80'
      } ${animating ? 'animate-damage' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-gray-500">{label}</span>
        {isCurrentTurn && (
          <span className="text-xs bg-red-700 text-white px-2 py-0.5 rounded-full animate-pulse">
            TURN
          </span>
        )}
        {player.handcuffed && (
          <span className="text-xs bg-yellow-800 text-yellow-200 px-2 py-0.5 rounded-full">
            🔒 Cuffed
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-4xl">{player.avatar}</span>
        <div>
          <div className="font-bold">
            {player.username} {isMe && <span className="text-xs text-gray-500">(You)</span>}
          </div>
          <HPHearts hp={player.hp} maxHp={player.maxHp} />
        </div>
      </div>

      {/* Items */}
      {player.items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {player.items.map((item, i) => (
            <span
              key={i}
              className="text-lg"
              title={ITEM_LABELS[item]}
            >
              {ITEM_LABELS[item].split(' ')[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionLog({ logs }: { logs: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = 0;
    }
  }, [logs]);

  return (
    <div
      ref={ref}
      className="card h-40 overflow-y-auto space-y-1 bg-gray-950"
    >
      <h3 className="text-xs font-semibold text-gray-500 uppercase sticky top-0 bg-gray-950 pb-1">
        Action Log
      </h3>
      {logs.length === 0 ? (
        <div className="text-gray-600 text-sm">No actions yet...</div>
      ) : (
        logs.map((log, i) => (
          <div
            key={i}
            className={`text-sm ${i === 0 ? 'text-white' : 'text-gray-500'}`}
          >
            {log}
          </div>
        ))
      )}
    </div>
  );
}

function GameOverModal({
  gameOver,
  pot,
  myId,
  onLeave,
}: {
  gameOver: { winner: { id: string; username: string; avatar: string | null }; loser: { id: string; username: string; avatar: string | null }; pot: number };
  pot: number;
  myId: string;
  onLeave: () => void;
}) {
  const iWon = gameOver.winner.id === myId;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`card max-w-sm w-full text-center space-y-5 ${iWon ? 'border-green-700' : 'border-red-900'}`}>
        <div className="text-6xl">{iWon ? '🏆' : '💀'}</div>
        <h2 className={`text-3xl font-bold ${iWon ? 'text-green-400' : 'text-red-400'}`}>
          {iWon ? 'You Won!' : 'You Lost'}
        </h2>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-lg">
            <span>{gameOver.winner.avatar || '🎭'}</span>
            <span className="font-semibold text-green-400">{gameOver.winner.username}</span>
            <span className="text-gray-500">beat</span>
            <span>{gameOver.loser.avatar || '🎭'}</span>
            <span className="font-semibold text-red-400">{gameOver.loser.username}</span>
          </div>

          <div className="text-2xl font-bold text-yellow-400">
            🪙 {pot} coins
          </div>
          <div className="text-sm text-gray-400">
            {iWon ? `+${pot} coins added to your wallet` : `Better luck next time`}
          </div>
        </div>

        <button onClick={onLeave} className="btn-ghost w-full py-3">
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default function GamePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, refreshMe } = useAuthStore();
  const {
    gameState,
    actionLog,
    gameOver,
    revealedShell,
    joinGameRoom,
    sendAction,
    sendItem,
    setupListeners,
    clearGame,
  } = useGameStore();

  const [loading, setLoading] = useState(true);
  const [animatingPlayer, setAnimatingPlayer] = useState<number | null>(null);
  const [showItemMenu, setShowItemMenu] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const cleanup = setupListeners(() => {});

    joinGameRoom(sessionId);

    // Also fetch current state via REST in case socket reconnect
    api.get(`/games/history`).catch(() => {});

    setLoading(false);

    return () => {
      cleanup();
    };
  }, [sessionId]);

  // Trigger animation on action
  useEffect(() => {
    if (!gameState?.lastAction) return;
    const action = gameState.lastAction;
    if (action.type === 'shoot_self' || action.type === 'shoot_opponent') {
      const targetIndex =
        action.type === 'shoot_self'
          ? gameState.players.findIndex((p) => p.id === action.actorId)
          : gameState.players.findIndex((p) => p.id === action.targetId);
      if (targetIndex !== -1 && action.damage && action.damage > 0) {
        setAnimatingPlayer(targetIndex);
        setTimeout(() => setAnimatingPlayer(null), 600);
      }
    }
  }, [gameState?.lastAction]);

  useEffect(() => {
    if (gameOver) {
      refreshMe();
    }
  }, [gameOver]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading game...</div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <div className="text-3xl animate-pulse">🔫</div>
        <div className="text-gray-400 text-center">
          Waiting for opponent to join...
          <br />
          <span className="text-sm text-gray-600">Share your game invite!</span>
        </div>
        <button onClick={() => navigate('/')} className="btn-ghost mt-4">
          Back to Home
        </button>
      </div>
    );
  }

  const myId = user?.id ?? '';
  const myIndex = gameState.players.findIndex((p) => p.id === myId);
  const opponentIndex = myIndex === 0 ? 1 : 0;
  const isMyTurn = gameState.currentPlayerIndex === myIndex;
  const me: PlayerState | undefined = myIndex !== -1 ? gameState.players[myIndex] : undefined;
  const opponent: PlayerState | undefined = gameState.players[opponentIndex];
  const totalShells = gameState.shellCount.live + gameState.shellCount.blank;

  function handleShootSelf() {
    if (!sessionId || !myId || !isMyTurn) return;
    sendAction(sessionId, 'shoot_self', myId);
    setShowItemMenu(false);
  }

  function handleShootOpponent() {
    if (!sessionId || !myId || !isMyTurn) return;
    sendAction(sessionId, 'shoot_opponent', myId);
    setShowItemMenu(false);
  }

  function handleUseItem(item: Item) {
    if (!sessionId || !myId || !isMyTurn) return;
    sendItem(sessionId, item, myId);
    setShowItemMenu(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="text-gray-500 hover:text-white transition-colors text-sm"
        >
          ← Home
        </button>
        <div className="flex items-center gap-2">
          <span className="text-red-500 text-lg">🔫</span>
          <span className="font-bold">Round {gameState.round}</span>
        </div>
        <div className="text-sm text-gray-500">
          🪙 {gameState.players[0] ? (gameState as GameState & { betAmount?: number }).betAmount ?? '' : ''} pot
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Shotgun / Shell display */}
        <div className="card bg-gray-900/80 border-gray-700 py-4">
          <div className="flex flex-col items-center gap-3">
            <div className="text-4xl">🔫</div>
            <ShellRack
              shellCount={gameState.shellCount}
              roundShellTotal={gameState.roundShellTotal}
              totalVisible={totalShells}
              revealedShell={revealedShell}
              isCurrentPlayer={isMyTurn}
            />
          </div>
        </div>

        {/* Player panels */}
        <div className="flex gap-3">
          {me && (
            <PlayerPanel
              player={me}
              isCurrentTurn={isMyTurn}
              isMe={true}
              label="You"
              animating={animatingPlayer === myIndex}
            />
          )}
          {opponent && (
            <PlayerPanel
              player={opponent}
              isCurrentTurn={!isMyTurn}
              isMe={false}
              label="Opponent"
              animating={animatingPlayer === opponentIndex}
            />
          )}
        </div>

        {/* Turn indicator */}
        <div className={`text-center text-sm font-semibold ${isMyTurn ? 'text-red-400' : 'text-gray-500'}`}>
          {isMyTurn ? '🎯 Your turn — choose your action' : `⏳ Waiting for ${opponent?.username}...`}
        </div>

        {/* Action buttons */}
        {isMyTurn && gameState.phase === 'shooting' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleShootSelf}
                className="btn-ghost py-4 text-lg border border-gray-600 hover:border-yellow-600 hover:bg-yellow-900/20 transition-all"
              >
                <div>🔫 Shoot Self</div>
                <div className="text-xs text-gray-500 mt-1">Blank = go again</div>
              </button>
              <button
                onClick={handleShootOpponent}
                className="btn-danger py-4 text-lg"
              >
                <div>🎯 Shoot Opponent</div>
                <div className="text-xs text-red-300 mt-1">Live = -1 HP</div>
              </button>
            </div>

            {/* Items */}
            {me && me.items.length > 0 && (
              <div>
                <button
                  onClick={() => setShowItemMenu((v) => !v)}
                  className="btn-primary w-full py-2.5"
                >
                  🎒 Use Item ({me.items.length})
                </button>

                {showItemMenu && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {me.items.map((item, i) => (
                      <button
                        key={`${item}-${i}`}
                        onClick={() => handleUseItem(item)}
                        className="card text-left hover:border-gray-600 transition-colors cursor-pointer"
                      >
                        <div className="font-medium text-sm">{ITEM_LABELS[item]}</div>
                        <div className="text-xs text-gray-500">{ITEM_DESCRIPTIONS[item]}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action log */}
        <ActionLog logs={actionLog} />
      </div>

      {/* Game over modal */}
      {gameOver && (
        <GameOverModal
          gameOver={gameOver}
          pot={gameOver.pot}
          myId={myId}
          onLeave={() => {
            clearGame();
            navigate('/');
          }}
        />
      )}
    </div>
  );
}
