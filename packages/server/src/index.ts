import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { friendsRouter } from './routes/friends';
import { gamesRouter } from './routes/games';
import { walletRouter } from './routes/wallet';
import { registerGameHandlers } from './socket/gameHandler';

const app = express();
const httpServer = createServer(app);

const IS_PROD = process.env.NODE_ENV === 'production';
// In production the client is served from this same server, so no cross-origin needed.
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const corsOrigin = IS_PROD ? false : CLIENT_URL;

const io = new Server(httpServer, {
  cors: IS_PROD ? {} : {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/games', gamesRouter);
app.use('/api/wallet', walletRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  registerGameHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Serve the React build in production
const clientDist = path.resolve(__dirname, '../../client/dist');
if (IS_PROD && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Export io for use in routes
export { io };

const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, () => {
  console.log(`[Server] Buckshot Bet server running on http://localhost:${PORT}`);
  if (IS_PROD) {
    console.log(`[Server] Serving React app from ${clientDist}`);
  } else {
    console.log(`[Server] Accepting connections from ${CLIENT_URL}`);
  }
});
