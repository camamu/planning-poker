import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameDeckPicker } from './GameDeckPicker.js';

const FIBONACCI = ['0.5', '1', '2', '3', '5', '8', '13', '?', '☕'];
const TSHIRT = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'];

const { listGameDecks, changeGameDeck } = vi.hoisted(() => ({
  listGameDecks: vi.fn(),
  changeGameDeck: vi.fn(),
}));
vi.mock('../../../shared/api/gamesClient.js', () => ({ listGameDecks, changeGameDeck }));

describe('GameDeckPicker', () => {
  beforeEach(() => {
    listGameDecks.mockResolvedValue([
      { id: 'fib', teamId: null, name: 'Fibonacci', cards: FIBONACCI },
      { id: 'tshirt', teamId: null, name: 'Tallas', cards: TSHIRT },
    ]);
    changeGameDeck.mockReset().mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('cambia de baraja al elegir otra entre rondas', async () => {
    render(<GameDeckPicker gameId="g" participantId="p" currentCards={TSHIRT} locked={false} />);
    (await screen.findByRole('radio', { name: /Fibonacci/ })).click();
    await waitFor(() => {
      expect(changeGameDeck).toHaveBeenCalledWith('g', { participantId: 'p', deckId: 'fib' });
    });
  });

  it('con una ronda abierta avisa de forma visible y deshabilita las opciones', async () => {
    render(<GameDeckPicker gameId="g" participantId="p" currentCards={FIBONACCI} locked />);
    expect(screen.getByRole('status')).toHaveTextContent('Hay una ronda abierta');
    const tallas = await screen.findByRole('radio', { name: /Tallas/ });
    expect(tallas).toBeDisabled();
  });

  it('sin ronda abierta no muestra el aviso de bloqueo', async () => {
    render(<GameDeckPicker gameId="g" participantId="p" currentCards={FIBONACCI} locked={false} />);
    await screen.findByRole('radio', { name: /Tallas/ });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
