import { describe, expect, it } from 'vitest';
import type { PresenceReader } from '../../src/application/ports/PresenceReader.js';
import { CastVote } from '../../src/application/use-cases/CastVote.js';
import { GetGameState } from '../../src/application/use-cases/GetGameState.js';
import { JoinGame } from '../../src/application/use-cases/JoinGame.js';
import { ReconcileAutoReveal } from '../../src/application/use-cases/ReconcileAutoReveal.js';
import { GameId, ParticipantId } from '../../src/domain/game/ids.js';
import { seedGameWithOpenRound } from './support/gameFixtures.js';
import type { SeededOpenRound } from './support/gameFixtures.js';

function presenceOf(ids: ReadonlyArray<string> | undefined): PresenceReader {
  const participants = ids?.map((id) => ParticipantId.of(id));
  return { onlineParticipants: () => participants ?? [], votingPresence: () => participants };
}

async function joinVoter(seeded: SeededOpenRound, displayName: string): Promise<string> {
  const joinGame = new JoinGame(
    seeded.context.games,
    seeded.context.events,
    seeded.context.clock,
    seeded.context.ids,
  );
  const id = await joinGame.execute({ gameId: seeded.gameId, displayName, role: 'VOTER' });
  seeded.context.events.clear();
  return id;
}

describe('presencia', () => {
  it('CastVote revela con el voto del único votante presente aunque falte otro desconectado', async () => {
    const seeded = await seedGameWithOpenRound({ autoReveal: true });
    await joinVoter(seeded, 'Ana');
    const useCase = new CastVote(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      presenceOf([seeded.facilitatorId]),
    );

    await useCase.execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      card: '5',
    });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.currentRound()?.isRevealed()).toBe(true);
  });

  it('CastVote cuenta a todos si la presencia aún no se conoce', async () => {
    const seeded = await seedGameWithOpenRound({ autoReveal: true });
    await joinVoter(seeded, 'Ana');
    const useCase = new CastVote(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      presenceOf(undefined),
    );

    await useCase.execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      card: '5',
    });

    const stored = await seeded.context.games.findById(GameId.of(seeded.gameId));
    expect(stored?.currentRound()?.isRevealed()).toBe(false);
  });

  it('ReconcileAutoReveal revela y publica RoundRevealed cuando se desconecta quien faltaba', async () => {
    const seeded = await seedGameWithOpenRound({ autoReveal: true });
    await joinVoter(seeded, 'Ana');
    await new CastVote(seeded.context.games, seeded.context.events, seeded.context.clock).execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      card: '5',
    });
    seeded.context.events.clear();

    await new ReconcileAutoReveal(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      presenceOf([seeded.facilitatorId]),
    ).execute({ gameId: seeded.gameId });

    expect(seeded.context.events.published.map((event) => event.type)).toEqual(['RoundRevealed']);
  });

  it('ReconcileAutoReveal no publica nada si la ronda sigue incompleta', async () => {
    const seeded = await seedGameWithOpenRound({ autoReveal: true });
    const anaId = await joinVoter(seeded, 'Ana');
    await new CastVote(seeded.context.games, seeded.context.events, seeded.context.clock).execute({
      gameId: seeded.gameId,
      participantId: seeded.facilitatorId,
      card: '5',
    });
    seeded.context.events.clear();

    await new ReconcileAutoReveal(
      seeded.context.games,
      seeded.context.events,
      seeded.context.clock,
      presenceOf([seeded.facilitatorId, anaId]),
    ).execute({ gameId: seeded.gameId });

    expect(seeded.context.events.published).toEqual([]);
  });

  it('GetGameState marca como conectados solo a los presentes', async () => {
    const seeded = await seedGameWithOpenRound();
    const anaId = await joinVoter(seeded, 'Ana');

    const view = await new GetGameState(seeded.context.games, presenceOf([anaId])).execute({
      gameId: seeded.gameId,
      viewerId: seeded.facilitatorId,
    });

    expect(view.participants.map((participant) => [participant.id, participant.online])).toEqual([
      [seeded.facilitatorId, false],
      [anaId, true],
    ]);
  });
});
