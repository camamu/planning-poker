import type { InputHTMLAttributes, JSX, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label?: ReactNode;
}

let nextId = 0;

export function Input({ label, id, className, ...rest }: InputProps): JSX.Element {
  const inputId = id ?? `pp-input-${(nextId++).toString()}`;
  return (
    <div className="field">
      {label ? <label htmlFor={inputId}>{label}</label> : null}
      <input id={inputId} className={['pp-input', className ?? ''].join(' ').trim()} {...rest} />
    </div>
  );
}
