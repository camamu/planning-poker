import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HatPicker } from './HatPicker.js';

describe('HatPicker', () => {
  afterEach(cleanup);

  it('marca el sombrero actual y aplica el nuevo al pulsarlo', () => {
    const onSelect = vi.fn();
    render(<HatPicker open viewerId="p1" current="cowboy" onSelect={onSelect} onClose={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Vaquero' })).toHaveAttribute('aria-checked', 'true');
    screen.getByRole('radio', { name: 'Hélices' }).click();
    expect(onSelect).toHaveBeenCalledWith('propeller');
  });

  it('permite quitarse el sombrero', () => {
    const onSelect = vi.fn();
    render(<HatPicker open viewerId="p1" current="wizard" onSelect={onSelect} onClose={vi.fn()} />);

    screen.getByRole('radio', { name: 'Sin sombrero' }).click();
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('no vuelve a pedir el sombrero que ya lleva puesto', () => {
    const onSelect = vi.fn();
    render(<HatPicker open viewerId="p1" current="crown" onSelect={onSelect} onClose={vi.fn()} />);

    screen.getByRole('radio', { name: 'Corona' }).click();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
