import { Server, Socket } from 'socket.io';
import { PrismaClient, Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { processAction, GameState, Item } from '../game/engine';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

function getUserIdFromSocket(socket: Socket): string | null {
  const token =
    (socket.handshake.auth?.token as string) ||
    (socket.handshake.headers?.authorization as string | undefined)?.replace('Bearer ', '');

  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    return payload.userId;
  } catch {
    return null;
  }
}

export function registerGameHandlers(io: Server, socket: Socket): void {
  // Join a game room and receive current state
  socket.on('join_game_room', async (sessionId: string) => {
    const userId = getUserIdFromSocket(socket);
    if (!userId) {
      socket.emit('error', { message: 'Unauthorized' });
      return;
    }

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        players: {
          include: {
            user: { select: { id: true, username: true, avatar: true } },
          },
        },
      },
    });

    if (!session) {
      socket.emit('error', { message: 'Game session not found' });
      return;
    }

    const isPlayer = session.players.some((p: { userId: string }) => p.userId === userId);
    if (!isPlayer) {
      socket.emit('error', { message: 'You are not a player in this game' });
      return;
    }

    socket.join(sessionId);
    console.log(`[Socket] User ${userId} joined room ${sessionId}`);

    socket.emit('game_state_update', {
      sessionId,
      gameState: session.gameState,
      status: session.status,
      pot: session.pot,
      betAmount: session.betAmount,
    });
  });

  // Handle a game action (shoot_self / shoot_opponent)
  socket.on(
    'game_action',
    async (data: { sessionId: string; action: { type: 'shoot_self' | 'shoot_opponent'; actorId: string } }) => {
      const userId = getUserIdFromSocket(socket);
      if (!userId) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      const { sessionId, action } = data;

      if (action.actorId !== userId) {
        socket.emit('error', { message: 'Actor ID mismatch' });
        return;
      }

      try {
        const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        if (session.status !== 'active') {
          socket.emit('error', { message: 'Game is not active' });
          return;
        }

        const currentState = session.gameState as unknown as GameState;
        const { newState, action: resolvedAction } = processAction(currentState, action);

        // Persist new state
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: { gameState: newState as unknown as Prisma.InputJsonValue },
        });

        // Broadcast to all players in the room
        io.to(sessionId).emit('game_state_update', {
          sessionId,
          gameState: newState,
          action: resolvedAction,
          pot: session.pot,
          betAmount: session.betAmount,
        });

        // Handle game over
        if (newState.phase === 'finished' && newState.winner) {
          await settleGame(io, sessionId, newState.winner);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        socket.emit('error', { message });
      }
    }
  );

  // Handle item use
  socket.on(
    'use_item',
    async (data: { sessionId: string; item: Item; actorId: string }) => {
      const userId = getUserIdFromSocket(socket);
      if (!userId) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      const { sessionId, item, actorId } = data;

      if (actorId !== userId) {
        socket.emit('error', { message: 'Actor ID mismatch' });
        return;
      }

      try {
        const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
        if (!session || session.status !== 'active') {
          socket.emit('error', { message: 'Session not active' });
          return;
        }

        const currentState = session.gameState as unknown as GameState;
        const { newState, action: resolvedAction } = processAction(currentState, {
          type: 'use_item',
          actorId,
          item,
        });

        await prisma.gameSession.update({
          where: { id: sessionId },
          data: { gameState: newState as unknown as Prisma.InputJsonValue },
        });

        // For magnifier: only send shell reveal to the acting player
        if (item === 'magnifier') {
          // Send full update to actor (they see the shell)
          socket.emit('game_state_update', {
            sessionId,
            gameState: newState,
            action: resolvedAction,
            pot: session.pot,
            betAmount: session.betAmount,
          });

          // Send update to others without the sawNextShell info and shell in action
          const publicAction = { ...resolvedAction, shell: undefined };
          const publicState = { ...newState, sawNextShell: false };
          socket.to(sessionId).emit('game_state_update', {
            sessionId,
            gameState: publicState,
            action: publicAction,
            pot: session.pot,
            betAmount: session.betAmount,
          });
        } else {
          io.to(sessionId).emit('game_state_update', {
            sessionId,
            gameState: newState,
            action: resolvedAction,
            pot: session.pot,
            betAmount: session.betAmount,
          });
        }

        if (newState.phase === 'finished' && newState.winner) {
          await settleGame(io, sessionId, newState.winner);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        socket.emit('error', { message });
      }
    }
  );

  // Send game invite to a friend (push via socket room keyed by userId)
  socket.on(
    'send_game_invite',
    async (data: { sessionId: string; opponentId: string; betAmount: number }) => {
      const userId = getUserIdFromSocket(socket);
      if (!userId) return;

      const sender = await prisma.user.findUnique({ where: { id: userId } });
      if (!sender) return;

      io.to(`user:${data.opponentId}`).emit('game_invite', {
        sessionId: data.sessionId,
        from: {
          id: sender.id,
          username: sender.username,
          avatar: sender.avatar,
        },
        betAmount: data.betAmount,
      });
    }
  );

  // Join personal notification room
  socket.on('join_user_room', () => {
    const userId = getUserIdFromSocket(socket);
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`[Socket] User ${userId} joined personal room`);
    }
  });
}

async function settleGame(io: Server, sessionId: string, winnerId: string): Promise<void> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      players: {
        include: {
          user: { select: { id: true, username: true, avatar: true } },
        },
      },
    },
  });

  if (!session) return;

  const winnerWallet = await prisma.wallet.findUnique({ where: { userId: winnerId } });
  if (!winnerWallet) return;

  const winner = session.players.find((p: typeof session.players[number]) => p.userId === winnerId);
  const loser = session.players.find((p: typeof session.players[number]) => p.userId !== winnerId);

  if (!winner || !loser) return;

  // Transfer pot to winner, mark session finished
  await prisma.$transaction([
    prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'finished',
        winnerId,
        players: {
          update: [
            { where: { id: winner.id }, data: { result: 'won' } },
            { where: { id: loser.id }, data: { result: 'lost' } },
          ],
        },
      },
    }),
    prisma.wallet.update({
      where: { userId: winnerId },
      data: { coins: { increment: session.pot } },
    }),
    prisma.transaction.create({
      data: {
        walletId: winnerWallet.id,
        type: 'bet_won',
        amount: session.pot,
        note: `Won game vs ${loser.user.username} — pot: ${session.pot} coins`,
      },
    }),
  ]);

  console.log(`[Game] Session ${sessionId} finished. Winner: ${winner.user.username} (+${session.pot} coins)`);

  io.to(sessionId).emit('game_over', {
    sessionId,
    winner: {
      id: winner.user.id,
      username: winner.user.username,
      avatar: winner.user.avatar,
    },
    loser: {
      id: loser.user.id,
      username: loser.user.username,
      avatar: loser.user.avatar,
    },
    pot: session.pot,
  });
}
