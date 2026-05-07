import { Router, Response } from 'express';
import type { Router as RouterType } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router: RouterType = Router();
const prisma = new PrismaClient();

// GET /api/wallet
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const wallet = await prisma.wallet.findUnique({
    where: { userId: req.userId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!wallet) {
    res.status(404).json({ error: 'Wallet not found' });
    return;
  }

  res.json({
    coins: wallet.coins,
    transactions: wallet.transactions,
  });
});

// POST /api/wallet/deposit — STUB
router.post('/deposit', authMiddleware, async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({
    message: 'Real money deposits coming soon. Contact us for early access.',
    stub: true,
  });
});

export { router as walletRouter };
