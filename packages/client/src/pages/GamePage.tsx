import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { useGameStore, PlayerState, Item, Shell } from '../stores/useGameStore';
import { useAuthStore } from '../stores/useAuthStore';
import api from '../lib/api';
import { playLiveShot, playBlankShot, playItem, playGameOver, playReload } from '../lib/sounds';
import GameScene from '../components/game3d/GameScene';

// ── HP pips ───────────────────────────────────────────────────────────────────

function HPPips({ hp, maxHp }: { hp: number; maxHp: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: maxHp }).map((_, i) => (
        <span
          key={i}
          className="font-vt text-2xl leading-none"
          style={{ color: i < hp ? '#ad5437' : '#1e1208' }}
        >
          {i < hp ? '◆' : '◇'}
        </span>
      ))}
    </div>
  );
}

// ── Player info overlay ───────────────────────────────────────────────────────

function PlayerOverlay({
  player,
  isCurrentTurn,
  pulse,
}: {
  player: PlayerState;
  isCurrentTurn: boolean;
  pulse: boolean;
}) {
  return (
    <div
      className={`inline-flex flex-col gap-1 rounded-xl px-3 py-2 transition-all duration-300 ${
        pulse ? 'animate-damage' : ''
      }`}
      style={{
        background: isCurrentTurn ? 'rgba(90,13,13,0.3)' : 'rgba(8,4,2,0.55)',
        border: `1px solid ${isCurrentTurn ? '#5a1a1a' : '#1e0e08'}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="font-cinzel font-semibold text-sm tracking-wider"
          style={{ color: isCurrentTurn ? '#ebdec7' : '#7a6050' }}
        >
          {player.username.toUpperCase()}
        </span>
        {player.handcuffed && (
          <span
            className="font-cinzel text-xs tracking-widest"
            style={{ color: '#d69700' }}
          >
            CUFFED
          </span>
        )}
        {isCurrentTurn && (
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#8b0000' }}
          />
        )}
      </div>
      <HPPips hp={player.hp} maxHp={player.maxHp} />
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function ActionToast({
  toast,
}: {
  toast: { text: string; variant: string; id: number } | null;
}) {
  if (!toast) return null;
  const colors: Record<string, { bg: string; border: string; color: string }> = {
    live:  { bg: '#3a0000', border: '#6b0000', color: '#ebdec7' },
    blank: { bg: '#001a00', border: '#1a5a1a', color: '#a0d0a0' },
    heal:  { bg: '#001500', border: '#1a4a1a', color: '#90cc90' },
    item:  { bg: '#1a0e06', border: '#4a2810', color: '#ebdec7' },
  };
  const c = colors[toast.variant] ?? colors.item;
  return (
    <div
      key={toast.id}
      className="fixed z-30 pointer-events-none font-cinzel font-semibold text-sm tracking-widest whitespace-nowrap rounded-xl px-6 py-3 animate-toast-pop"
      style={{
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
      }}
    >
      {toast.text}
    </div>
  );
}

// ── Game over modal ───────────────────────────────────────────────────────────

function GameOverModal({
  gameOver, myId, betAmount, onLeave, onRematch, rematchLoading,
}: {
  gameOver: {
    winner: { id: string; username: string; avatar: string | null };
    loser:  { id: string; username: string; avatar: string | null };
    pot:    number;
  };
  myId: string;
  betAmount: number | null;
  onLeave: () => void;
  onRematch: () => void;
  rematchLoading: boolean;
}) {
  const iWon = gameOver.winner.id === myId;
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(4,2,1,0.94)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="max-w-sm w-full text-center space-y-6 rounded-2xl p-8"
        style={{
          background: '#0c0704',
          border: `1px solid ${iWon ? '#2e4a18' : '#5a0d0d'}`,
        }}
      >
        <h2
          className="font-cinzel text-4xl font-bold tracking-widest"
          style={{ color: iWon ? '#6aaa30' : '#c03030' }}
        >
          {iWon ? 'VICTORY' : 'DEFEATED'}
        </h2>

        <div className="space-y-3">
          <div className="font-cinzel text-sm tracking-wider" style={{ color: '#7a6050' }}>
            <span style={{ color: '#a0d080' }}>{gameOver.winner.username.toUpperCase()}</span>
            <span> DEFEATED </span>
            <span style={{ color: '#c05050' }}>{gameOver.loser.username.toUpperCase()}</span>
          </div>
          <p className="font-vt text-5xl" style={{ color: '#d69700' }}>
            {gameOver.pot} COINS
          </p>
          <p className="font-cinzel text-xs tracking-widest" style={{ color: '#5a4030' }}>
            {iWon
              ? `+${gameOver.pot - (betAmount ?? 0)} NET`
              : 'BETTER LUCK NEXT TIME'}
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onLeave} className="btn-ghost flex-1 py-3 tracking-widest text-xs">
            HOME
          </button>
          {betAmount && (
            <button
              onClick={onRematch}
              disabled={rematchLoading}
              className="btn-danger flex-1 py-3 tracking-widest text-xs"
            >
              {rematchLoading ? 'CREATING...' : 'REMATCH'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GamePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate      = useNavigate();
  const { user, refreshMe } = useAuthStore();
  const {
    gameState, gameOver, revealedShell, pot, betAmount,
    sendInvite, joinGameRoom, sendAction, sendItem, setupListeners, clearGame,
  } = useGameStore();

  const [loading, setLoading]             = useState(true);
  const [damagePulse, setDamagePulse]     = useState<number | null>(null);
  const [firingTime, setFiringTime]       = useState(0);
  const [firedShell, setFiredShell]       = useState<Shell | null>(null);
  const [rematchLoading, setRematchLoading] = useState(false);
  const [toast, setToast]                 =
    useState<{ text: string; variant: string; id: number } | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRound  = useRef<number | null>(null);

  function showToast(text: string, variant: 'live' | 'blank' | 'item' | 'heal') {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, variant, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }

  useEffect(() => {
    if (!sessionId) return;
    const cleanup = setupListeners(() => {});
    joinGameRoom(sessionId);
    setLoading(false);
    return () => cleanup();
  }, [sessionId]);

  useEffect(() => {
    if (!gameState?.lastAction) return;
    const action = gameState.lastAction;

    if (action.type === 'shoot_self' || action.type === 'shoot_opponent') {
      const isLive = action.shell === 'live';
      setFiredShell(action.shell ?? null);
      setFiringTime(Date.now());

      if (isLive) {
        playLiveShot();
        showToast(
          action.type === 'shoot_self' ? 'LIVE — OUCH' : 'LIVE — DIRECT HIT',
          'live',
        );
      } else {
        playBlankShot();
        showToast(
          action.type === 'shoot_self' ? 'BLANK — GO AGAIN' : 'BLANK — MISS',
          'blank',
        );
      }

      if (isLive && (action.damage ?? 0) > 0) {
        const idx =
          action.type === 'shoot_self'
            ? gameState.players.findIndex((p) => p.id === action.actorId)
            : gameState.players.findIndex((p) => p.id === action.targetId);
        if (idx !== -1) {
          setDamagePulse(idx);
          setTimeout(() => setDamagePulse(null), 600);
        }
      }
    } else if (action.type === 'use_item' && action.item) {
      playItem(action.item);
      const msgs: Record<Item, string> = {
        cigarettes: '+1 HP',
        magnifier:  `NEXT SHELL: ${(action.shell ?? '?').toUpperCase()}`,
        handcuffs:  'OPPONENT CUFFED',
        beer:       `EJECTED: ${(action.shell ?? '?').toUpperCase()}`,
        inverter:   'SHELL FLIPPED',
      };
      showToast(msgs[action.item], action.item === 'cigarettes' ? 'heal' : 'item');
    }
  }, [gameState?.lastAction]);

  useEffect(() => {
    if (!gameState) return;
    if (prevRound.current !== null && gameState.round > prevRound.current) {
      playReload();
      showToast('NEW ROUND', 'item');
    }
    prevRound.current = gameState.round;
  }, [gameState?.round]);

  useEffect(() => {
    if (gameOver) {
      playGameOver(gameOver.winner.id === (user?.id ?? ''));
      refreshMe();
    }
  }, [gameOver]);

  async function handleRematch() {
    if (!gameOver || !betAmount) return;
    const opponentId =
      gameOver.winner.id === user?.id ? gameOver.loser.id : gameOver.winner.id;
    try {
      setRematchLoading(true);
      const res        = await api.post('/games/create', { betAmount, opponentId });
      const newSession = res.data.session.id;
      sendInvite(newSession, opponentId, betAmount);
      await refreshMe();
      clearGame();
      navigate(`/game/${newSession}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      alert(e.response?.data?.error || 'Failed to create rematch');
      setRematchLoading(false);
    }
  }

  // ── Loading / waiting screens ────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#080504' }}
      >
        <p className="font-cinzel text-xs tracking-widest" style={{ color: '#5a4030' }}>
          LOADING
        </p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6"
        style={{ background: '#080504' }}
      >
        <p className="font-cinzel text-sm tracking-widest" style={{ color: '#5a4030' }}>
          WAITING FOR OPPONENT
        </p>
        <button
          onClick={() => navigate('/')}
          className="btn-ghost text-xs tracking-widest"
        >
          HOME
        </button>
      </div>
    );
  }

  // ── Derived game state ───────────────────────────────────────────────────

  const myId          = user?.id ?? '';
  const myIndex       = gameState.players.findIndex((p) => p.id === myId);
  const opponentIndex = myIndex === 0 ? 1 : 0;
  const isMyTurn      = gameState.currentPlayerIndex === myIndex;
  const me            = myIndex !== -1 ? gameState.players[myIndex] : undefined;
  const opponent: PlayerState = gameState.players[opponentIndex];
  const totalShells   = gameState.shellCount.live + gameState.shellCount.blank;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: '100dvh', background: '#080504' }}
    >
      {/* ── 3D Canvas ── */}
      <div className="absolute inset-0">
        <Canvas
          shadows
          camera={{ position: [0, 2.2, 6.2], fov: 58 }}
          gl={{ antialias: true, alpha: false }}
          style={{ background: '#080504' }}
          onPointerLeave={() => { document.body.style.cursor = ''; }}
        >
          <GameScene
            totalShells={totalShells}
            revealedShell={revealedShell}
            isMyTurn={isMyTurn}
            myItems={me?.items ?? []}
            opponentItems={opponent?.items ?? []}
            firingTime={firingTime}
            firedShell={firedShell}
            onUseItem={(item) => {
              if (sessionId && isMyTurn) sendItem(sessionId, item, myId);
            }}
          />
        </Canvas>
      </div>

      {/* ── HTML overlay ── */}
      <div className="absolute inset-0 pointer-events-none flex flex-col">

        {/* Header */}
        <div
          className="pointer-events-auto flex items-center justify-between px-5 py-2.5 shrink-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(4,2,1,0.85) 0%, transparent 100%)',
          }}
        >
          <button
            onClick={() => navigate('/')}
            className="font-cinzel text-xs tracking-widest transition-colors"
            style={{ color: '#3a2a1a' }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#9a8060')}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#3a2a1a')}
          >
            HOME
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <span
              className="font-cinzel font-semibold text-sm tracking-widest"
              style={{ color: '#6a5040' }}
            >
              ROUND {gameState.round}
            </span>
            <span className="font-vt text-base leading-none" style={{ color: '#6a5040' }}>
              <span style={{ color: '#c0392b' }}>{gameState.shellCount.live}L</span>
              {' '}
              <span style={{ color: '#27ae60' }}>{gameState.shellCount.blank}B</span>
            </span>
          </div>
          <span className="font-vt text-xl" style={{ color: '#d69700' }}>
            {pot ? `${pot} COINS` : ''}
          </span>
        </div>

        {/* Opponent info — top */}
        <div className="px-5 pt-1 shrink-0">
          <PlayerOverlay
            player={opponent}
            isCurrentTurn={!isMyTurn}
            pulse={damagePulse === opponentIndex}
          />
        </div>

        {/* Spacer — 3D scene shows through */}
        <div className="flex-1" />

        {/* Player info — bottom */}
        <div className="px-5 pb-2 shrink-0">
          {me && (
            <PlayerOverlay
              player={me}
              isCurrentTurn={isMyTurn}
              pulse={damagePulse === myIndex}
            />
          )}
        </div>

        {/* Turn label + shell count hint */}
        <div className="px-5 shrink-0 text-center pb-1">
          <p
            className="font-cinzel text-xs tracking-widest"
            style={{ color: isMyTurn ? '#ad5437' : '#2e1a0e' }}
          >
            {isMyTurn
              ? '— YOUR TURN —'
              : `— ${opponent.username.toUpperCase()}'S TURN —`}
          </p>
          {isMyTurn && me && me.items.length > 0 && (
            <p
              className="font-cinzel text-xs tracking-widest mt-0.5"
              style={{ color: '#2e1e10' }}
            >
              CLICK AN ITEM ON THE TABLE TO USE IT
            </p>
          )}
        </div>

        {/* Action buttons */}
        {isMyTurn && gameState.phase === 'shooting' && (
          <div
            className="pointer-events-auto px-5 pb-6 pt-3 grid grid-cols-2 gap-3 shrink-0"
            style={{
              background:
                'linear-gradient(to top, rgba(4,2,1,0.9) 60%, transparent 100%)',
            }}
          >
            <button
              onClick={() => sendAction(sessionId!, 'shoot_self', myId)}
              className="py-4 rounded-xl font-cinzel text-xs tracking-widest transition-all"
              style={{
                background: '#0e0a06',
                border: '1px solid #2a1808',
                color: '#8a7060',
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget;
                b.style.background = '#1a120a';
                b.style.borderColor = '#5c2616';
                b.style.color = '#ebdec7';
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget;
                b.style.background = '#0e0a06';
                b.style.borderColor = '#2a1808';
                b.style.color = '#8a7060';
              }}
            >
              <div className="text-sm mb-0.5">SHOOT SELF</div>
              <div
                className="font-vt text-base"
                style={{ color: '#4a3020' }}
              >
                BLANK = EXTRA TURN
              </div>
            </button>

            <button
              onClick={() => sendAction(sessionId!, 'shoot_opponent', myId)}
              className="py-4 rounded-xl font-cinzel text-xs tracking-widest transition-all"
              style={{
                background: '#180404',
                border: '1px solid #4a0a0a',
                color: '#b07060',
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget;
                b.style.background = '#280808';
                b.style.borderColor = '#8b1a1a';
                b.style.color = '#ebdec7';
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget;
                b.style.background = '#180404';
                b.style.borderColor = '#4a0a0a';
                b.style.color = '#b07060';
              }}
            >
              <div className="text-sm mb-0.5">SHOOT THEM</div>
              <div
                className="font-vt text-base"
                style={{ color: '#5a2020' }}
              >
                LIVE = -1 HP
              </div>
            </button>
          </div>
        )}

        {/* Waiting — non-interactive bottom padding */}
        {!isMyTurn && <div className="shrink-0 pb-6" />}
      </div>

      <ActionToast toast={toast} />

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
