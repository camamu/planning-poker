import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Modal } from './Modal.js';

describe('Modal', () => {
  afterEach(cleanup);

  it('no renderiza nada si open es false', () => {
    render(
      <Modal open={false} title="Ajustes">
        contenido
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('muestra el título y el contenido si open es true', () => {
    render(
      <Modal open title="Ajustes">
        contenido
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Ajustes' })).toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });

  it('usa el ancho normal por defecto y el ancho amplio si se pide', () => {
    const { rerender } = render(
      <Modal open title="Ajustes">
        contenido
      </Modal>,
    );
    expect(screen.getByRole('dialog')).not.toHaveClass('dialog-wide');

    rerender(
      <Modal open title="Ajustes" size="wide">
        contenido
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('dialog-wide');
  });
});
