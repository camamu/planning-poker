import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl.js';

describe('SegmentedControl', () => {
  it('marca la opción activa y avisa al cambiar', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        name="role"
        value="VOTER"
        onChange={onChange}
        options={[
          { value: 'VOTER', label: '🃏 Voto' },
          { value: 'SPECTATOR', label: '👀 Miro' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: '🃏 Voto' })).toBeChecked();
    screen.getByRole('radio', { name: '👀 Miro' }).click();
    expect(onChange).toHaveBeenCalledWith('SPECTATOR');
  });
});
