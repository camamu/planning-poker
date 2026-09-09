import { useState } from 'react';
import type { JSX } from 'react';
import { useParams } from 'react-router-dom';
import { GameTablePage } from '../features/game-table/GameTablePage.js';
import { JoinGamePage } from '../features/join-game/JoinGamePage.js';
import { loadParticipantIdentity } from '../shared/viewer/ParticipantIdProvider.js';
import type { ParticipantIdentity } from '../shared/viewer/ParticipantIdProvider.js';

/** `/games/:gameId` — muestra unirse o la mesa según haya o no identidad guardada para esta partida. */
export function GameRoute(): JSX.Element {
  const { gameId } = useParams<{ gameId: string }>();
  const [identity, setIdentity] = useState<ParticipantIdentity | null>(() =>
    gameId ? loadParticipantIdentity(gameId) : null,
  );

  if (!gameId) {
    return <p className="p-8">Partida no encontrada.</p>;
  }
  if (!identity) {
    return <JoinGamePage gameId={gameId} onJoined={setIdentity} />;
  }
  return <GameTablePage gameId={gameId} participantId={identity.participantId} />;
}
