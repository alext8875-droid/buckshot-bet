import { io, Socket } from 'socket.io-client';

// In dev the client runs on :5173 and the server on :3001 (separate processes).
// In production the server serves the client, so they share the same origin.
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: {
        token: localStorage.getItem('bb_token') || '',
      },
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { token: localStorage.getItem('bb_token') || '' };
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
