import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Modal } from './Modal.js';

describe('Modal', () => {
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
});
