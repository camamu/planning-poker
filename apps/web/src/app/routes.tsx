import type { JSX } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AdminPage } from '../features/admin/AdminPage.js';
import { CreateGamePage } from '../features/create-game/CreateGamePage.js';
import { LandingPage } from '../features/landing/LandingPage.js';
import { SessionSummaryPage } from '../features/session-summary/SessionSummaryPage.js';
import { CreateTeamPage } from '../features/team/CreateTeamPage.js';
import { TeamPage } from '../features/team/TeamPage.js';
import { GameRoute } from './GameRoute.js';

export function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/games/new" element={<CreateGamePage />} />
      <Route path="/games/:gameId" element={<GameRoute />} />
      <Route path="/games/:gameId/summary" element={<SessionSummaryPage />} />
      <Route path="/teams/new" element={<CreateTeamPage />} />
      <Route path="/t/:slug" element={<TeamPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}

/**
 * Antes de la página principal, `/?team=…&deckId=…` era el formulario de crear partida con las
 * barajas del equipo, y hay enlaces guardados así (ADR 0029): siguen llevando al formulario.
 */
function HomeRoute(): JSX.Element {
  const { search } = useLocation();
  if (new URLSearchParams(search).has('team')) {
    return <Navigate to={`/games/new${search}`} replace />;
  }
  return <LandingPage />;
}
