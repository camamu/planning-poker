import { HAT_IDS } from '@pp/contracts';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from '../Avatar/Avatar.js';
import { Hat, HAT_LABELS } from './Hat.js';

describe('Hat', () => {
  it.each(HAT_IDS)('dibuja el sombrero %s con la proporción del viewBox', (hat) => {
    const { container } = render(<Hat hat={hat} width={40} />);
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('height')).toBe('28');
    expect(svg?.childElementCount).toBeGreaterThan(0);
    expect(HAT_LABELS[hat]).not.toBe('');
  });

  it('el avatar solo lleva sombrero cuando se le pasa uno', () => {
    const { container, rerender } = render(<Avatar seed="p1" />);
    expect(container.querySelector('svg')).toBeNull();

    rerender(<Avatar seed="p1" hat="cowboy" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
