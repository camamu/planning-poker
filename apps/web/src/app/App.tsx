import type { JSX } from 'react';
import { ServerWakeBanner } from '../features/server-status/ServerWakeBanner.js';
import { AppRoutes } from './routes.js';

export function App(): JSX.Element {
  return (
    <>
      <ServerWakeBanner />
      <AppRoutes />
    </>
  );
}
