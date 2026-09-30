import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPage } from './AdminPage.js';

interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly authorization: string | null;
}

const GAME = {
  id: 'game-1',
  name: 'Sprint 42',
  team: { id: 'team-1', name: 'Backend' },
  participantCount: 3,
  issueCount: 4,
  estimatedIssueCount: 2,
  createdAt: '2026-08-07T10:00:00.000Z',
};

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('AdminPage', () => {
  let calls: RecordedCall[];
  let games: unknown[];
  let sessionExpired: boolean;

  beforeEach(() => {
    sessionStorage.clear();
    calls = [];
    games = [GAME];
    sessionExpired = false;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        const headers = new Headers(init?.headers);
        calls.push({ url: input, method, authorization: headers.get('authorization') });
        if (input.endsWith('/api/admin/session')) {
          const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
          const valid =
            typeof body === 'object' &&
            body !== null &&
            'password' in body &&
            body.password === 'correcta';
          return Promise.resolve(
            valid
              ? jsonResponse(201, { token: 'tok', expiresAt: '2999-01-01T00:00:00.000Z' })
              : jsonResponse(401, { message: 'Usuario o contraseña incorrectos.' }),
          );
        }
        if (sessionExpired) {
          return Promise.resolve(jsonResponse(401, { message: 'La sesión ha caducado.' }));
        }
        if (input.endsWith('/api/admin/games') && method === 'GET') {
          return Promise.resolve(jsonResponse(200, games));
        }
        if (input.endsWith('/api/admin/games/game-1') && method === 'DELETE') {
          games = [];
          return Promise.resolve(jsonResponse(204));
        }
        return Promise.resolve(jsonResponse(404, { message: 'no encontrado' }));
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function renderPage(): void {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );
  }

  function logIn(password: string): void {
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  }

  it('muestra el error del servidor si las credenciales no son válidas', async () => {
    renderPage();
    logIn('incorrecta');

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.');
  });

  it('tras entrar lista las salas y permite borrar una con confirmación', async () => {
    renderPage();
    logIn('correcta');

    expect(await screen.findByText('Sprint 42')).toBeInTheDocument();
    expect(screen.getByText(/3 participantes · 2\/4 tareas estimadas/)).toBeInTheDocument();
    expect(calls.find((call) => call.url.endsWith('/api/admin/games'))?.authorization).toBe(
      'Bearer tok',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Borrar sala' }));

    expect(await screen.findByText('No hay salas.')).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'DELETE')).toBe(true);
  });

  it('vuelve al login si la sesión guardada ya no es válida en el servidor', async () => {
    sessionStorage.setItem(
      'pp:admin-session',
      JSON.stringify({ token: 'vieja', expiresAt: '2999-01-01T00:00:00.000Z' }),
    );
    sessionExpired = true;
    renderPage();

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(sessionStorage.getItem('pp:admin-session')).toBeNull();
  });

  it('filtra las salas con la búsqueda', async () => {
    renderPage();
    logIn('correcta');
    await screen.findByText('Sprint 42');

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'frontend' } });

    await waitFor(() => {
      expect(screen.queryByText('Sprint 42')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Ninguna sala coincide con la búsqueda.')).toBeInTheDocument();
  });
});
