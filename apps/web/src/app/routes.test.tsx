import { cleanup, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './routes.js';

function LocationProbe({ label }: { readonly label: string }): JSX.Element {
  const location = useLocation();
  return <p>{`${label} ${location.pathname}${location.search}`}</p>;
}

vi.mock('../features/create-game/CreateGamePage.js', () => ({
  CreateGamePage: () => <LocationProbe label="formulario" />,
}));
vi.mock('./GameRoute.js', () => ({ GameRoute: () => <LocationProbe label="sala" /> }));

function renderAt(url: string): void {
  render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('rutas', () => {
  beforeAll(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
  });
  afterEach(() => {
    cleanup();
  });

  it('/ pinta la página principal', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Estimad tareas en equipo');
  });

  it('/games/new pinta el formulario de crear partida, no la sala', () => {
    renderAt('/games/new');
    expect(screen.getByText('formulario /games/new')).toBeInTheDocument();
  });

  it('un enlace antiguo de equipo redirige al formulario con los mismos parámetros', () => {
    renderAt('/?team=x&deckId=y');
    expect(screen.getByText('formulario /games/new?team=x&deckId=y')).toBeInTheDocument();
  });

  it('/games/:id sigue siendo la sala', () => {
    renderAt('/games/abc');
    expect(screen.getByText('sala /games/abc')).toBeInTheDocument();
  });
});
