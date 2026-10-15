import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParticipantSeat } from './ParticipantSeat.js';
import type { ParticipantSeatProps } from './ParticipantSeat.js';

const baseProps: ParticipantSeatProps = {
  participantId: 'p2',
  displayName: 'Grace',
  seat: { left: '50%', top: '50%' },
  isDealer: false,
  isViewer: false,
  online: true,
  card: null,
};

describe('ParticipantSeat', () => {
  afterEach(cleanup);

  it('atenúa el asiento de quien está desconectado y lo explica al pasar el ratón', () => {
    const { container } = render(<ParticipantSeat {...baseProps} online={false} />);
    const seat = container.firstElementChild as HTMLElement;

    expect(seat.style.opacity).toBe('0.45');
    expect(seat).toHaveAttribute('title', 'Grace está desconectado');
  });

  it('muestra el asiento a pleno color cuando está conectado', () => {
    const { container } = render(<ParticipantSeat {...baseProps} />);

    expect((container.firstElementChild as HTMLElement).style.opacity).toBe('1');
  });

  it('solo ofrece quitar al participante cuando se le pasa onRemove', () => {
    const { rerender } = render(<ParticipantSeat {...baseProps} />);
    expect(screen.queryByRole('button', { name: 'Quitar a Grace' })).toBeNull();

    const onRemove = vi.fn();
    rerender(<ParticipantSeat {...baseProps} onRemove={onRemove} />);
    screen.getByRole('button', { name: 'Quitar a Grace' }).click();

    expect(onRemove).toHaveBeenCalledOnce();
  });
});
