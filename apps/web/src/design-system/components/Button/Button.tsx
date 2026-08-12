import type { ButtonHTMLAttributes, JSX } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly block?: boolean;
}

export function Button({
  variant = 'secondary',
  block,
  className,
  type,
  ...rest
}: ButtonProps): JSX.Element {
  const classes = ['btn', `btn-${variant}`, block ? 'w-full' : '', className ?? '']
    .join(' ')
    .trim();
  return <button type={type ?? 'button'} className={classes} {...rest} />;
}
