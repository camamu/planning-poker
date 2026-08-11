import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

let socket: Socket | undefined;

/** Conexión única al servidor, creada perezosamente y reutilizada por toda la app. */
export function getSocket(): Socket {
  socket ??= io(import.meta.env.VITE_WS_URL, { autoConnect: false, transports: ['websocket'] });
  return socket;
}
