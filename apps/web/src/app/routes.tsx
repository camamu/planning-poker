import type { JSX } from 'react';
import { Route, Routes } from 'react-router-dom';
import { CreateGamePage } from '../features/create-game/CreateGamePage.js';
import { CreateTeamPage } from '../features/team/CreateTeamPage.js';
import { TeamPage } from '../features/team/TeamPage.js';
import { GameRoute } from './GameRoute.js';

export function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<CreateGamePage />} />
      <Route path="/games/:gameId" element={<GameRoute />} />
      <Route path="/teams/new" element={<CreateTeamPage />} />
      <Route path="/t/:slug" element={<TeamPage />} />
    </Routes>
  );
}
