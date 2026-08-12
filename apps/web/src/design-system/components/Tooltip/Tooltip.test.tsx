import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tooltip } from './Tooltip.js';

describe('Tooltip', () => {
  it('solo muestra la etiqueta al recibir foco/hover', () => {
    render(
      <Tooltip label="Copiar enlace">
        <button type="button">Enlace</button>
      </Tooltip>,
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Enlace' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Copiar enlace');
  });
});
