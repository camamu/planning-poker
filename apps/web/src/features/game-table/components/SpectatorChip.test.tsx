import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpectatorChip } from './SpectatorChip.js';

const spectator = {
  id: 'p9',
  displayName: 'Mirón',
  online: true,
  hat: null,
  isFacilitator: false,
};

describe('SpectatorChip', () => {
  afterEach(cleanup);

  it('en escritorio el facilitador tiene los botones de ceder el rol y quitar', () => {
    const onRemove = vi.fn();
    render(<SpectatorChip spectator={spectator} onMakeFacilitator={vi.fn()} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quitar a Mirón' }));

    expect(onRemove).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Hacer facilitador a Mirón' })).toBeInTheDocument();
  });

  it('en el móvil la ficha entera abre las acciones, sin botones pequeños dentro', () => {
    const onOpenActions = vi.fn();
    render(<SpectatorChip spectator={spectator} onOpenActions={onOpenActions} />);

    fireEvent.click(screen.getByRole('button', { name: /Mirón/ }));

    expect(onOpenActions).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Quitar a Mirón' })).not.toBeInTheDocument();
  });

  it('sin permisos es solo una ficha', () => {
    render(<SpectatorChip spectator={spectator} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
