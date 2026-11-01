import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { JSX } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rememberGame } from '../../shared/games/rememberedGames.js';
import { rememberTeam } from '../../shared/team/rememberedTeams.js';
import { LandingPage } from './LandingPage.js';

function Where(): JSX.Element {
  return <p>{`en ${useLocation().pathname}`}</p>;
}

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  beforeEach(() => {
    localStorage.clear();
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
    vi.unstubAllGlobals();
  });

  it('«Crear sala» lleva al formulario de crear partida', () => {
    renderPage();
    fireEvent.click(screen.getByRole('link', { name: 'Crear sala' }));
    expect(screen.getByText('en /games/new')).toBeInTheDocument();
  });

  it('no enseña «Volver a lo tuyo» si el navegador no recuerda nada', () => {
    renderPage();
    expect(screen.queryByRole('navigation', { name: 'Volver a lo tuyo' })).not.toBeInTheDocument();
  });

  it('lista los equipos y las partidas que recuerda el navegador', () => {
    rememberTeam({ slug: 'plataforma', name: 'Plataforma', token: 'tok' });
    rememberGame({ id: 'g1', name: 'Refinamiento sprint 42' });
    renderPage();

    const shortcuts = screen.getByRole('navigation', { name: 'Volver a lo tuyo' });
    expect(within(shortcuts).getByRole('link', { name: /Plataforma/ })).toHaveAttribute(
      'href',
      '/t/plataforma?k=tok',
    );
    expect(within(shortcuts).getByRole('link', { name: /Refinamiento sprint 42/ })).toHaveAttribute(
      'href',
      '/games/g1',
    );
  });

  it('no hace ninguna petición a la API para pintarse', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderPage();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('enseña cada grupo de funcionalidades', () => {
    renderPage();
    for (const group of ['Votación', 'Resultados', 'Sala', 'Equipos']) {
      expect(screen.getByRole('heading', { level: 3, name: group })).toBeInTheDocument();
    }
  });
});
