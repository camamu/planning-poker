import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge.js';

describe('Badge', () => {
  it('pinta el contenido con la clase del variant', () => {
    render(<Badge variant="accent">Revelada</Badge>);
    expect(screen.getByText('Revelada')).toHaveClass('tag-accent');
  });
});
