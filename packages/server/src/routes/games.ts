import { Router, Response } from 'express';
import type { Router as RouterType } from 'express';
import { z } from 'zod';
import { PrismaClient, Prisma } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { initGame } from '../game/engine';

const router: RouterType = Router();
const prisma = new PrismaClient();

// POST /api/games/create
router.post('/create', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    betAmount: z.number().int().min(10).max(10000),
    opponentId: z.string(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { betAmount, opponentId } = parsed.data;
  const creatorId = req.userId!;

  if (creatorId === opponentId) {
    res.status(400).json({ error: 'Cannot challenge yourself' });
    return;
  }

  // Verify opponent exists
  const opponent = await prisma.user.findUnique({ where: { id: opponentId } });
  if (!opponent) {
    res.status(404).json({ error: 'Opponent not found' });
    return;
  }

  // Check creator has enough coins
  const creatorWallet = await prisma.wallet.findUnique({ where: { userId: creatorId } });
  if (!creatorWallet || creatorWallet.coins < betAmount) {
    res.status(400).json({ error: 'Insufficient coins' });
    return;
  }

  // Deduct bet from creator wallet and create session
  const [session] = await prisma.$transaction([
    prisma.gameSession.create({
      data: {
        betAmount,
        pot: betAmount,
        status: 'waiting',
        players: {
          create: { userId: creatorId },
        },
      },
      include: {
        players: {
          include: {
            user: { select: { id: true, username: true, avatar: true } },
          },
        },
      },
    }),
    prisma.wallet.update({
      where: { userId: creatorId },
      data: { coins: { decrement: betAmount } },
    }),
    prisma.transaction.create({
      data: {
        walletId: creatorWallet.id,
        type: 'bet_placed',
        amount: -betAmount,
        note: `Bet placed vs ${opponent.username}`,
      },
    }),
  ]);

  res.json({ success: true, session });
});

// POST /api/games/:id/join
router.post('/:id/join', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const sessionId = req.params.id;
  const userId = req.userId!;

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
    res.status(404).json({ error: 'Game session not found' });
    return;
  }

  if (session.status !== 'waiting') {
    res.status(400).json({ error: 'Game already started or finished' });
    return;
  }

  if (session.players.some((p: { userId: string }) => p.userId === userId)) {
    res.status(400).json({ error: 'Already in this game' });
    return;
  }

  if (session.players.length >= 2) {
    res.status(400).json({ error: 'Game is full' });
    return;
  }

  const joinerWallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!joinerWallet || joinerWallet.coins < session.betAmount) {
    res.status(400).json({ error: 'Insufficient coins' });
    return;
  }

  const joiner = await prisma.user.findUnique({ where: { id: userId } });
  const creator = session.players[0].user;

  if (!joiner) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Initialize game state
  const gameState = initGame(
    sessionId,
    { id: creator.id, username: creator.username, avatar: creator.avatar || '🎭' },
    { id: joiner.id, username: joiner.username, avatar: joiner.avatar || '🎭' }
  );

  // Add player, deduct bet, update status
  const [updatedSession] = await prisma.$transaction([
    prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'active',
        pot: { increment: session.betAmount },
        gameState: gameState as unknown as Prisma.InputJsonValue,
        players: {
          create: { userId },
        },
      },
      include: {
        players: {
          include: {
            user: { select: { id: true, username: true, avatar: true } },
          },
        },
      },
    }),
    prisma.wallet.update({
      where: { userId },
      data: { coins: { decrement: session.betAmount } },
    }),
    prisma.transaction.create({
      data: {
        walletId: joinerWallet.id,
        type: 'bet_placed',
        amount: -session.betAmount,
        note: `Bet placed vs ${creator.username}`,
      },
    }),
  ]);

  res.json({ success: true, session: updatedSession, gameState });
});

// GET /api/games/history
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const gamePlayers = await prisma.gamePlayer.findMany({
    where: { userId: req.userId },
    include: {
      session: {
        include: {
          players: {
            include: {
              user: { select: { id: true, username: true, avatar: true } },
            },
          },
        },
      },
    },
    orderBy: { session: { createdAt: 'desc' } },
    take: 20,
  });

  const games = gamePlayers.map((gp: typeof gamePlayers[number]) => ({
    sessionId: gp.sessionId,
    result: gp.result,
    betAmount: gp.session.betAmount,
    pot: gp.session.pot,
    status: gp.session.status,
    winnerId: gp.session.winnerId,
    createdAt: gp.session.createdAt,
    players: gp.session.players.map((p: typeof gp.session.players[number]) => ({
      userId: p.userId,
      username: p.user.username,
      avatar: p.user.avatar,
      result: p.result,
    })),
  }));

  res.json(games);
});

export { router as gamesRouter };
