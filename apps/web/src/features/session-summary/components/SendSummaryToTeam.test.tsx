import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendSessionSummary } from '../../../shared/api/gamesClient.js';
import { SendSummaryToTeam } from './SendSummaryToTeam.js';

vi.mock('../../../shared/api/gamesClient.js', () => ({ sendSessionSummary: vi.fn() }));

function renderButton(): void {
  render(<SendSummaryToTeam gameId="game-1" participantId="p1" />);
}

describe('SendSummaryToTeam', () => {
  beforeEach(() => {
    vi.mocked(sendSessionSummary).mockReset();
  });
  afterEach(cleanup);

  it('envía el resumen con quien lo pide y cuenta a cuántos webhooks llegó', async () => {
    vi.mocked(sendSessionSummary).mockResolvedValue({ delivered: 2, failed: 0 });
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar resumen' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Resumen enviado a 2 webhooks del equipo.',
    );
    expect(sendSessionSummary).toHaveBeenCalledWith('game-1', 'p1');
  });

  it('en singular cuando es un solo webhook', async () => {
    vi.mocked(sendSessionSummary).mockResolvedValue({ delivered: 1, failed: 0 });
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar resumen' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Resumen enviado a 1 webhook del equipo.',
    );
  });

  it('dice a cuántos no se pudo enviar cuando alguno falla', async () => {
    vi.mocked(sendSessionSummary).mockResolvedValue({ delivered: 1, failed: 2 });
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar resumen' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'No se pudo enviar a 2 de 3 webhooks del equipo.',
    );
  });

  it('enseña el error si la petición falla', async () => {
    vi.mocked(sendSessionSummary).mockRejectedValue(
      new Error('El participante p1 no existe en esta partida.'),
    );
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar resumen' }));

    expect(await screen.findByRole('status')).toHaveTextContent('no existe en esta partida');
  });

  it('se desactiva mientras envía para no mandarlo dos veces', async () => {
    let finish: (value: { delivered: number; failed: number }) => void = () => undefined;
    vi.mocked(sendSessionSummary).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar resumen' }));

    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    finish({ delivered: 1, failed: 0 });
    expect(await screen.findByRole('button', { name: 'Enviar resumen' })).toBeEnabled();
  });
});
