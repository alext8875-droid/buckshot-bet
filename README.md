# Buckshot Bet 🔫

A real-money (virtual coins) multiplayer gambling app where friends challenge each other to Buckshot Roulette.

## Stack

- **Monorepo**: pnpm workspaces
- **Client**: React 18 + Vite + TypeScript + Tailwind CSS + Socket.io-client + Zustand
- **Server**: Node.js + Express + TypeScript + Socket.io + Prisma (PostgreSQL)
- **Auth**: Phone number → 6-digit OTP (mock: logged to console in dev)
- **Wallet**: Virtual coin system (1000 free coins on signup)

---

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- PostgreSQL running locally

---

## Setup

### 1. Install dependencies

```bash
cd /Users/alextorres/buckshot-bet
pnpm install
```

### 2. Configure environment

```bash
cp packages/server/.env.example packages/server/.env
```

Edit `packages/server/.env`:
```
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/buckshot_bet"
JWT_SECRET="some-long-random-string"
PORT=3001
CLIENT_URL="http://localhost:5173"
```

### 3. Create database and run migrations

```bash
# Create the DB (if using psql CLI)
createdb buckshot_bet

# Run Prisma migration
pnpm db:migrate
# Enter a migration name when prompted, e.g. "init"
```

Or if you want to skip migrations (development only):
```bash
pnpm --filter server db:push
```

### 4. Run the dev servers

```bash
pnpm dev
```

This starts:
- Server on `http://localhost:3001`
- Client on `http://localhost:5173`

---

## How to Play

1. Open `http://localhost:5173` in **two different browser windows** (or incognito)
2. Sign up with a phone number (OTP will appear in the **server console**)
3. Add each other as friends via the Friends page (use the same phone format you registered with)
4. One player clicks **"Challenge Friend"** on the home page → selects opponent → sets bet amount
5. The opponent receives a popup invite and accepts
6. Both players land in the game room — play Buckshot Roulette!

---

## Game Rules

- Each player starts with **4 HP** and random **items**
- A random mix of **live** and **blank** shells is loaded each round
- On your turn you can:
  - **Shoot Self** — if blank, you go again; if live, -1 HP and turn passes
  - **Shoot Opponent** — if live, -1 HP and turn passes; if blank, turn passes
  - **Use an Item** before shooting (doesn't end your turn)
- **Items**:
  - 🔍 Magnifier — peek at the next shell (only you see it)
  - 🚬 Cigarettes — heal +1 HP (up to max)
  - 🔒 Handcuffs — opponent skips their next turn
  - 🍺 Beer — eject the top shell from the gun
  - 🔄 Inverter — flip the next shell (live ↔ blank)
- When shells run out, a new batch is loaded and items are dealt
- First player to reduce opponent to **0 HP** wins the pot

---

## Architecture

```
buckshot-bet/
├── packages/
│   ├── client/               # React + Vite frontend
│   │   └── src/
│   │       ├── pages/        # AuthPage, HomePage, FriendsPage, WalletPage, GamePage
│   │       ├── stores/       # useAuthStore, useGameStore (Zustand)
│   │       ├── components/   # Layout, GameInviteModal
│   │       └── lib/          # api.ts (axios), socket.ts (socket.io)
│   └── server/               # Express + Socket.io backend
│       ├── src/
│       │   ├── routes/       # auth, users, friends, wallet, games
│       │   ├── middleware/   # auth.ts (JWT)
│       │   ├── game/         # engine.ts (pure game logic)
│       │   └── socket/       # gameHandler.ts (real-time events)
│       └── prisma/           # schema.prisma
└── package.json              # pnpm workspace root
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/send-otp | No | Send OTP (logged to console) |
| POST | /api/auth/verify-otp | No | Verify OTP, get JWT |
| POST | /api/auth/me | Yes | Get current user |
| GET | /api/users/me | Yes | Full profile + wallet |
| PUT | /api/users/me | Yes | Update username/avatar |
| GET | /api/friends | Yes | List friends |
| GET | /api/friends/requests | Yes | Pending requests |
| POST | /api/friends/request | Yes | Send friend request by phone |
| POST | /api/friends/accept/:id | Yes | Accept request |
| DELETE | /api/friends/:id | Yes | Remove friend |
| GET | /api/wallet | Yes | Balance + transactions |
| POST | /api/wallet/deposit | Yes | Stub (coming soon) |
| POST | /api/games/create | Yes | Create game session |
| POST | /api/games/:id/join | Yes | Join + start game |
| GET | /api/games/history | Yes | Past games |

## Socket Events

**Client → Server:**
- `join_user_room` — subscribe to personal notifications
- `join_game_room(sessionId)` — join game room, get current state
- `game_action({ sessionId, action })` — shoot self / opponent
- `use_item({ sessionId, item, actorId })` — use an item
- `send_game_invite({ sessionId, opponentId, betAmount })` — notify opponent

**Server → Client:**
- `game_state_update` — new game state after every action
- `game_over` — winner, loser, pot info
- `game_invite` — incoming challenge notification

---

## Environment Variables

```
DATABASE_URL         PostgreSQL connection string
JWT_SECRET           Secret for JWT signing (use a long random string in prod)
PORT                 Server port (default 3001)
CLIENT_URL           Frontend URL for CORS (default http://localhost:5173)
TWILIO_ACCOUNT_SID  (optional) For real SMS in production
TWILIO_AUTH_TOKEN   (optional)
TWILIO_PHONE_NUMBER (optional)
```

---

## Production Notes

- Replace the in-memory OTP mock with Twilio by setting the `TWILIO_*` env vars
- Use a proper secrets manager for `JWT_SECRET`
- Enable Stripe integration in `wallet.ts` when ready
- Add rate limiting to OTP endpoints to prevent abuse
- The `gameState` JSON column can get large — consider archiving finished games
