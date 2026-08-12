import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch.js';

describe('Switch', () => {
  it('refleja el estado encendido/apagado', () => {
    render(<Switch checked aria-label="Auto-revelar" onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: 'Auto-revelar' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('invierte el valor al pulsarlo', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} aria-label="Fiesta" onChange={onChange} />);
    screen.getByRole('switch', { name: 'Fiesta' }).click();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('mantiene el foco visible por teclado (sin outline propio del navegador)', () => {
    render(<Switch checked={false} aria-label="Emojis" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('switch', { name: 'Emojis' })).toBeDisabled();
  });
});
