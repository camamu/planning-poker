import type { DeckSummaryView } from '@pp/contracts';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listDecks } from '../../shared/api/teamsClient.js';
import { rememberGame } from '../../shared/games/rememberedGames.js';
import { useServerStatusStore } from '../../shared/store/serverStatusStore.js';
import { CreateGamePage } from './CreateGamePage.js';

vi.mock('../../shared/api/teamsClient.js', () => ({ listDecks: vi.fn() }));

const original = useServerStatusStore.getState();
const fibonacci: DeckSummaryView = {
  id: 'fib',
  name: 'Fibonacci',
  cards: ['1', '2', '3'],
  teamId: null,
};

function renderPage(url = '/'): void {
  render(
    <MemoryRouter initialEntries={[url]}>
      <CreateGamePage />
    </MemoryRouter>,
  );
}

describe('CreateGamePage', () => {
  beforeEach(() => {
    vi.mocked(listDecks).mockReset().mockResolvedValue([fibonacci]);
    useServerStatusStore.setState({ ...original, status: 'waking' });
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    useServerStatusStore.setState(original);
  });

  it('espera a que el servidor responda para pedir las barajas y no deja crear la partida', () => {
    renderPage();

    expect(listDecks).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Crear y repartir' })).toBeDisabled();
    expect(screen.getByText(/Esperando a que el servidor despierte/)).toBeInTheDocument();
  });

  it('al despertar el servidor carga las barajas sola y habilita crear la partida', async () => {
    renderPage();

    act(() => {
      useServerStatusStore.setState({ status: 'ready' });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Crear y repartir' })).toBeEnabled();
    });
    expect(listDecks).toHaveBeenCalledOnce();
    expect(screen.getByText('Fibonacci')).toBeInTheDocument();
  });

  describe('partidas recientes', () => {
    it('sin partidas recordadas no muestra la sección', () => {
      renderPage();

      expect(screen.queryByText('Partidas recientes')).not.toBeInTheDocument();
    });

    it('lista las partidas recordadas, la última visitada primero, con enlace a la sala', () => {
      rememberGame({ id: 'game-1', name: 'Sprint 41' });
      rememberGame({ id: 'game-2', name: 'Sprint 42' });

      renderPage();

      expect(screen.getByText('Partidas recientes')).toBeInTheDocument();
      const names = screen.getAllByText(/^Sprint 4/).map((element) => element.textContent);
      expect(names).toEqual(['Sprint 42', 'Sprint 41']);
      expect(screen.getAllByRole('link', { name: 'Entrar' })[0]).toHaveAttribute(
        'href',
        '/games/game-2',
      );
    });

    it('quitar una partida la saca de la lista y del navegador', () => {
      rememberGame({ id: 'game-1', name: 'Sprint 41' });
      rememberGame({ id: 'game-2', name: 'Sprint 42' });
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Quitar Sprint 42 de la lista' }));

      expect(screen.queryByText('Sprint 42')).not.toBeInTheDocument();
      expect(screen.getByText('Sprint 41')).toBeInTheDocument();
      expect(localStorage.getItem('pp:games')).not.toContain('game-2');
    });

    it('al crear la partida de un equipo no distrae con las recientes', () => {
      rememberGame({ id: 'game-1', name: 'Sprint 41' });

      renderPage('/?team=backend');

      expect(screen.queryByText('Partidas recientes')).not.toBeInTheDocument();
    });
  });
});
