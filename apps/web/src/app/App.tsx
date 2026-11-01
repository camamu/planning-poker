import type { JSX } from 'react';
import { useLocation } from 'react-router-dom';
import { ServerWakeBanner } from '../features/server-status/ServerWakeBanner.js';
import { AppRoutes } from './routes.js';

export function App(): JSX.Element {
  // La portada no necesita la API: la despierta en silencio, sin el aviso (ADR 0029).
  const onLanding = useLocation().pathname === '/';
  return (
    <>
      {onLanding ? null : <ServerWakeBanner />}
      <AppRoutes />
    </>
  );
}
