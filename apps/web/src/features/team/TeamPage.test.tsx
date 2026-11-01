import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authenticateTeam,
  listDecks,
  listTeamGames,
  listWebhooks,
} from '../../shared/api/teamsClient.js';
import { useServerStatusStore } from '../../shared/store/serverStatusStore.js';
import { TeamPage } from './TeamPage.js';

vi.mock('../../shared/api/teamsClient.js', () => ({
  authenticateTeam: vi.fn(),
  listDecks: vi.fn(),
  listTeamGames: vi.fn(),
  listWebhooks: vi.fn(),
  saveCustomDeck: vi.fn(),
  updateCustomDeck: vi.fn(),
  deleteCustomDeck: vi.fn(),
}));

const original = useServerStatusStore.getState();

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/t/backend?k=tok']}>
      <Routes>
        <Route path="/t/:slug" element={<TeamPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TeamPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useServerStatusStore.setState({ ...original, status: 'ready' });
    vi.mocked(authenticateTeam).mockResolvedValue({
      id: 'team-1',
      slug: 'backend',
      name: 'Backend',
    });
    vi.mocked(listDecks).mockResolvedValue([
      { id: 'fib', name: 'Fibonacci', cards: ['1', '2', '3'], teamId: null },
    ]);
    vi.mocked(listWebhooks)
      .mockReset()
      .mockResolvedValue([
        {
          id: 'w1',
          url: 'https://hooks.example/jira',
          events: ['issue.estimated'],
          secretHint: 'ab12',
        },
      ]);
    vi.mocked(listTeamGames)
      .mockReset()
      .mockResolvedValue([
        {
          id: 'game-1',
          name: 'Sprint 42',
          createdAt: '2026-08-07T10:00:00.000Z',
          issueCount: 5,
          estimatedCount: 4,
          participantCount: 3,
        },
      ]);
  });
  afterEach(() => {
    cleanup();
    useServerStatusStore.setState(original);
  });

  it('abre en las barajas y no pide las partidas hasta que se abre su pestaña', async () => {
    renderPage();

    expect(await screen.findByText('Fibonacci')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Barajas' })).toHaveAttribute('aria-selected', 'true');
    expect(listTeamGames).not.toHaveBeenCalled();
  });

  it('la pestaña Partidas lista las partidas del equipo y oculta las barajas', async () => {
    renderPage();
    await screen.findByText('Fibonacci');

    fireEvent.click(screen.getByRole('tab', { name: 'Partidas' }));

    expect(await screen.findByText('Sprint 42')).toBeInTheDocument();
    expect(screen.getByText(/4\/5 tareas estimadas/)).toBeInTheDocument();
    expect(screen.queryByText('Fibonacci')).not.toBeInTheDocument();
    expect(listTeamGames).toHaveBeenCalledWith('backend', 'tok', expect.objectContaining({}));
  });

  it('volver a Barajas muestra de nuevo las barajas', async () => {
    renderPage();
    await screen.findByText('Fibonacci');
    fireEvent.click(screen.getByRole('tab', { name: 'Partidas' }));
    await screen.findByText('Sprint 42');

    fireEvent.click(screen.getByRole('tab', { name: 'Barajas' }));

    expect(screen.getByText('Fibonacci')).toBeInTheDocument();
  });

  it('la pestaña Webhooks lista los del equipo y no los pide hasta que se abre', async () => {
    renderPage();
    await screen.findByText('Fibonacci');
    expect(listWebhooks).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: 'Webhooks' }));

    expect(await screen.findByText('https://hooks.example/jira')).toBeInTheDocument();
    expect(listWebhooks).toHaveBeenCalledWith('backend', 'tok');
    expect(screen.queryByText('Fibonacci')).not.toBeInTheDocument();
  });
});
