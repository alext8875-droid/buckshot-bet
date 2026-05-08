import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { signToken, authMiddleware, AuthRequest } from '../middleware/auth';

const router: RouterType = Router();
const prisma = new PrismaClient();

const EMOJIS = ['🐺', '🦊', '🐻', '🐼', '🦁', '🐯', '🦅', '🐉', '🦂', '💀', '🎭', '🃏', '🎲', '🔫', '🗡️', '⚡', '🌙', '🔥', '☠️', '🩸'];

// Strip spaces, dashes, parentheses so "+1 (234) 567-8900" and "+12345678900" match
function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}

function randomEmoji(): string {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

function randomUsername(): string {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `Player_${suffix}`;
}

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/auth/send-otp
router.post('/send-otp', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({ phone: z.string().min(7).max(20) });
  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid phone number', details: parsed.error.flatten() });
    return;
  }

  const phone = normalizePhone(parsed.data.phone);
  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Invalidate old OTPs for this phone
  await prisma.oTP.updateMany({
    where: { phone, used: false },
    data: { used: true },
  });

  // Find existing user
  const existingUser = await prisma.user.findUnique({ where: { phone } });

  await prisma.oTP.create({
    data: {
      phone,
      code,
      expiresAt,
      userId: existingUser?.id ?? null,
    },
  });

  process.stdout.write(`\n======================\nOTP CODE: ${code}\nPHONE:    ${phone}\n======================\n`);

  res.json({ success: true, message: 'OTP sent (check server console in dev mode)' });
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    phone: z.string().min(7).max(20),
    code: z.string().length(6),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const phone = normalizePhone(parsed.data.phone);
  const { code } = parsed.data;

  const otp = await prisma.oTP.findFirst({
    where: {
      phone,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: 'desc' },
  });

  if (!otp) {
    res.status(400).json({ error: 'Invalid or expired OTP' });
    return;
  }

  // Mark OTP as used
  await prisma.oTP.update({ where: { id: otp.id }, data: { used: true } });

  // Upsert user
  let user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    // Generate a unique username
    let username = randomUsername();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (!existing) break;
      username = randomUsername();
      attempts++;
    }

    user = await prisma.user.create({
      data: {
        phone,
        username,
        avatar: randomEmoji(),
        wallet: {
          create: {
            coins: 1000,
            transactions: {
              create: {
                type: 'bonus',
                amount: 1000,
                note: 'Welcome bonus — 1000 free coins!',
              },
            },
          },
        },
      },
    });
  }

  const token = signToken(user.id);

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      phone: user.phone,
      username: user.username,
      avatar: user.avatar,
      createdAt: user.createdAt,
    },
    wallet: {
      coins: wallet?.coins ?? 0,
    },
  });
});

// POST /api/auth/me
router.post('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { wallet: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    user: {
      id: user.id,
      phone: user.phone,
      username: user.username,
      avatar: user.avatar,
      createdAt: user.createdAt,
    },
    wallet: {
      coins: user.wallet?.coins ?? 0,
    },
  });
});

export { router as authRouter };
