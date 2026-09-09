import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, hueForSeed } from './Avatar.js';

describe('Avatar', () => {
  it('deriva siempre el mismo hue para el mismo seed', () => {
    expect(hueForSeed('participant-1')).toBe(hueForSeed('participant-1'));
  });

  it('variante initials muestra las iniciales dadas', () => {
    render(<Avatar seed="p1" variant="initials" initials="TÚ" />);
    expect(screen.getByText('TÚ')).toBeInTheDocument();
  });
});
