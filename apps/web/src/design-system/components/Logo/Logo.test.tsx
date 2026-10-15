import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo.js';

describe('Logo', () => {
  it('es decorativo si no recibe título', () => {
    const { container } = render(<Logo />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('se anuncia como imagen con el título dado', () => {
    render(<Logo title="Planning Poker" />);
    expect(screen.getByRole('img', { name: 'Planning Poker' })).toBeInTheDocument();
  });

  it('no repite ids de máscara entre dos logos de la misma página', () => {
    const { container } = render(
      <>
        <Logo />
        <Logo />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('mask')).map((mask) => mask.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('omite muescas y el 8 en tamaños pequeños', () => {
    const { container } = render(<Logo size={16} />);
    expect(container.querySelectorAll('circle[stroke-dasharray]')).toHaveLength(0);
    expect(container.querySelectorAll('mask g')).toHaveLength(0);
  });
});
