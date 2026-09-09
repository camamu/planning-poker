import type { JSX, ReactNode } from 'react';

export interface ModalProps {
  readonly open: boolean;
  readonly title: string;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
  readonly onClose?: () => void;
}

export function Modal({ open, title, children, actions, onClose }: ModalProps): JSX.Element | null {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pp-modal-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <h2 id="pp-modal-title" className="dialog-title">
          {title}
        </h2>
        <div className="text-sm opacity-85">{children}</div>
        {actions ? <div className="dialog-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
