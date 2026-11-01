import type { Socket } from 'socket.io-client';

/** Envuelve el próximo evento `event` de `socket` en una promesa, tipado por el llamador. */
export function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => {
    socket.once(event, (payload: T) => {
      resolve(payload);
    });
  });
}

/** Espera a que `socket` haya recibido `count` eventos `event` y devuelve sus payloads en orden. */
export function onceEach<T>(socket: Socket, event: string, count: number): Promise<T[]> {
  return new Promise((resolve) => {
    const received: T[] = [];
    const listener = (payload: T): void => {
      received.push(payload);
      if (received.length < count) return;
      socket.off(event, listener);
      resolve(received);
    };
    socket.on(event, listener);
  });
}

/** Guarda todo lo que recibe `socket`, de cualquier evento, para inspeccionar el payload crudo. */
export function recordEverything(socket: Socket): unknown[] {
  const received: unknown[] = [];
  socket.onAny((_event: string, payload: unknown) => {
    received.push(payload);
  });
  return received;
}
