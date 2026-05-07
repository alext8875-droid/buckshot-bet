import { Router, Response } from 'express';
import type { Router as RouterType } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router: RouterType = Router();
const prisma = new PrismaClient();

// GET /api/users/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: {
      wallet: {
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: user.id,
    phone: user.phone,
    username: user.username,
    avatar: user.avatar,
    createdAt: user.createdAt,
    wallet: {
      coins: user.wallet?.coins ?? 0,
      transactions: user.wallet?.transactions ?? [],
    },
  });
});

// PUT /api/users/me
router.put('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    username: z.string().min(3).max(24).optional(),
    avatar: z.string().max(10).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { username, avatar } = parsed.data;

  if (username) {
    const existing = await prisma.user.findFirst({
      where: { username, id: { not: req.userId } },
    });
    if (existing) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      ...(username && { username }),
      ...(avatar && { avatar }),
    },
  });

  res.json({
    id: user.id,
    phone: user.phone,
    username: user.username,
    avatar: user.avatar,
    createdAt: user.createdAt,
  });
});

export { router as usersRouter };
