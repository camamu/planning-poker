import type { CardValue } from '../deck/CardValue.js';
import type { Deck } from '../deck/Deck.js';
import { DomainError } from '../shared/DomainError.js';
import type { DisplayName } from './DisplayName.js';
import type { GameEvent } from './events/GameEvent.js';
import type { GameName } from './GameName.js';
import type { GameSettings } from './GameSettings.js';
import type { GameId, IssueId, ParticipantId, RoundId } from './ids.js';
import { Issue } from './Issue.js';
import { Participant } from './Participant.js';
import type { ParticipantRole } from './Participant.js';
import { Round } from './Round.js';

export class ParticipantAlreadyJoinedError extends DomainError {
  constructor(readonly participantId: ParticipantId) {
    super(`El participante ${participantId.value} ya está en la partida.`);
  }
}

export class ParticipantNotFoundError extends DomainError {
  constructor(readonly participantId: ParticipantId) {
    super(`No existe el participante ${participantId.value} en esta partida.`);
  }
}

export class SpectatorCannotVoteError extends DomainError {
  constructor(readonly participantId: ParticipantId) {
    super(`El participante ${participantId.value} es espectador y no puede votar.`);
  }
}

export class CardNotInDeckError extends DomainError {
  constructor(readonly card: CardValue) {
    super(`La carta "${card.raw}" no pertenece a la baraja de la partida.`);
  }
}

export class NoOpenRoundError extends DomainError {
  constructor(readonly gameId: GameId) {
    super(`La partida ${gameId.value} no tiene ninguna ronda abierta.`);
  }
}

export class AnotherRoundOpenError extends DomainError {
  constructor(readonly gameId: GameId) {
    super(`La partida ${gameId.value} ya tiene una ronda abierta.`);
  }
}

export class IssueNotFoundError extends DomainError {
  constructor(readonly issueId: IssueId) {
    super(`No existe la issue ${issueId.value} en esta partida.`);
  }
}

export class RevealNotAllowedError extends DomainError {
  constructor(readonly participantId: ParticipantId) {
    super(`El participante ${participantId.value} no tiene permiso para revelar la ronda.`);
  }
}

export class EstimateRequiresRevealedRoundError extends DomainError {
  constructor(readonly gameId: GameId) {
    super(
      `La partida ${gameId.value} no tiene una ronda revelada que se pueda cerrar como estimación.`,
    );
  }
}

export interface CreateGameProps {
  readonly id: GameId;
  readonly name: GameName;
  readonly deck: Deck;
  readonly settings: GameSettings;
  readonly facilitatorId: ParticipantId;
  readonly facilitatorName: DisplayName;
}

export class Game {
  private readonly participants = new Map<string, Participant>();
  private readonly issues: Issue[] = [];
  private readonly rounds: Round[] = [];
  private readonly events: GameEvent[] = [];

  private constructor(
    readonly id: GameId,
    private readonly name: GameName,
    private readonly deck: Deck,
    private readonly settings: GameSettings,
  ) {}

  static create(props: CreateGameProps, now: Date): Game {
    const game = new Game(props.id, props.name, props.deck, props.settings);
    const facilitator = Participant.join(props.facilitatorId, props.facilitatorName, 'VOTER', true);
    game.participants.set(facilitator.id.value, facilitator);
    game.record({ type: 'GameCreated', occurredAt: now, gameId: props.id });
    return game;
  }

  currentName(): GameName {
    return this.name;
  }

  addParticipant(
    id: ParticipantId,
    displayName: DisplayName,
    role: ParticipantRole,
    now: Date,
  ): void {
    if (this.participants.has(id.value)) throw new ParticipantAlreadyJoinedError(id);
    this.participants.set(id.value, Participant.join(id, displayName, role, false));
    this.record({ type: 'ParticipantJoined', occurredAt: now, gameId: this.id, participantId: id });
  }

  changeParticipantRole(id: ParticipantId, role: ParticipantRole, now: Date): void {
    this.requireParticipant(id).changeRole(role);
    this.record({
      type: 'ParticipantRoleChanged',
      occurredAt: now,
      gameId: this.id,
      participantId: id,
      role,
    });
  }

  addIssue(id: IssueId, title: string, now: Date): void {
    this.issues.push(Issue.create(id, title));
    this.record({ type: 'IssueAdded', occurredAt: now, gameId: this.id, issueId: id });
  }

