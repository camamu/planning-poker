import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QrCode } from './QrCode.js';

describe('QrCode', () => {
  // Sin `globals: true` en vitest.config, RTL no limpia el DOM entre tests por su cuenta.
  afterEach(cleanup);

  it('pinta un svg accesible con la etiqueta por defecto', () => {
    render(<QrCode value="https://planning-poker.test/games/abc" />);
    expect(screen.getByRole('img')).toHaveAccessibleName('Código QR para abrir el enlace');
  });

  it('acepta una etiqueta propia', () => {
    render(<QrCode value="https://planning-poker.test" aria-label="QR de la partida" />);
    expect(screen.getByRole('img')).toHaveAccessibleName('QR de la partida');
  });

  it('el tamaño pedido llega al svg', () => {
    render(<QrCode value="https://planning-poker.test" size={64} />);
    expect(screen.getByRole('img')).toHaveAttribute('height', '64');
  });
});
