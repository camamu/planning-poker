import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Card } from './Card.js';

describe('Card', () => {
  it('disponible: se puede pulsar y muestra su valor', () => {
    const onClick = vi.fn();
    render(<Card label="5" state="available" onClick={onClick} />);
    const card = screen.getByRole('button', { name: '5' });
    expect(card).toBeEnabled();
    card.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('seleccionada: queda marcada con aria-pressed', () => {
    render(<Card label="8" state="selected" />);
    expect(screen.getByRole('button', { name: '8' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('boca abajo: no expone el valor de la carta en el DOM', () => {
    render(<Card label="13" state="face-down" />);
    expect(screen.queryByText('13')).not.toBeInTheDocument();
  });

  it('revelada: sí expone el valor de la carta', () => {
    render(<Card label="13" state="revealed" />);
    expect(screen.getByText('13')).toBeInTheDocument();
  });
});
