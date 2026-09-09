import { describe, expect, it } from 'vitest';
import { CardValue } from '../../src/domain/deck/CardValue.js';
import { IssueId, ParticipantId, RoundId } from '../../src/domain/game/ids.js';
import { Round, RoundNotOpenError, RoundNotRevealedError } from '../../src/domain/game/Round.js';

const NOW = new Date('2026-08-07T10:00:00Z');

function openRound(timerDeadline: Date | null = null): Round {
  return Round.open(RoundId.of('r1'), IssueId.of('i1'), 1, timerDeadline);
}

describe('Round', () => {
  it('nace OPEN, sin revelar y sin resultado', () => {
    const round = openRound();
    expect(round.currentStatus()).toBe('OPEN');
    expect(round.isOpen()).toBe(true);
    expect(round.isRevealed()).toBe(false);
    expect(round.currentRevealedAt()).toBeNull();
  });

  it('hasSameVote() es false si el participante no ha votado', () => {
    const round = openRound();
    expect(round.hasSameVote(ParticipantId.of('p1'), CardValue.of('5'))).toBe(false);
  });

  it('everyVoterHasVoted() comprueba todos los voters dados', () => {
    const round = openRound();
    const p1 = ParticipantId.of('p1');
    const p2 = ParticipantId.of('p2');
    round.castVote(p1, CardValue.of('5'));
    expect(round.everyVoterHasVoted([p1, p2])).toBe(false);
    round.castVote(p2, CardValue.of('8'));
    expect(round.everyVoterHasVoted([p1, p2])).toBe(true);
  });

  it('castVote() y retractVote() lanzan RoundNotOpenError si la ronda no está abierta', () => {
    const round = openRound();
    round.reveal(NOW);
    expect(() => {
      round.castVote(ParticipantId.of('p1'), CardValue.of('5'));
    }).toThrow(RoundNotOpenError);
    expect(() => {
      round.retractVote(ParticipantId.of('p1'));
    }).toThrow(RoundNotOpenError);
  });

  it('reveal() dos veces lanza RoundNotOpenError la segunda vez', () => {
    const round = openRound();
    round.reveal(NOW);
    expect(() => {
      round.reveal(NOW);
    }).toThrow(RoundNotOpenError);
  });

  it('close() exige que la ronda esté REVEALED', () => {
    const round = openRound();
    expect(() => {
      round.close();
    }).toThrow(RoundNotRevealedError);

    round.reveal(NOW);
    round.close();
    expect(round.currentStatus()).toBe('CLOSED');
  });

  it('revealedVotes() y revealedResult() lanzan antes del reveal', () => {
    const round = openRound();
    expect(() => round.revealedVotes()).toThrow(RoundNotRevealedError);
    expect(() => round.revealedResult()).toThrow(RoundNotRevealedError);
  });

  it('tras reveal(), currentRevealedAt() devuelve el instante indicado', () => {
    const round = openRound();
    round.reveal(NOW);
    expect(round.currentRevealedAt()).toBe(NOW);
  });

  it('allVotesRaw() expone los votos de una ronda abierta sin pasar por la invariante 7', () => {
    const round = openRound();
    const p1 = ParticipantId.of('p1');
    round.castVote(p1, CardValue.of('5'));

    expect(round.allVotesRaw()).toEqual([{ participantId: p1, card: CardValue.of('5') }]);
  });

  it('reconstitute() con status OPEN reconstruye los votos sin calcular resultado', () => {
    const p1 = ParticipantId.of('p1');
    const round = Round.reconstitute(
      RoundId.of('r1'),
      IssueId.of('i1'),
      1,
      'OPEN',
      [{ participantId: p1, card: CardValue.of('5') }],
      null,
      null,
    );

    expect(round.isOpen()).toBe(true);
    expect(round.hasVoted(p1)).toBe(true);
    expect(round.allVotesRaw()).toEqual([{ participantId: p1, card: CardValue.of('5') }]);
    expect(() => round.revealedResult()).toThrow(RoundNotRevealedError);
  });

  it('reconstitute() con status REVEALED recalcula el resultado a partir de los votos', () => {
    const p1 = ParticipantId.of('p1');
    const p2 = ParticipantId.of('p2');
    const round = Round.reconstitute(
      RoundId.of('r1'),
      IssueId.of('i1'),
      1,
      'REVEALED',
      [
        { participantId: p1, card: CardValue.of('5') },
        { participantId: p2, card: CardValue.of('5') },
      ],
      NOW,
      null,
    );

    expect(round.isRevealed()).toBe(true);
    expect(round.currentRevealedAt()).toBe(NOW);
    expect(round.revealedResult().isUnanimous).toBe(true);
    expect(round.revealedVotes()).toHaveLength(2);
  });

  it('expone la fecha límite con la que se abrió, o null si la cuenta atrás está desactivada', () => {
    expect(openRound().currentTimerDeadline()).toBeNull();

    const deadline = new Date(NOW.getTime() + 45_000);
    expect(openRound(deadline).currentTimerDeadline()).toBe(deadline);
  });
});
