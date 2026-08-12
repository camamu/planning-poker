import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Toast } from './Toast.js';

describe('Toast', () => {
  it('muestra el mensaje como región de estado', () => {
    render(<Toast message="Enlace copiado" />);
    expect(screen.getByRole('status')).toHaveTextContent('Enlace copiado');
  });
});
