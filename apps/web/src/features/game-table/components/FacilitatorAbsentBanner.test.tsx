import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FacilitatorAbsentBanner } from './FacilitatorAbsentBanner.js';

describe('FacilitatorAbsentBanner', () => {
  afterEach(cleanup);

  it('avisa de que el facilitador no está conectado y ofrece tomar el relevo', () => {
    const onClaim = vi.fn();
    render(<FacilitatorAbsentBanner facilitatorName="Ada" onClaim={onClaim} />);

    expect(screen.getByRole('status')).toHaveTextContent('El facilitador (Ada) no está conectado.');
    fireEvent.click(screen.getByRole('button', { name: 'Tomar el relevo' }));

    expect(onClaim).toHaveBeenCalledOnce();
  });

  it('funciona sin nombre', () => {
    render(<FacilitatorAbsentBanner facilitatorName={null} onClaim={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent('El facilitador no está conectado.');
  });
});
