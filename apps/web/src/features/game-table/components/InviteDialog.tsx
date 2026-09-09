import { useState } from 'react';
import type { JSX } from 'react';
import { Button, Modal, QrCode } from '../../../design-system/index.js';

export interface InviteDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly link: string;
}

export function InviteDialog(props: InviteDialogProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  return (
    <Modal open={props.open} onClose={props.onClose} title="Invitar a la partida">
      <div className="flex flex-col items-center gap-4 text-center">
        <QrCode value={props.link} size={190} aria-label="Código QR para entrar a la partida" />
        <p className="text-xs" style={{ color: 'var(--pp-muted)' }}>
          Apunta con la cámara del móvil para entrar sin teclear el enlace.
        </p>
        <div className="pp-input flex w-full items-center gap-2 font-mono text-xs">
          <span className="truncate">{props.link}</span>
        </div>
        <Button
          variant="secondary"
          block
          onClick={() => {
            void navigator.clipboard.writeText(props.link).then(() => {
              setCopied(true);
              setTimeout(() => {
                setCopied(false);
              }, 2000);
            });
          }}
        >
          {copied ? 'Copiado ✓' : 'Copiar enlace'}
        </Button>
      </div>
    </Modal>
  );
}
