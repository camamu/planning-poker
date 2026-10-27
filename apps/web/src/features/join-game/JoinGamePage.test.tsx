import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useServerStatusStore } from '../../shared/store/serverStatusStore.js';
import { JoinGamePage } from './JoinGamePage.js';

const original = useServerStatusStore.getState();

describe('JoinGamePage', () => {
  beforeEach(() => {
    useServerStatusStore.setState({ ...original, status: 'checking' });
  });
  afterEach(() => {
    cleanup();
    useServerStatusStore.setState(original);
  });

  it('no deja unirse hasta que el servidor responde y explica por qué', () => {
    useServerStatusStore.setState({ status: 'waking' });
    render(<JoinGamePage gameId="g1" onJoined={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Sentarme a la mesa' })).toBeDisabled();
    expect(screen.getByText(/Esperando a que el servidor despierte/)).toBeInTheDocument();

    act(() => {
      useServerStatusStore.setState({ status: 'ready' });
    });

    expect(screen.getByRole('button', { name: 'Sentarme a la mesa' })).toBeEnabled();
    expect(screen.queryByText(/Esperando a que el servidor despierte/)).toBeNull();
  });
});
