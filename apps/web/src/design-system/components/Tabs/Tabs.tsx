import type { JSX } from 'react';

export interface TabItem {
  readonly value: string;
  readonly label: string;
}

export interface TabsProps {
  readonly items: ReadonlyArray<TabItem>;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function Tabs({ items, value, onChange }: TabsProps): JSX.Element {
  return (
    <div className="pp-tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          className="pp-tab"
          onClick={() => {
            onChange(item.value);
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
