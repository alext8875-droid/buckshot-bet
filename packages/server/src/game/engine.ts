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

export interface GameState {
  sessionId: string;
  players: [PlayerState, PlayerState];
  currentPlayerIndex: number;
  shells: Shell[];
  shellCount: { live: number; blank: number };
  roundShellTotal: number; // total shells when round started — hide ratio once any shell is consumed
  round: number;
  phase: 'shooting' | 'item' | 'finished';
  winner: string | null;
  lastAction: GameAction | null;
  sawNextShell: boolean;
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

const ALL_ITEMS: Item[] = ['magnifier', 'cigarettes', 'handcuffs', 'beer', 'inverter'];
const MAX_ITEMS_PER_PLAYER = 4;
const PLAYER_MAX_HP = 4;

export function generateShells(): Shell[] {
  const total = Math.floor(Math.random() * 7) + 2; // 2–8 shells
  const liveCount = Math.max(1, Math.floor(Math.random() * (total - 1)) + 1);
  const blankCount = total - liveCount;

  const shells: Shell[] = [
    ...Array(liveCount).fill('live' as Shell),
    ...Array(blankCount).fill('blank' as Shell),
  ];

  // Fisher-Yates shuffle
  for (let i = shells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shells[i], shells[j]] = [shells[j], shells[i]];
  }

  return shells;
}

function dealItems(player: PlayerState): PlayerState {
  const itemCount = Math.floor(Math.random() * 3) + 1;
  const items = [...player.items];
  for (let i = 0; i < itemCount; i++) {
    if (items.length < MAX_ITEMS_PER_PLAYER) {
      items.push(ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)]);
    }
  }
  return { ...player, items };
}

export function initGame(
  sessionId: string,
  p1: { id: string; username: string; avatar: string },
  p2: { id: string; username: string; avatar: string }
): GameState {
  const shells = generateShells();
  const liveCount = shells.filter((s) => s === 'live').length;
  const blankCount = shells.filter((s) => s === 'blank').length;

  const player1: PlayerState = {
    id: p1.id,
    username: p1.username,
    avatar: p1.avatar,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    items: [],
    handcuffed: false,
  };

  const player2: PlayerState = {
    id: p2.id,
    username: p2.username,
    avatar: p2.avatar,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    items: [],
    handcuffed: false,
  };

  return {
    sessionId,
    players: [dealItems(player1), dealItems(player2)],
    currentPlayerIndex: 0,
    shells,
    shellCount: { live: liveCount, blank: blankCount },
    roundShellTotal: shells.length,
    round: 1,
    phase: 'shooting',
    winner: null,
    lastAction: null,
    sawNextShell: false,
  };
}

function reloadShells(state: GameState): GameState {
  const newShells = generateShells();
  const liveCount = newShells.filter((s) => s === 'live').length;
  const blankCount = newShells.filter((s) => s === 'blank').length;

  return {
    ...state,
    players: [dealItems(state.players[0]), dealItems(state.players[1])],
    shells: newShells,
    shellCount: { live: liveCount, blank: blankCount },
    roundShellTotal: newShells.length,
    round: state.round + 1,
    sawNextShell: false,
  };
}

function nextTurn(state: GameState): GameState {
  const nextIndex = state.currentPlayerIndex === 0 ? 1 : 0;
  let nextState = { ...state, currentPlayerIndex: nextIndex, sawNextShell: false };

  // If next player is handcuffed, skip their turn
  if (nextState.players[nextIndex].handcuffed) {
    const updatedPlayers = [...nextState.players] as [PlayerState, PlayerState];
    updatedPlayers[nextIndex] = { ...updatedPlayers[nextIndex], handcuffed: false };
    nextState = { ...nextState, players: updatedPlayers, currentPlayerIndex: nextIndex === 0 ? 1 : 0 };
  }

  return nextState;
}

function checkWinner(state: GameState): GameState {
  const [p1, p2] = state.players;
  if (p2.hp <= 0) {
    return { ...state, phase: 'finished', winner: p1.id };
  }
  if (p1.hp <= 0) {
    return { ...state, phase: 'finished', winner: p2.id };
  }
  return state;
}

