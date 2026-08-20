import { QRCodeSVG } from 'qrcode.react';
import type { JSX } from 'react';

export interface QrCodeProps {
  /** Lo que se codifica. Aquí siempre una URL, pero el componente no lo asume. */
  readonly value: string;
  readonly size?: number;
  readonly 'aria-label'?: string;
}

/**
 * Envuelve la librería de QR para que sea el único punto del front que la conoce.
 * SVG y no canvas: escala sin pixelarse al fotografiarlo desde un móvil.
 */
export function QrCode({ value, size = 180, ...props }: QrCodeProps): JSX.Element {
  return (
    <div
      className="inline-flex rounded-xl p-3"
      // Fondo claro fijo: un QR sobre el fondo oscuro del tema no lo lee ningún móvil.
      style={{ background: '#ffffff' }}
    >
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        bgColor="#ffffff"
        fgColor="#0f0e17"
        role="img"
        aria-label={props['aria-label'] ?? 'Código QR para abrir el enlace'}
      />
    </div>
  );
}
