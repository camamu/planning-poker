import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Banner } from './Banner.js';

describe('Banner', () => {
  afterEach(cleanup);

  it('muestra el mensaje como región de estado en la variante informativa', () => {
    render(<Banner message="Despertando el servidor…" />);

    expect(screen.getByRole('status')).toHaveTextContent('Despertando el servidor…');
    expect(screen.getByRole('status')).toHaveClass('pp-banner-info');
  });

  it('se anuncia como alerta en la variante de error', () => {
    render(<Banner variant="error" message="No hay conexión" />);

    expect(screen.getByRole('alert')).toHaveClass('pp-banner-error');
  });

  it('muestra la acción solo si se pasa y la invoca al pulsarla', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Banner message="Sin servidor" />);
    expect(screen.queryByRole('button')).toBeNull();

    rerender(<Banner message="Sin servidor" action={{ label: 'Reintentar', onClick }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
