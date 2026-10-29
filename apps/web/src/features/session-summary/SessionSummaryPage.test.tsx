import type { GameSummaryIssueView, GameSummaryView } from '@pp/contracts';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGameSummary } from '../../shared/api/gamesClient.js';
import { useServerStatusStore } from '../../shared/store/serverStatusStore.js';
import { SessionSummaryPage } from './SessionSummaryPage.js';

vi.mock('../../shared/api/gamesClient.js', () => ({ getGameSummary: vi.fn() }));

const original = useServerStatusStore.getState();

function issue(overrides: Partial<GameSummaryIssueView> = {}): GameSummaryIssueView {
  return {
    id: 'issue-1',
    title: 'Login',
    description: null,
    externalUrl: null,
    status: 'ESTIMATED',
    finalEstimate: '5',
    rounds: 1,
    agreementPercentage: 100,
    average: 5,
    durationMs: 180_000,
    ...overrides,
  };
}

function summary(overrides: Partial<GameSummaryView> = {}): GameSummaryView {
  return {
    id: 'game-1',
    name: 'Sprint 42',
    issues: [issue()],
    totals: {
      estimatedCount: 1,
      pendingCount: 0,
      points: 5,
      nonNumericEstimates: {},
      unanimousCount: 1,
      multiRoundCount: 0,
      averageDurationMs: 180_000,
      voterCount: 3,
    },
    ...overrides,
  };
}

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/games/game-1/summary']}>
      <Routes>
        <Route path="/games/:gameId/summary" element={<SessionSummaryPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SessionSummaryPage', () => {
  beforeEach(() => {
    useServerStatusStore.setState({ ...original, status: 'ready' });
    vi.mocked(getGameSummary).mockReset();
  });
  afterEach(() => {
    cleanup();
    useServerStatusStore.setState(original);
  });

  it('muestra el nombre de la partida, los totales y una fila por tarea', async () => {
    vi.mocked(getGameSummary).mockResolvedValue(summary());

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Sprint 42' })).toBeInTheDocument();
    expect(getGameSummary).toHaveBeenCalledWith('game-1');
    const totals = screen.getByRole('region', { name: 'Totales de la sesión' });
    expect(within(totals).getByText('1 / 1')).toBeInTheDocument();
    expect(within(totals).getByText('Puntos estimados')).toBeInTheDocument();
    expect(within(totals).getByText('3 min')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a la sala' })).toHaveAttribute(
      'href',
      '/games/game-1',
    );
    expect(screen.getByRole('row', { name: /Login/ })).toHaveTextContent('100%');
  });

  it('resalta las tareas con bajo acuerdo o con varias rondas y deja las demás sin resaltar', async () => {
    vi.mocked(getGameSummary).mockResolvedValue(
      summary({
        issues: [
          issue({ id: 'a', title: 'Sin problema' }),
          issue({ id: 'b', title: 'Discutida', agreementPercentage: 40, rounds: 3 }),
          issue({ id: 'c', title: 'Repetida', rounds: 2 }),
        ],
      }),
    );

    renderPage();

    const calm = await screen.findByRole('row', { name: /Sin problema/ });
    const disputed = screen.getByRole('row', { name: /Discutida/ });
    const repeated = screen.getByRole('row', { name: /Repetida/ });
    expect(calm).not.toHaveAttribute('data-attention');
    expect(disputed).toHaveAttribute('data-attention', 'true');
    expect(within(disputed).getByText('Sin consenso')).toBeInTheDocument();
    expect(within(disputed).getByText('3 rondas')).toBeInTheDocument();
    expect(repeated).toHaveAttribute('data-attention', 'true');
    expect(within(repeated).queryByText('Sin consenso')).not.toBeInTheDocument();
  });

  it('enseña un guion en las duraciones de las partidas anteriores a los tiempos', async () => {
    vi.mocked(getGameSummary).mockResolvedValue(
      summary({
        issues: [issue({ durationMs: null })],
        totals: { ...summary().totals, averageDurationMs: null },
      }),
    );

    renderPage();

    const row = await screen.findByRole('row', { name: /Login/ });
    expect(within(row).getByText('—')).toBeInTheDocument();
    const totals = screen.getByRole('region', { name: 'Totales de la sesión' });
    expect(within(totals).getByText('—')).toBeInTheDocument();
  });

  it('con una baraja de tallas cuenta cada valor en vez de sumar y marca las pendientes', async () => {
    vi.mocked(getGameSummary).mockResolvedValue(
      summary({
        issues: [
          issue({ id: 'a', title: 'Login', finalEstimate: 'M' }),
          issue({
            id: 'b',
            title: 'Pagos',
            status: 'PENDING',
            finalEstimate: null,
            rounds: 0,
            agreementPercentage: null,
            average: null,
            durationMs: null,
          }),
        ],
        totals: {
          ...summary().totals,
          estimatedCount: 1,
          pendingCount: 1,
          points: null,
          nonNumericEstimates: { M: 1 },
        },
      }),
    );

    renderPage();

    const totals = await screen.findByRole('region', { name: 'Totales de la sesión' });
    expect(within(totals).getByText('Estimaciones')).toBeInTheDocument();
    expect(within(totals).getByText('M ×1')).toBeInTheDocument();
    expect(within(totals).getByText('1 sin estimar')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Pagos/ })).getByText('Pendiente')).toBeVisible();
  });

  it('enlaza la tarea a su URL externa cuando la tiene', async () => {
    vi.mocked(getGameSummary).mockResolvedValue(
      summary({ issues: [issue({ externalUrl: 'https://jira.example/PP-1' })] }),
    );

    renderPage();

    expect(await screen.findByRole('link', { name: 'Login' })).toHaveAttribute(
      'href',
      'https://jira.example/PP-1',
    );
  });

  it('avisa de que la partida no tiene tareas', async () => {
    vi.mocked(getGameSummary).mockResolvedValue(summary({ issues: [] }));

    renderPage();

    expect(await screen.findByText('Esta partida todavía no tiene tareas.')).toBeInTheDocument();
  });

  it('muestra el error del servidor, por ejemplo una partida que no existe', async () => {
    vi.mocked(getGameSummary).mockRejectedValue(new Error('No existe la partida game-1.'));

    renderPage();

    expect(await screen.findByText('No existe la partida game-1.')).toBeInTheDocument();
  });

  it('no pide el resumen hasta que la API está despierta', () => {
    useServerStatusStore.setState({ ...original, status: 'checking' });

    renderPage();

    expect(getGameSummary).not.toHaveBeenCalled();
    expect(screen.getByText('Cargando resumen…')).toBeInTheDocument();
  });
});
