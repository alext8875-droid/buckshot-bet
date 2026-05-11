import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore, PlayerState, Item } from '../stores/useGameStore';
import { useAuthStore } from '../stores/useAuthStore';
import api from '../lib/api';
import { playLiveShot, playBlankShot, playItem, playGameOver, playReload } from '../lib/sounds';

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
          <span
            key={i}
            className={`text-2xl ${i === 0 && revealedShell && isCurrentPlayer ? 'animate-shell-reveal' : ''}`}
            title={i === 0 && revealedShell && isCurrentPlayer ? `Next: ${revealedShell}` : 'Unknown'}
          >
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
  damagePulse,
  healPulse,
}: {
  player: PlayerState;
  isCurrentTurn: boolean;
  isMe: boolean;
  label: string;
  damagePulse: boolean;
  healPulse: boolean;
}) {
  return (
    <div
      className={`card flex-1 space-y-3 transition-all duration-300 ${
        isCurrentTurn
          ? 'border-red-600 shadow-lg shadow-red-900/30'
          : 'border-gray-800 opacity-80'
      } ${damagePulse ? 'animate-damage' : ''} ${healPulse ? 'animate-heal' : ''}`}
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

      {player.items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {player.items.map((item, i) => (
            <span key={i} className="text-lg" title={ITEM_LABELS[item]}>
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
    if (ref.current) ref.current.scrollTop = 0;
  }, [logs]);

  return (
    <div ref={ref} className="card h-40 overflow-y-auto space-y-1 bg-gray-950">
      <h3 className="text-xs font-semibold text-gray-500 uppercase sticky top-0 bg-gray-950 pb-1">
        Action Log
      </h3>
      {logs.length === 0 ? (
        <div className="text-gray-600 text-sm">No actions yet...</div>
      ) : (
        logs.map((log, i) => (
          <div key={i} className={`text-sm ${i === 0 ? 'text-white' : 'text-gray-500'}`}>
            {log}
          </div>
        ))
      )}
    </div>
  );
}

function GameOverModal({
  gameOver,
  myId,
  betAmount,
  onLeave,
  onRematch,
  rematchLoading,
}: {
  gameOver: { winner: { id: string; username: string; avatar: string | null }; loser: { id: string; username: string; avatar: string | null }; pot: number };
  myId: string;
  betAmount: number | null;
  onLeave: () => void;
  onRematch: () => void;
  rematchLoading: boolean;
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
          <div className="text-2xl font-bold text-yellow-400">🪙 {gameOver.pot} coins</div>
          <div className="text-sm text-gray-400">
            {iWon ? `+${gameOver.pot - (betAmount ?? 0)} net coins` : 'Better luck next time'}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onLeave} className="btn-ghost flex-1 py-3">
            Home
          </button>
          {betAmount && (
            <button
              onClick={onRematch}
              disabled={rematchLoading}
              className="btn-danger flex-1 py-3 text-lg"
            >
              {rematchLoading ? 'Creating...' : '🔫 Rematch'}
            </button>
          )}
        </div>
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
    pot,
    betAmount,
    sendInvite,
    joinGameRoom,
    sendAction,
    sendItem,
    setupListeners,
    clearGame,
  } = useGameStore();

  const [loading, setLoading] = useState(true);
  const [damagePulse, setDamagePulse] = useState<number | null>(null);
  const [healPulse, setHealPulse] = useState<number | null>(null);
  const [gunFiring, setGunFiring] = useState(false);
  const [showItemMenu, setShowItemMenu] = useState(false);
  const [rematchLoading, setRematchLoading] = useState(false);
  const prevRound = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const cleanup = setupListeners(() => {});
    joinGameRoom(sessionId);
    setLoading(false);
    return () => cleanup();
  }, [sessionId]);

  // Sound + animation on action
  useEffect(() => {
    if (!gameState?.lastAction) return;
    const action = gameState.lastAction;

    if (action.type === 'shoot_self' || action.type === 'shoot_opponent') {
      const isLive = action.shell === 'live';
      if (isLive) playLiveShot(); else playBlankShot();

      setGunFiring(true);
      setTimeout(() => setGunFiring(false), 400);

      if (isLive && action.damage && action.damage > 0) {
        const targetIndex =
          action.type === 'shoot_self'
            ? gameState.players.findIndex((p) => p.id === action.actorId)
            : gameState.players.findIndex((p) => p.id === action.targetId);
        if (targetIndex !== -1) {
          setDamagePulse(targetIndex);
          setTimeout(() => setDamagePulse(null), 600);
        }
      }
    } else if (action.type === 'use_item' && action.item) {
      playItem(action.item);
      if (action.item === 'cigarettes') {
        const actorIndex = gameState.players.findIndex((p) => p.id === action.actorId);
        if (actorIndex !== -1) {
          setHealPulse(actorIndex);
          setTimeout(() => setHealPulse(null), 600);
        }
      }
    }
  }, [gameState?.lastAction]);

  // Reload sound when round advances
  useEffect(() => {
    if (!gameState) return;
    if (prevRound.current !== null && gameState.round > prevRound.current) {
      playReload();
    }
    prevRound.current = gameState.round;
  }, [gameState?.round]);

  // Game over sound
  useEffect(() => {
    if (gameOver) {
      playGameOver(gameOver.winner.id === (user?.id ?? ''));
      refreshMe();
    }
  }, [gameOver]);

  async function handleRematch() {
    if (!gameOver || !betAmount || !sessionId) return;
    const opponentId = gameOver.winner.id === user?.id ? gameOver.loser.id : gameOver.winner.id;
    try {
      setRematchLoading(true);
      const res = await api.post('/games/create', { betAmount, opponentId });
      const newSessionId = res.data.session.id;
      sendInvite(newSessionId, opponentId, betAmount);
      await refreshMe();
      clearGame();
      navigate(`/game/${newSessionId}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      alert(error.response?.data?.error || 'Failed to create rematch');
      setRematchLoading(false);
    }
  }

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
        <div className="text-sm text-yellow-400 font-semibold">
          {pot ? `🪙 ${pot} pot` : ''}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Shotgun display */}
        <div className="card bg-gray-900/80 border-gray-700 py-4">
          <div className="flex flex-col items-center gap-3">
            <div className={`text-4xl ${gunFiring ? 'animate-gun-recoil' : ''}`}>🔫</div>
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
              damagePulse={damagePulse === myIndex}
              healPulse={healPulse === myIndex}
            />
          )}
          {opponent && (
            <PlayerPanel
              player={opponent}
              isCurrentTurn={!isMyTurn}
              isMe={false}
              label="Opponent"
              damagePulse={damagePulse === opponentIndex}
              healPulse={healPulse === opponentIndex}
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

        <ActionLog logs={actionLog} />
      </div>

      {gameOver && (
        <GameOverModal
          gameOver={gameOver}
          myId={myId}
          betAmount={betAmount}
          onLeave={() => { clearGame(); navigate('/'); }}
          onRematch={handleRematch}
          rematchLoading={rematchLoading}
        />
      )}
    </div>
  );
}
