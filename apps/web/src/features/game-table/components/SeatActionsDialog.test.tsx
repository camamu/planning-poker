import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeatActionsDialog } from './SeatActionsDialog.js';

describe('SeatActionsDialog', () => {
  afterEach(cleanup);

  it('cede el rol o quita a esa persona sin pedir otra confirmación', () => {
    const onMakeFacilitator = vi.fn();
    const onRemove = vi.fn();
    render(
      <SeatActionsDialog
        participant={{ id: 'p2', displayName: 'Marcos' }}
        onMakeFacilitator={onMakeFacilitator}
        onRemove={onRemove}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Hacer facilitador/ }));
    fireEvent.click(screen.getByRole('button', { name: /Quitar de la partida/ }));

    expect(onMakeFacilitator).toHaveBeenCalledWith('p2');
    expect(onRemove).toHaveBeenCalledWith('p2');
  });

  it('cerrado cuando no hay nadie elegido', () => {
    render(
      <SeatActionsDialog
        participant={null}
        onMakeFacilitator={vi.fn()}
        onRemove={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
