import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './Input.js';

describe('Input', () => {
  it('asocia la etiqueta al campo', () => {
    render(<Input label="Nombre" />);
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
  });
});
