import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';

describe('Button', () => {
  it('dispara onClick al pulsarlo', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Revelar</Button>);
    screen.getByRole('button', { name: 'Revelar' }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('aplica la clase del variant pedido', () => {
    render(<Button variant="primary">Crear</Button>);
    expect(screen.getByRole('button', { name: 'Crear' })).toHaveClass('btn-primary');
  });
});
