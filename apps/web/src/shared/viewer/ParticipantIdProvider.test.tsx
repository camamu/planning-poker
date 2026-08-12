import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ParticipantIdProvider,
  clearParticipantIdentity,
  loadParticipantIdentity,
  saveParticipantIdentity,
  useParticipantIdentity,
} from './ParticipantIdProvider.js';

function Reader(): JSX.Element {
  const identity = useParticipantIdentity();
  return <span>{identity ? identity.displayName : 'nadie'}</span>;
}

describe('ParticipantIdProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('no hay identidad guardada: el provider expone null', () => {
    render(
      <ParticipantIdProvider gameId="game-1">
        <Reader />
      </ParticipantIdProvider>,
    );
    expect(screen.getByText('nadie')).toBeInTheDocument();
  });

  it('recuerda la identidad guardada para esa partida', () => {
    saveParticipantIdentity('game-1', { participantId: 'p1', displayName: 'Ada' });
    render(
      <ParticipantIdProvider gameId="game-1">
        <Reader />
      </ParticipantIdProvider>,
    );
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });

  it('no confunde identidades entre partidas distintas', () => {
    saveParticipantIdentity('game-1', { participantId: 'p1', displayName: 'Ada' });
    expect(loadParticipantIdentity('game-2')).toBeNull();
  });

  it('clearParticipantIdentity olvida la identidad guardada', () => {
    saveParticipantIdentity('game-1', { participantId: 'p1', displayName: 'Ada' });
    clearParticipantIdentity('game-1');
    expect(loadParticipantIdentity('game-1')).toBeNull();
  });
});
