import { MAX_CARD_LENGTH, MAX_CARDS_PER_DECK } from '@pp/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomDeckForm } from './CustomDeckForm.js';

function renderForm(): ReturnType<typeof vi.fn> {
  const onSubmit = vi.fn();
  render(<CustomDeckForm submitting={false} onSubmit={onSubmit} onCancel={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Nombre de la baraja'), { target: { value: 'Mía' } });
  return onSubmit;
}

function typeCards(raw: string): void {
  fireEvent.change(screen.getByPlaceholderText('1, 2, 3, 5, 8'), { target: { value: raw } });
}

describe('CustomDeckForm: límites del servidor', () => {
  afterEach(cleanup);

  it('guarda una baraja dentro de los límites', () => {
    const onSubmit = renderForm();

    typeCards('1, 2, 3');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Mía', cards: ['1', '2', '3'] });
  });

  it('no deja guardar una carta de más de MAX_CARD_LENGTH caracteres y dice por qué', () => {
    const onSubmit = renderForm();

    typeCards(`1, ${'x'.repeat(MAX_CARD_LENGTH + 1)}`);

    expect(screen.getByText(/Cada carta puede tener hasta/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('no deja guardar más de MAX_CARDS_PER_DECK cartas y dice por qué', () => {
    renderForm();

    typeCards(
      Array.from({ length: MAX_CARDS_PER_DECK + 1 }, (_, index) => index.toString()).join(','),
    );

    expect(screen.getByText(/Una baraja admite hasta/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });
});
