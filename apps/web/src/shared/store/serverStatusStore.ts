import { create } from 'zustand';
import { createServerWarmup } from '../api/serverWarmup.js';
import type { ServerStatus } from '../api/serverWarmup.js';

interface ServerStatusState {
  readonly status: ServerStatus;
  /** Llamar una vez al cargar la app; repetirlo no hace nada. */
  start: () => void;
  /** Tras `unreachable`: vuelve a intentarlo. */
  retry: () => void;
}

export const useServerStatusStore = create<ServerStatusState>((set) => {
  const warmup = createServerWarmup({
    healthUrl: `${import.meta.env.VITE_API_URL}/health`,
    fetch: (input, init) => fetch(input, init),
    onStatus: (status) => {
      set({ status });
    },
  });

  return {
    status: 'checking',
    start: warmup.start,
    retry: warmup.retry,
  };
});

export function useServerReady(): boolean {
  return useServerStatusStore((state) => state.status === 'ready');
}
