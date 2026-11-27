import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HatPicker, hatOptions } from './HatPicker.js';

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

describe('gorros de temporada en el selector', () => {
  const labels = (options: ReturnType<typeof hatOptions>): string[] =>
    options.map((option) => option.label);

  it('en invierno se ofrecen primero, justo después de «Sin sombrero»', () => {
    expect(labels(hatOptions('winter', null)).slice(0, 5)).toEqual([
      'Sin sombrero',
      'Papá Noel',
      'Gorro de lana',
      'Reno',
      'Elfo',
    ]);
  });

  it('fuera de temporada no se ofrecen', () => {
    expect(labels(hatOptions(null, 'cowboy'))).not.toContain('Papá Noel');
    expect(labels(hatOptions(null, 'cowboy'))).toContain('Vaquero');
  });

  it('fuera de temporada se sigue viendo el que ya llevas puesto', () => {
    const options = labels(hatOptions(null, 'reindeer'));
    expect(options).toContain('Reno');
    expect(options).not.toContain('Elfo');
  });
});
