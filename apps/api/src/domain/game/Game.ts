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
import type { TeamId } from '../team/TeamId.js';

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

export class VoteChangeNotAllowedError extends DomainError {
  constructor(readonly participantId: ParticipantId) {
    super(`El participante ${participantId.value} no puede cambiar su voto en esta ronda.`);
  }
}

export class SettingsChangeNotAllowedError extends DomainError {
  constructor(readonly participantId: ParticipantId) {
    super(`El participante ${participantId.value} no puede cambiar los ajustes de la partida.`);
  }
}

export interface CreateGameProps {
  readonly id: GameId;
  readonly name: GameName;
  readonly deck: Deck;
  readonly settings: GameSettings;
  readonly facilitatorId: ParticipantId;
  readonly facilitatorName: DisplayName;
  /** El equipo del que salió la baraja, si la partida se creó dentro de uno. */
  readonly teamId?: TeamId | undefined;
}

export interface ReconstituteGameProps {
  readonly id: GameId;
  readonly name: GameName;
  readonly deck: Deck;
  readonly settings: GameSettings;
  readonly participants: ReadonlyArray<Participant>;
  readonly issues: ReadonlyArray<Issue>;
  readonly rounds: ReadonlyArray<Round>;
  readonly teamId?: TeamId | undefined;
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
    private settings: GameSettings,
    private readonly teamId: TeamId | null,
  ) {}

  static create(props: CreateGameProps, now: Date): Game {
    const game = new Game(props.id, props.name, props.deck, props.settings, props.teamId ?? null);
    const facilitator = Participant.join(
      props.facilitatorId,
      props.facilitatorName,
      'VOTER',
      true,
      0,
    );
    game.participants.set(facilitator.id.value, facilitator);
    game.record({ type: 'GameCreated', occurredAt: now, gameId: props.id });
    return game;
  }

  /**
   * Reconstruye una partida desde su estado persistido. A diferencia de `create()`, no registra
   * ningún evento de dominio: cargar una partida de la BD no es un hecho de negocio nuevo, y
   * publicarlo otra vez inundaría a los suscriptores con eventos que ya ocurrieron.
   */
  static reconstitute(props: ReconstituteGameProps): Game {
    const game = new Game(props.id, props.name, props.deck, props.settings, props.teamId ?? null);
    for (const participant of props.participants) {
      game.participants.set(participant.id.value, participant);
    }
    game.issues.push(...props.issues);
    game.rounds.push(...props.rounds);
    return game;
  }

  currentName(): GameName {
    return this.name;
  }

  currentDeck(): Deck {
    return this.deck;
  }

  /** La baraja se copia al crear la partida; esto solo recuerda de qué equipo vino. */
  currentTeamId(): TeamId | null {
    return this.teamId;
  }

  currentSettings(): GameSettings {
    return this.settings;
  }

  /** Solo para el mapper de persistencia; usa `findIssue`/`currentRound` para lógica de negocio. */
  allParticipants(): ReadonlyArray<Participant> {
    return [...this.participants.values()];
  }

  /** Solo para el mapper de persistencia; usa `findIssue`/`currentRound` para lógica de negocio. */
  allIssues(): ReadonlyArray<Issue> {
    return [...this.issues];
  }

  /** Solo para el mapper de persistencia; usa `findIssue`/`currentRound` para lógica de negocio. */
  allRounds(): ReadonlyArray<Round> {
    return [...this.rounds];
  }

  addParticipant(
    id: ParticipantId,
    displayName: DisplayName,
    role: ParticipantRole,
    now: Date,
  ): void {
    if (this.participants.has(id.value)) throw new ParticipantAlreadyJoinedError(id);
    this.participants.set(
      id.value,
      Participant.join(id, displayName, role, false, this.participants.size),
    );
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
    const timerDeadline =
      this.settings.countdownSeconds != null
        ? new Date(now.getTime() + this.settings.countdownSeconds * 1000)
        : null;
    this.rounds.push(Round.open(id, issueId, roundNumber, timerDeadline));
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
    if (!this.settings.allowVoteChange && round.hasVoted(participantId)) {
      throw new VoteChangeNotAllowedError(participantId);
    }

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
    if (this.settings.whoCanReveal === 'DEALER') {
      return this.currentDealer()?.equals(participantId) ?? false;
    }
    return this.settings.namedRevealers.some((allowed) => allowed.equals(participantId));
  }

  /**
   * Reveal disparado por el cliente al agotarse la cuenta atrás (F5) y validado aquí contra la
   * fecha límite guardada en la ronda — nunca contra el reloj local del cliente. No comprueba
   * `canReveal()`: es una acción del sistema, mismo precedente que el auto-reveal de `castVote`.
   * Idempotente: si ya no hay ronda abierta (alguien reveló antes) o el plazo no se ha cumplido,
   * no hace nada en vez de lanzar.
   */
  revealOnTimeout(participantId: ParticipantId, now: Date): void {
    this.requireParticipant(participantId);
    const round = this.openRound();
    if (!round) return;
    const deadline = round.currentTimerDeadline();
    if (!deadline || now.getTime() < deadline.getTime()) return;
    this.performReveal(round, now);
  }

  /**
   * El "dealer" (docs/06-handoff-diseno.md §1) no es un hecho persistido: se calcula a partir de
   * la posición de la tarea actual entre las issues de la partida y del orden de entrada de los
   * `VOTER` (los espectadores nunca reparten). Rota al pasar a la ronda de la siguiente issue;
   * "Volver a votar" sobre la misma issue no lo cambia, porque usa el mismo `currentRound()`.
   */
  currentDealer(): ParticipantId | null {
    const round = this.currentRound();
    if (!round) return null;
    const issueIndex = this.issues.findIndex((issue) => issue.id.equals(round.issueId));
    if (issueIndex < 0) return null;

    const voters = [...this.participants.values()]
      .filter((participant) => !participant.isSpectator())
      .sort((a, b) => a.joinOrder - b.joinOrder);
    if (voters.length === 0) return null;

    const dealer = voters[issueIndex % voters.length];
    return dealer ? dealer.id : null;
  }

  /** Solo el facilitador puede tocar la configuración compartida de la partida. */
  updateSettings(settings: GameSettings, requestedBy: ParticipantId, now: Date): void {
    const participant = this.requireParticipant(requestedBy);
    if (!participant.isFacilitator) throw new SettingsChangeNotAllowedError(requestedBy);
    this.settings = settings;
    this.record({ type: 'GameSettingsChanged', occurredAt: now, gameId: this.id, settings });
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