  startVotingRound(id: RoundId, issueId: IssueId, now: Date): void {
    if (this.openRound()) throw new AnotherRoundOpenError(this.id);
    const issue = this.requireIssue(issueId);

    const roundNumber = this.rounds.filter((round) => round.issueId.equals(issueId)).length + 1;
    this.rounds.push(Round.open(id, issueId, roundNumber));
    issue.startVoting();
    this.record({
      type: 'VotingRoundStarted',
      occurredAt: now,
      gameId: this.id,
      roundId: id,
      issueId,
    });
  }

  castVote(participantId: ParticipantId, card: CardValue, now: Date): void {
    const participant = this.requireParticipant(participantId);
    if (participant.isSpectator()) throw new SpectatorCannotVoteError(participantId);
    if (!this.deck.contains(card)) throw new CardNotInDeckError(card);

    const round = this.requireOpenRound();
    if (round.hasSameVote(participantId, card)) return;

    round.castVote(participantId, card);
    this.record({
      type: 'VoteCast',
      occurredAt: now,
      gameId: this.id,
      roundId: round.id,
      participantId,
    });

    // autoReveal es una acción del sistema: se dispara directamente y no pasa por
    // canReveal(), que solo aplica al reveal manual iniciado por un participante.
    if (this.settings.autoReveal && round.everyVoterHasVoted(this.voterIds())) {
      this.performReveal(round, now);
    }
  }

  retractVote(participantId: ParticipantId, now: Date): void {
    this.requireParticipant(participantId);
    const round = this.requireOpenRound();
    round.retractVote(participantId);
    this.record({
      type: 'VoteRetracted',
      occurredAt: now,
      gameId: this.id,
      roundId: round.id,
      participantId,
    });
  }

  reveal(participantId: ParticipantId, now: Date): void {
    if (!this.canReveal(participantId)) throw new RevealNotAllowedError(participantId);
    this.performReveal(this.requireOpenRound(), now);
  }

  canReveal(participantId: ParticipantId): boolean {
    const participant = this.requireParticipant(participantId);
    if (this.settings.whoCanReveal === 'FACILITATOR_ONLY') return participant.isFacilitator;
    if (this.settings.whoCanReveal === 'ANYONE') return true;
    return this.settings.namedRevealers.some((allowed) => allowed.equals(participantId));
  }

  setFinalEstimate(cardValue: CardValue, now: Date): void {
    if (!this.deck.contains(cardValue)) throw new CardNotInDeckError(cardValue);

    const round = this.currentRound();
    if (!round || round.currentStatus() !== 'REVEALED') {
      throw new EstimateRequiresRevealedRoundError(this.id);
    }

    const issue = this.requireIssue(round.issueId);
    issue.estimate(cardValue);
    round.close();
    this.record({
      type: 'IssueEstimated',
      occurredAt: now,
      gameId: this.id,
      issueId: issue.id,
      finalEstimate: cardValue,
    });
  }

  pullDomainEvents(): ReadonlyArray<GameEvent> {
    const pulled = [...this.events];
    this.events.length = 0;
    return pulled;
  }

  private performReveal(round: Round, now: Date): void {
    round.reveal(now);
    this.record({ type: 'RoundRevealed', occurredAt: now, gameId: this.id, roundId: round.id });
  }

  /** La ronda más reciente de la partida, abierta o no. Base de la proyección de lectura. */
  currentRound(): Round | undefined {
    return this.rounds.at(-1);
  }

  findIssue(id: IssueId): Issue | undefined {
    return this.issues.find((issue) => issue.id.equals(id));
  }

  private openRound(): Round | undefined {
    return this.rounds.find((round) => round.isOpen());
  }

  private requireOpenRound(): Round {
    const round = this.openRound();
    if (!round) throw new NoOpenRoundError(this.id);
    return round;
  }

  private requireParticipant(id: ParticipantId): Participant {
    const participant = this.participants.get(id.value);
    if (!participant) throw new ParticipantNotFoundError(id);
    return participant;
  }

  private requireIssue(id: IssueId): Issue {
    const issue = this.findIssue(id);
    if (!issue) throw new IssueNotFoundError(id);
    return issue;
  }

  private voterIds(): ReadonlyArray<ParticipantId> {
    return [...this.participants.values()]
      .filter((participant) => !participant.isSpectator())
      .map((participant) => participant.id);
  }

  private record(event: GameEvent): void {
    this.events.push(event);
  }
}
