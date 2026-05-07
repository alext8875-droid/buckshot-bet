import { Router, Response } from 'express';
import type { Router as RouterType } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

const router: RouterType = Router();
const prisma = new PrismaClient();

// GET /api/friends — list accepted friends
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ senderId: req.userId }, { receiverId: req.userId }],
    },
    include: {
      sender: { select: { id: true, username: true, avatar: true, phone: true } },
      receiver: { select: { id: true, username: true, avatar: true, phone: true } },
    },
  });

  const friends = friendships.map((f: typeof friendships[number]) => {
    const friend = f.senderId === req.userId ? f.receiver : f.sender;
    return {
      friendshipId: f.id,
      friend,
    };
  });

  res.json(friends);
});

// GET /api/friends/requests — pending incoming requests
router.get('/requests', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const requests = await prisma.friendship.findMany({
    where: {
      receiverId: req.userId,
      status: 'pending',
    },
    include: {
      sender: { select: { id: true, username: true, avatar: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(requests);
});

// POST /api/friends/request — send a friend request by phone
router.post('/request', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ phone: z.string().min(7).max(20) });
  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid phone number' });
    return;
  }

  const phone = normalizePhone(parsed.data.phone);

  const targetUser = await prisma.user.findUnique({ where: { phone } });
  if (!targetUser) {
    res.status(404).json({ error: 'No user found with that phone number' });
    return;
  }

  if (targetUser.id === req.userId) {
    res.status(400).json({ error: 'Cannot send a friend request to yourself' });
    return;
  }

  // Check if friendship already exists
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { senderId: req.userId, receiverId: targetUser.id },
        { senderId: targetUser.id, receiverId: req.userId },
      ],
    },
  });

  if (existing) {
    if (existing.status === 'accepted') {
      res.status(409).json({ error: 'Already friends' });
    } else {
      res.status(409).json({ error: 'Friend request already pending' });
    }
    return;
  }

  const friendship = await prisma.friendship.create({
    data: {
      senderId: req.userId!,
      receiverId: targetUser.id,
      status: 'pending',
    },
    include: {
      receiver: { select: { id: true, username: true, avatar: true } },
    },
  });

  res.json({ success: true, friendship });
});

// POST /api/friends/accept/:id
router.post('/accept/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const friendship = await prisma.friendship.findUnique({
    where: { id: req.params.id },
  });

  if (!friendship) {
    res.status(404).json({ error: 'Friend request not found' });
    return;
  }

  if (friendship.receiverId !== req.userId) {
    res.status(403).json({ error: 'Not authorized to accept this request' });
    return;
  }

  if (friendship.status !== 'pending') {
    res.status(400).json({ error: 'Request is not pending' });
    return;
  }

  const updated = await prisma.friendship.update({
    where: { id: req.params.id },
    data: { status: 'accepted' },
    include: {
      sender: { select: { id: true, username: true, avatar: true } },
    },
  });

  res.json({ success: true, friendship: updated });
});

// DELETE /api/friends/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const friendship = await prisma.friendship.findUnique({
    where: { id: req.params.id },
  });

  if (!friendship) {
    res.status(404).json({ error: 'Friendship not found' });
    return;
  }

  if (friendship.senderId !== req.userId && friendship.receiverId !== req.userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  await prisma.friendship.delete({ where: { id: req.params.id } });

  res.json({ success: true });
});

export { router as friendsRouter };
