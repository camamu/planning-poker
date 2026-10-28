import type { DeckSummaryView } from '@pp/contracts';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listDecks } from '../../shared/api/teamsClient.js';
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

function renderPage(): void {
  render(
    <MemoryRouter>
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
});
