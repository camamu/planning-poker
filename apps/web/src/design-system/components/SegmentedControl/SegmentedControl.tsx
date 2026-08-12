import type { JSX } from 'react';

export interface SegmentedOption<T extends string = string> {
  readonly value: T;
  readonly label: string;
}

export interface SegmentedControlProps<T extends string = string> {
  readonly name: string;
  readonly options: ReadonlyArray<SegmentedOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
}

export function SegmentedControl<T extends string = string>(
  props: SegmentedControlProps<T>,
): JSX.Element {
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
