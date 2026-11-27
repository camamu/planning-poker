import type { JSX } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ServerWakeBanner } from '../features/server-status/ServerWakeBanner.js';
import { useSeason } from '../shared/season/season.js';
import { AppRoutes } from './routes.js';

export function App(): JSX.Element {
  // La portada no necesita la API: la despierta en silencio, sin el aviso (ADR 0029).
  const onLanding = useLocation().pathname === '/';
  const season = useSeason();

  // Igual que `data-theme`: los tokens y dibujos de temporada cuelgan de este atributo (ADR 0031).
  useEffect(() => {
    if (season) document.documentElement.setAttribute('data-season', season);
    else document.documentElement.removeAttribute('data-season');
  }, [season]);

  return (
    <>
      {onLanding ? null : <ServerWakeBanner />}
      <AppRoutes />
    </>
  );
}
