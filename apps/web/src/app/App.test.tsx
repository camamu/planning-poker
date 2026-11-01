import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useServerStatusStore } from '../shared/store/serverStatusStore.js';
import { App } from './App.js';

vi.mock('./routes.js', () => ({ AppRoutes: () => null }));

const original = useServerStatusStore.getState();

function renderAt(url: string): void {
  render(
    <MemoryRouter initialEntries={[url]}>
      <App />
    </MemoryRouter>,
  );
}

describe('aviso de servidor dormido según la página', () => {
  beforeEach(() => {
    useServerStatusStore.setState({ ...original, status: 'waking' });
  });
  afterEach(() => {
    cleanup();
    useServerStatusStore.setState(original);
  });

  it('la página principal despierta la API en silencio, sin el aviso', () => {
    renderAt('/');
    expect(screen.queryByText(/Despertando el servidor/)).not.toBeInTheDocument();
  });

  it('el resto de páginas, que sí necesitan la API, enseñan el aviso', () => {
    renderAt('/games/new');
    expect(screen.getByText(/Despertando el servidor/)).toBeInTheDocument();
  });
});
