import type { Socket } from 'socket.io-client';

/** Envuelve el próximo evento `event` de `socket` en una promesa, tipado por el llamador. */
export function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => {
    socket.once(event, (payload: T) => {
      resolve(payload);
    });
  });
}
