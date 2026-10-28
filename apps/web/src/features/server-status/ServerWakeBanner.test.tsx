import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useServerStatusStore } from '../../shared/store/serverStatusStore.js';
import { ServerNotReadyNote } from './ServerNotReadyNote.js';
import { ServerWakeBanner } from './ServerWakeBanner.js';

const original = useServerStatusStore.getState();

describe('aviso del estado del servidor', () => {
  beforeEach(() => {
    useServerStatusStore.setState({ ...original, status: 'checking' });
  });
  afterEach(() => {
    cleanup();
    useServerStatusStore.setState(original);
  });

  it('no muestra el banner mientras comprueba ni cuando el servidor ya está listo', () => {
    const { container } = render(<ServerWakeBanner />);
    expect(container).toBeEmptyDOMElement();

    useServerStatusStore.setState({ status: 'ready' });
    cleanup();
    const ready = render(<ServerWakeBanner />);
    expect(ready.container).toBeEmptyDOMElement();
  });

  it('explica que el servidor está despertando y cuánto puede tardar', () => {
    useServerStatusStore.setState({ status: 'waking' });
    render(<ServerWakeBanner />);

    expect(screen.getByRole('status')).toHaveTextContent('Despertando el servidor');
    expect(screen.getByRole('status')).toHaveTextContent('hasta un minuto');
  });

  it('si el servidor no responde ofrece reintentar', () => {
    const retry = vi.fn();
    useServerStatusStore.setState({ status: 'unreachable', retry });
    render(<ServerWakeBanner />);

    expect(screen.getByRole('alert')).toHaveTextContent('No se puede conectar con el servidor');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(retry).toHaveBeenCalledOnce();
  });

  it('la nota bajo los botones da el motivo mientras el servidor no esté listo', () => {
    useServerStatusStore.setState({ status: 'waking' });
    const { container } = render(<ServerNotReadyNote />);
    expect(screen.getByRole('status')).toHaveTextContent('Esperando a que el servidor despierte');

    act(() => {
      useServerStatusStore.setState({ status: 'ready' });
    });
    expect(container).toBeEmptyDOMElement();
  });
});
