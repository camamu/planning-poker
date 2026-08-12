import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs.js';

describe('Tabs', () => {
  it('marca la pestaña activa y avisa al cambiar', () => {
    const onChange = vi.fn();
    render(
      <Tabs
        items={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        value="a"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('aria-selected', 'true');
    screen.getByRole('tab', { name: 'B' }).click();
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