export function processAction(
  state: GameState,
  action: { type: 'shoot_self' | 'shoot_opponent' | 'use_item'; actorId: string; item?: Item }
): { newState: GameState; action: GameAction } {
  if (state.phase === 'finished') {
    throw new Error('Game is already finished');
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  const opponentIndex = state.currentPlayerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];

  if (currentPlayer.id !== action.actorId) {
    throw new Error('Not your turn');
  }

  let newState = { ...state, players: [...state.players] as [PlayerState, PlayerState] };

  if (action.type === 'use_item') {
    if (!action.item) {
      throw new Error('No item specified');
    }

    const itemIndex = currentPlayer.items.indexOf(action.item);
    if (itemIndex === -1) {
      throw new Error(`You do not have item: ${action.item}`);
    }

    // Remove item from player
    const updatedItems = [...currentPlayer.items];
    updatedItems.splice(itemIndex, 1);
    const updatedCurrentPlayer = { ...currentPlayer, items: updatedItems };
    newState.players[state.currentPlayerIndex] = updatedCurrentPlayer;

    let gameAction: GameAction = {
      type: 'use_item',
      actorId: action.actorId,
      item: action.item,
    };

    switch (action.item) {
      case 'magnifier': {
        // Peek at next shell
        const nextShell = newState.shells[0];
        newState.sawNextShell = true;
        gameAction = {
          ...gameAction,
          shell: nextShell,
          result: `Used magnifier — next shell is ${nextShell}`,
        };
        break;
      }

      case 'cigarettes': {
        // Restore 1 HP up to max
        const healed = Math.min(updatedCurrentPlayer.hp + 1, updatedCurrentPlayer.maxHp);
        newState.players[state.currentPlayerIndex] = {
          ...updatedCurrentPlayer,
          hp: healed,
        };
        gameAction = {
          ...gameAction,
          result: `Used cigarettes — healed to ${healed} HP`,
        };
        break;
      }

      case 'handcuffs': {
        // Handcuff opponent (they skip next turn)
        if (opponent.handcuffed) {
          gameAction = { ...gameAction, result: 'Opponent is already handcuffed' };
        } else {
          newState.players[opponentIndex] = { ...opponent, handcuffed: true };
          gameAction = {
            ...gameAction,
            targetId: opponent.id,
            result: `Used handcuffs on ${opponent.username} — they skip their next turn`,
          };
        }
        break;
      }

      case 'beer': {
        // Eject top shell (rack the shotgun)
        if (newState.shells.length === 0) {
          gameAction = { ...gameAction, result: 'No shells to eject' };
        } else {
          const ejected = newState.shells[0];
          const remainingShells = newState.shells.slice(1);
          const liveCount = remainingShells.filter((s) => s === 'live').length;
          const blankCount = remainingShells.filter((s) => s === 'blank').length;
          newState = {
            ...newState,
            shells: remainingShells,
            shellCount: { live: liveCount, blank: blankCount },
            sawNextShell: false,
          };
          gameAction = {
            ...gameAction,
            shell: ejected,
            result: `Racked the shotgun — ejected a ${ejected} shell`,
          };

          // Reload if empty
          if (remainingShells.length === 0) {
            newState = reloadShells(newState);
          }
        }
        break;
      }

      case 'inverter': {
        // Flip the next shell
        if (newState.shells.length === 0) {
          gameAction = { ...gameAction, result: 'No shell to invert' };
        } else {
          const flipped: Shell = newState.shells[0] === 'live' ? 'blank' : 'live';
          const newShells = [flipped, ...newState.shells.slice(1)];
          const liveCount = newShells.filter((s) => s === 'live').length;
          const blankCount = newShells.filter((s) => s === 'blank').length;
          newState = {
            ...newState,
            shells: newShells,
            shellCount: { live: liveCount, blank: blankCount },
          };
          gameAction = {
            ...gameAction,
            result: `Used inverter — flipped the next shell to ${flipped}`,
          };
        }
        break;
      }
    }

    newState.lastAction = gameAction;
    return { newState, action: gameAction };
  }

  // Shooting actions — consume next shell
  if (newState.shells.length === 0) {
    newState = reloadShells(newState);
  }

  const shell = newState.shells[0];
  const remainingShells = newState.shells.slice(1);
  const liveCount = remainingShells.filter((s) => s === 'live').length;
  const blankCount = remainingShells.filter((s) => s === 'blank').length;
  newState = {
    ...newState,
    shells: remainingShells,
    shellCount: { live: liveCount, blank: blankCount },
    sawNextShell: false,
  };

  let gameAction: GameAction;

  if (action.type === 'shoot_self') {
    if (shell === 'blank') {
      // Blank: current player goes again (no turn pass)
      gameAction = {
        type: 'shoot_self',
        actorId: action.actorId,
        shell: 'blank',
        damage: 0,
        result: `${currentPlayer.username} shot themselves — BLANK! They go again.`,
      };
      // Don't change turn — player goes again
    } else {
      // Live: take damage, turn passes
      const newHp = currentPlayer.hp - 1;
      newState.players[state.currentPlayerIndex] = { ...currentPlayer, hp: newHp };
      gameAction = {
        type: 'shoot_self',
        actorId: action.actorId,
        shell: 'live',
        damage: 1,
        result: `${currentPlayer.username} shot themselves — LIVE! -1 HP.`,
      };
      newState = checkWinner(newState);
      if (newState.phase !== 'finished') {
        newState = nextTurn(newState);
      }
    }
  } else {
    // shoot_opponent
    if (shell === 'live') {
      // Live: opponent takes damage, turn passes
      const newHp = opponent.hp - 1;
      newState.players[opponentIndex] = { ...opponent, hp: newHp };
      gameAction = {
        type: 'shoot_opponent',
        actorId: action.actorId,
        targetId: opponent.id,
        shell: 'live',
        damage: 1,
        result: `${currentPlayer.username} shot ${opponent.username} — LIVE! -1 HP.`,
      };
      newState = checkWinner(newState);
      if (newState.phase !== 'finished') {
        newState = nextTurn(newState);
      }
    } else {
      // Blank: miss, turn passes
      gameAction = {
        type: 'shoot_opponent',
        actorId: action.actorId,
        targetId: opponent.id,
        shell: 'blank',
        damage: 0,
        result: `${currentPlayer.username} shot ${opponent.username} — BLANK! No damage.`,
      };
      newState = nextTurn(newState);
    }
  }

  // Reload if shells emptied after this shot
  if (newState.shells.length === 0 && newState.phase !== 'finished') {
    newState = reloadShells(newState);
  }

  newState.lastAction = gameAction;
  return { newState, action: gameAction };
}
