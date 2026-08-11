import type { JSX } from 'react';

export interface ToastProps {
  readonly message: string;
}

export function Toast({ message }: ToastProps): JSX.Element {
  return (
    <div className="pp-toast" role="status">
      {message}
    </div>
  );
}
