import type { JSX } from 'react';

export interface SwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly 'aria-label'?: string;
}

export function Switch(props: SwitchProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props['aria-label']}
      disabled={props.disabled}
      data-on={props.checked}
      className="pp-switch"
      onClick={() => {
        props.onChange(!props.checked);
      }}
    >
      <span className="knob" />
    </button>
  );
}
