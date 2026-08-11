import type { JSX } from 'react';

export interface SegmentedOption {
  readonly value: string;
  readonly label: string;
}

export interface SegmentedControlProps {
  readonly name: string;
  readonly options: ReadonlyArray<SegmentedOption>;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function SegmentedControl(props: SegmentedControlProps): JSX.Element {
  return (
    <div className="seg" role="radiogroup">
      {props.options.map((option) => (
        <label key={option.value} className="seg-opt">
          <input
            type="radio"
            name={props.name}
            value={option.value}
            checked={option.value === props.value}
            onChange={() => {
              props.onChange(option.value);
            }}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
