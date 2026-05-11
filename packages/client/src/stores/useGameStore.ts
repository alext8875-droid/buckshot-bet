import { create } from 'zustand';
import { getSocket, connectSocket } from '../lib/socket';
import { Socket } from 'socket.io-client';

export type Shell = 'live' | 'blank';
export type Item = 'magnifier' | 'cigarettes' | 'handcuffs' | 'beer' | 'inverter';

export interface PlayerState {
  id: string;
  username: string;
  avatar: string;
  hp: number;
  maxHp: number;
  items: Item[];
  handcuffed: boolean;
}

export interface GameAction {
  type: 'shoot_self' | 'shoot_opponent' | 'use_item';
  actorId: string;
  targetId?: string;
  item?: Item;
  shell?: Shell;
  damage?: number;
  result?: string;
}

export interface GameState {
  sessionId: string;
  players: [PlayerState, PlayerState];
  currentPlayerIndex: number;
  shells: Shell[];
  shellCount: { live: number; blank: number };
  roundShellTotal: number;
  round: number;
  phase: 'shooting' | 'item' | 'finished';
  winner: string | null;
  lastAction: GameAction | null;
  sawNextShell: boolean;
}

export interface GameOverInfo {
  sessionId: string;
  winner: { id: string; username: string; avatar: string | null };
  loser: { id: string; username: string; avatar: string | null };
  pot: number;
}

export interface GameInvite {
  sessionId: string;
  from: { id: string; username: string; avatar: string | null };
  betAmount: number;
}

interface GameStore {
  gameState: GameState | null;
  actionLog: string[];
  gameOver: GameOverInfo | null;
  pendingInvite: GameInvite | null;
  revealedShell: Shell | null;
  pot: number | null;
  betAmount: number | null;

  setGameState: (state: GameState, action?: GameAction) => void;
  setGameOver: (info: GameOverInfo) => void;
  setPendingInvite: (invite: GameInvite | null) => void;
  setRevealedShell: (shell: Shell | null) => void;
  clearGame: () => void;

  // Socket actions
  joinGameRoom: (sessionId: string) => void;
  sendAction: (sessionId: string, type: 'shoot_self' | 'shoot_opponent', actorId: string) => void;
  sendItem: (sessionId: string, item: Item, actorId: string) => void;
  sendInvite: (sessionId: string, opponentId: string, betAmount: number) => void;
  joinUserRoom: () => void;
  setupListeners: (onInvite: (invite: GameInvite) => void) => () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  actionLog: [],
  gameOver: null,
  pendingInvite: null,
  revealedShell: null,
  pot: null,
  betAmount: null,

  setGameState: (state, action) => {
    const logs = get().actionLog;
    const newLog = action?.result ? [action.result, ...logs].slice(0, 50) : logs;

    let revealedShell = get().revealedShell;
    if (action?.type === 'use_item') {
      if (action.item === 'magnifier' && action.shell) {
        revealedShell = action.shell;
      } else if (action.item === 'beer') {
        revealedShell = null; // ejected the peeked shell
      } else if (action.item === 'inverter' && revealedShell) {
        revealedShell = revealedShell === 'live' ? 'blank' : 'live'; // flip the known shell
      }
    } else if (!state.sawNextShell) {
      revealedShell = null; // shell consumed or round changed
    }

    set({ gameState: state, actionLog: newLog, revealedShell });
  },

  setGameOver: (info) => set({ gameOver: info }),

  setPendingInvite: (invite) => set({ pendingInvite: invite }),

  setRevealedShell: (shell) => set({ revealedShell: shell }),

  clearGame: () =>
    set({ gameState: null, actionLog: [], gameOver: null, revealedShell: null, pot: null, betAmount: null }),

  joinGameRoom: (sessionId) => {
    connectSocket();
    const socket: Socket = getSocket();
    socket.emit('join_game_room', sessionId);
  },

  sendAction: (sessionId, type, actorId) => {
    const socket: Socket = getSocket();
    socket.emit('game_action', { sessionId, action: { type, actorId } });
  },

  sendItem: (sessionId, item, actorId) => {
    const socket: Socket = getSocket();
    socket.emit('use_item', { sessionId, item, actorId });
  },

  sendInvite: (sessionId, opponentId, betAmount) => {
    const socket: Socket = getSocket();
    socket.emit('send_game_invite', { sessionId, opponentId, betAmount });
  },

  joinUserRoom: () => {
    connectSocket();
    const socket: Socket = getSocket();
    socket.emit('join_user_room');
  },

  setupListeners: (onInvite) => {
    connectSocket();
    const socket: Socket = getSocket();
    socket.emit('join_user_room');

    const handleStateUpdate = (data: {
      sessionId: string;
      gameState: GameState;
      action?: GameAction;
      pot?: number;
      betAmount?: number;
    }) => {
      if (data.pot !== undefined) set({ pot: data.pot });
      if (data.betAmount !== undefined) set({ betAmount: data.betAmount });
      get().setGameState(data.gameState, data.action);
    };

    const handleGameOver = (info: GameOverInfo) => {
      get().setGameOver(info);
    };

    const handleInvite = (invite: GameInvite) => {
      set({ pendingInvite: invite });
      onInvite(invite);
    };

    socket.on('game_state_update', handleStateUpdate);
    socket.on('game_over', handleGameOver);
    socket.on('game_invite', handleInvite);

    return () => {
      socket.off('game_state_update', handleStateUpdate);
      socket.off('game_over', handleGameOver);
      socket.off('game_invite', handleInvite);
    };
  },
}));
