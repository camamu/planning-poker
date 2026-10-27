import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useServerStatusStore } from '../../shared/store/serverStatusStore.js';
import { CreateTeamPage } from './CreateTeamPage.js';

const original = useServerStatusStore.getState();

describe('CreateTeamPage', () => {
  beforeEach(() => {
    useServerStatusStore.setState({ ...original, status: 'checking' });
  });
  afterEach(() => {
    cleanup();
    useServerStatusStore.setState(original);
  });

  it('no deja crear el equipo hasta que el servidor responde y explica por qué', () => {
    useServerStatusStore.setState({ status: 'unreachable' });
    render(
      <MemoryRouter>
        <CreateTeamPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Crear equipo' })).toBeDisabled();
    expect(screen.getByText(/El servidor no responde/)).toBeInTheDocument();

    act(() => {
      useServerStatusStore.setState({ status: 'ready' });
    });

    expect(screen.getByRole('button', { name: 'Crear equipo' })).toBeEnabled();
  });
});
