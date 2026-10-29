import type { TeamGameView } from '@pp/contracts';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listTeamGames } from '../../../shared/api/teamsClient.js';
import { TEAM_GAMES_PAGE_SIZE } from '../useTeamGames.js';
import { TeamGamesList } from './TeamGamesList.js';

vi.mock('../../../shared/api/teamsClient.js', () => ({ listTeamGames: vi.fn() }));

function game(index: number, overrides: Partial<TeamGameView> = {}): TeamGameView {
  return {
    id: `game-${index.toString()}`,
    name: `Partida ${index.toString()}`,
    createdAt: new Date(Date.UTC(2026, 7, 7, 10, 0, 0) - index * 60_000).toISOString(),
    issueCount: 3,
    estimatedCount: 2,
    participantCount: 4,
    ...overrides,
  };
}

function renderList(): void {
  render(
    <MemoryRouter>
      <TeamGamesList slug="backend" token="tok" />
    </MemoryRouter>,
  );
}

describe('TeamGamesList', () => {
  beforeEach(() => {
    vi.mocked(listTeamGames).mockReset();
  });
  afterEach(() => {
    cleanup();
  });

  it('lista las partidas con sus tareas estimadas y un enlace a la sala', async () => {
    vi.mocked(listTeamGames).mockResolvedValue([game(1), game(2, { participantCount: 1 })]);

    renderList();

    expect(await screen.findByText('Partida 1')).toBeInTheDocument();
    expect(screen.getAllByText(/2\/3 tareas estimadas/)).toHaveLength(2);
    expect(screen.getByText(/4 participantes/)).toBeInTheDocument();
    expect(screen.getByText(/1 participante$/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Abrir' })[0]).toHaveAttribute(
      'href',
      '/games/game-1',
    );
    expect(screen.getAllByRole('link', { name: 'Resumen' })[0]).toHaveAttribute(
      'href',
      '/games/game-1/summary',
    );
    expect(listTeamGames).toHaveBeenCalledWith('backend', 'tok', {
      limit: TEAM_GAMES_PAGE_SIZE,
      before: undefined,
    });
  });

  it('explica que no hay partidas cuando el equipo todavía no ha creado ninguna', async () => {
    vi.mocked(listTeamGames).mockResolvedValue([]);

    renderList();

    expect(await screen.findByText(/todavía no tiene partidas/)).toBeInTheDocument();
  });

  it('con una página corta no ofrece ver más', async () => {
    vi.mocked(listTeamGames).mockResolvedValue([game(1)]);

    renderList();

    await screen.findByText('Partida 1');
    expect(screen.queryByRole('button', { name: /partidas anteriores/ })).not.toBeInTheDocument();
  });

  it('con una página llena pide la siguiente a partir de la última partida vista', async () => {
    const firstPage = Array.from({ length: TEAM_GAMES_PAGE_SIZE }, (_, index) => game(index + 1));
    const last = firstPage.at(-1);
    vi.mocked(listTeamGames)
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([game(99, { name: 'La más antigua' })]);

    renderList();
    fireEvent.click(await screen.findByRole('button', { name: /partidas anteriores/ }));

    expect(await screen.findByText('La más antigua')).toBeInTheDocument();
    expect(screen.getByText('Partida 1')).toBeInTheDocument();
    expect(listTeamGames).toHaveBeenLastCalledWith('backend', 'tok', {
      limit: TEAM_GAMES_PAGE_SIZE,
      before: last?.createdAt,
    });
    expect(screen.queryByRole('button', { name: /partidas anteriores/ })).not.toBeInTheDocument();
  });

  it('muestra el error y permite reintentar', async () => {
    vi.mocked(listTeamGames)
      .mockRejectedValueOnce(new Error('El servidor no responde.'))
      .mockResolvedValueOnce([game(1)]);

    renderList();
    expect(await screen.findByText('El servidor no responde.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(screen.getByText('Partida 1')).toBeInTheDocument();
    });
    expect(screen.queryByText('El servidor no responde.')).not.toBeInTheDocument();
  });
});
