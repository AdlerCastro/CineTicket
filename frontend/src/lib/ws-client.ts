import { io, type Socket } from 'socket.io-client';

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, '') ?? 'ws://localhost:3333';

export function createSeatSocket(): Socket {
  return io(WS_URL, { autoConnect: false });
}
