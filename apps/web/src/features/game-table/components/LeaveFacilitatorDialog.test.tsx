import type { ParticipantView } from '@pp/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeaveFacilitatorDialog } from './LeaveFacilitatorDialog.js';

const participant = (id: string, displayName: string, online = true): ParticipantView => ({
  id,
  displayName,
  role: 'VOTER',
  isFacilitator: false,
  online,
  hat: null,
});

describe('LeaveFacilitatorDialog', () => {
  afterEach(cleanup);

  it('no deja ceder y salir hasta elegir a alguien', () => {
    const onConfirm = vi.fn();
    render(
      <LeaveFacilitatorDialog
        open
        candidates={[participant('p2', 'Grace'), participant('p3', 'Linus')]}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );
    const confirm = screen.getByRole('button', { name: 'Ceder y salir' });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: 'Linus' }));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith('p3');
  });

  it('lista primero a los conectados y marca a los desconectados', () => {
    render(
      <LeaveFacilitatorDialog
        open
        candidates={[participant('p2', 'Grace', false), participant('p3', 'Linus')]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'p3',
      'p2',
    ]);
    expect(screen.getByText('desconectado')).toBeInTheDocument();
  });

  it('olvida la elección al cancelar', () => {
    const { rerender } = render(
      <LeaveFacilitatorDialog
        open
        candidates={[participant('p2', 'Grace')]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Grace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    rerender(
      <LeaveFacilitatorDialog
        open
        candidates={[participant('p2', 'Grace')]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Ceder y salir' })).toBeDisabled();
  });

  it('descarta la elección si esa persona se va mientras el diálogo está abierto', () => {
    const { rerender } = render(
      <LeaveFacilitatorDialog
        open
        candidates={[participant('p2', 'Grace'), participant('p3', 'Linus')]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Grace' }));

    rerender(
      <LeaveFacilitatorDialog
        open
        candidates={[participant('p3', 'Linus')]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Ceder y salir' })).toBeDisabled();
  });

  it('explica que no se puede salir si no hay a quién ceder el rol', () => {
    const onClose = vi.fn();
    render(<LeaveFacilitatorDialog open candidates={[]} onConfirm={vi.fn()} onClose={onClose} />);

    expect(screen.getByText(/única persona de la partida/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ceder y salir' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
