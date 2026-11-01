import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar.js';
import type { TopBarProps } from './TopBar.js';

function renderTopBar(overrides: Partial<TopBarProps> = {}): void {
  render(
    <TopBar
      gameName="Sprint 42"
      meta="9 valores"
      remainingMs={null}
      muted={false}
      onToggleMuted={vi.fn()}
      viewerId="p1"
      viewerHat={null}
      onChangeHat={vi.fn()}
      summaryHref="/games/game-1/summary"
      asyncToVote={0}
      onToggleIssues={vi.fn()}
      onToggleSettings={vi.fn()}
      {...overrides}
    />,
  );
}

describe('TopBar: avisos de votación en diferido', () => {
  afterEach(cleanup);

  it('no enseña ningún aviso cuando no queda nada por votar', () => {
    renderTopBar({ asyncToVote: 0 });

    expect(screen.queryByLabelText(/por votar en diferido/)).not.toBeInTheDocument();
  });

  it('avisa en el botón de tareas de cuántas rondas en diferido faltan por votar', () => {
    renderTopBar({ asyncToVote: 3 });

    expect(screen.getByLabelText('3 por votar en diferido')).toHaveTextContent('3');
  });
});
