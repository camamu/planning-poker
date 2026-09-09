import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Select } from './Select.js';

describe('Select', () => {
  it('lista las opciones dadas', () => {
    render(
      <Select
        label="Baraja"
        options={[
          { value: 'fibonacci', label: 'Fibonacci' },
          { value: 'tshirt', label: 'Tallas' },
        ]}
      />,
    );
    expect(screen.getByRole('option', { name: 'Fibonacci' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tallas' })).toBeInTheDocument();
  });
});
