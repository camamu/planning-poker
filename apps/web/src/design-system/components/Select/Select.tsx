import type { JSX, ReactNode, SelectHTMLAttributes } from 'react';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  readonly label?: ReactNode;
  readonly options: ReadonlyArray<SelectOption>;
}

let nextId = 0;

export function Select({ label, options, id, className, ...rest }: SelectProps): JSX.Element {
  const selectId = id ?? `pp-select-${(nextId++).toString()}`;
  return (
    <div className="field">
      {label ? <label htmlFor={selectId}>{label}</label> : null}
      <select id={selectId} className={['pp-input', className ?? ''].join(' ').trim()} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
