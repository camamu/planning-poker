import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('TopBar en el móvil', () => {
  afterEach(cleanup);

  it('deja fuera de la cabecera los botones que no caben y los pone en el menú ☰', () => {
    renderTopBar({ compact: true });

    expect(screen.queryByRole('button', { name: /Tareas/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Menú de la partida' }));

    expect(screen.getByRole('button', { name: /Tareas/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Resumen/ })).toHaveAttribute(
      'href',
      '/games/game-1/summary',
    );
    expect(screen.getByRole('button', { name: /Invitar/ })).toBeInTheDocument();
  });

  it('cada opción cierra el menú y hace lo suyo', () => {
    const onToggleIssues = vi.fn();
    renderTopBar({ compact: true, onToggleIssues });

    fireEvent.click(screen.getByRole('button', { name: 'Menú de la partida' }));
    fireEvent.click(screen.getByRole('button', { name: /Tareas/ }));

    expect(onToggleIssues).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /Tareas/ })).not.toBeInTheDocument();
  });

  it('Escape cierra el menú sin hacer nada', () => {
    renderTopBar({ compact: true });

    fireEvent.click(screen.getByRole('button', { name: 'Menú de la partida' }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('button', { name: /Tareas/ })).not.toBeInTheDocument();
  });

  it('avisa en el ☰ y dentro del menú de las tareas en diferido por votar', () => {
    renderTopBar({ compact: true, asyncToVote: 2 });

    expect(screen.getByRole('button', { name: 'Menú de la partida' })).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button', { name: 'Menú de la partida' }));
    expect(screen.getByLabelText('2 por votar en diferido')).toHaveTextContent('2');
  });
});
