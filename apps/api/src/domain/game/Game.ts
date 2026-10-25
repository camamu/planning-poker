import type { CardValue } from '../deck/CardValue.js';
import type { Deck } from '../deck/Deck.js';
import { DomainError } from '../shared/DomainError.js';
import type { DisplayName } from './DisplayName.js';
import type { GameEvent } from './events/GameEvent.js';
import type { GameName } from './GameName.js';
import type { GameSettings } from './GameSettings.js';
import type { Hat } from './Hat.js';
import type { GameId, IssueId, ParticipantId, RoundId } from './ids.js';
import { Issue } from './Issue.js';
import type { IssueChanges } from './Issue.js';
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

export class ParticipantRemovalNotAllowedError extends DomainError {
  constructor(readonly participantId: ParticipantId) {
    super(`El participante ${participantId.value} no puede quitar a otro de la partida.`);
  }
}

export class FacilitatorCannotLeaveError extends DomainError {
  constructor(readonly participantId: ParticipantId) {
    super(`El facilitador ${participantId.value} no puede salir de la partida.`);
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

export class IssueHasRoundsError extends DomainError {
  constructor(readonly issueId: IssueId) {
    super(
      `La issue ${issueId.value} ya tiene rondas: solo se puede borrar una tarea que nunca se ha votado.`,
    );
  }
}

export class InvalidIssueOrderError extends DomainError {
  constructor(readonly gameId: GameId) {
    super(`El orden recibido no contiene exactamente las tareas de la partida ${gameId.value}.`);
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

export class HatChangeNotAllowedError extends DomainError {
  constructor(readonly participantId: ParticipantId) {
    super(`El participante ${participantId.value} no puede cambiar el sombrero de otro.`);
  }
}

export class DeckChangeDuringVotingError extends DomainError {
  constructor(readonly gameId: GameId) {
    super(
      `La partida ${gameId.value} tiene una ronda abierta: la baraja solo se puede cambiar entre rondas.`,
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
    private deck: Deck,
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

  /**
   * Cualquier participante que no haya salido, mismo criterio que `addIssue`: la cola es de toda la
   * sala. También vale para una tarea ya votada — es la forma de corregirla (ADR 0019).
   */
  editIssue(issueId: IssueId, changes: IssueChanges, requestedBy: ParticipantId, now: Date): void {
    this.requireParticipant(requestedBy);
    this.requireIssue(issueId).rename(changes.title, changes.description, changes.externalUrl);
    this.record({ type: 'IssueEdited', occurredAt: now, gameId: this.id, issueId });
  }

  /**
   * Solo una tarea que nunca ha tenido ronda: las rondas y sus votos son histórico (F7) y
   * `currentRound()` podría acabar apuntando a otra ronda. Cubre también la tarea de la ronda abierta.
   */
  removeIssue(issueId: IssueId, requestedBy: ParticipantId, now: Date): void {
    this.requireParticipant(requestedBy);
    this.requireIssue(issueId);
    if (this.rounds.some((round) => round.issueId.equals(issueId))) {
      throw new IssueHasRoundsError(issueId);
    }
    this.issues.splice(
      this.issues.findIndex((issue) => issue.id.equals(issueId)),
      1,
    );
    this.record({ type: 'IssueRemoved', occurredAt: now, gameId: this.id, issueId });
  }

  /**
   * Exige una permutación exacta de las tareas actuales. Un orden parcial obligaría a decidir dónde
   * van las que faltan, y dos clientes reordenando a la vez darían resultados distintos según quién
   * llegue primero. Valida todo antes de tocar la cola, para no dejarla a medias.
   */
  reorderIssues(orderedIds: ReadonlyArray<IssueId>, requestedBy: ParticipantId, now: Date): void {
    this.requireParticipant(requestedBy);

    const remaining = new Map(this.issues.map((issue) => [issue.id.value, issue]));
    const reordered: Issue[] = [];
    for (const id of orderedIds) {
      const issue = remaining.get(id.value);
      // Un id repetido ya no está en `remaining` la segunda vez, así que cae aquí igual que uno ajeno.
      if (!issue) throw new InvalidIssueOrderError(this.id);
      remaining.delete(id.value);
      reordered.push(issue);
    }
    if (remaining.size > 0) throw new InvalidIssueOrderError(this.id);

    this.issues.splice(0, this.issues.length, ...reordered);
    this.record({
      type: 'IssuesReordered',
      occurredAt: now,
      gameId: this.id,
      issueIds: orderedIds,
    });
  }

  /**
   * Vota ya, sin pasar antes por la cola de tareas: crea una issue con título por defecto y abre
   * la ronda sobre ella en el mismo gesto. Comprueba `AnotherRoundOpenError` antes de tocar nada
   * para no dejar una issue añadida sin ronda si ya había una abierta. Por lo demás reutiliza
   * `addIssue`/`startVotingRound` tal cual para heredar el resto de sus invariantes en vez de
   * duplicarlas.
   */
  startQuickRound(issueId: IssueId, roundId: RoundId, now: Date): void {
    if (this.openRound()) throw new AnotherRoundOpenError(this.id);
    const title = `Ronda rápida ${(this.issues.length + 1).toString()}`;
    this.addIssue(issueId, title, now);
    this.startVotingRound(roundId, issueId, now);
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

  castVote(
    participantId: ParticipantId,
    card: CardValue,
    now: Date,
    present?: ReadonlyArray<ParticipantId>,
  ): void {
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

    // Quien acaba de votar está presente por definición, aunque el seguimiento de presencia
    // todavía no lo sepa (su socket puede estar a medio reconectar).
    this.autoRevealIfComplete(round, present ? [...present, participantId] : undefined, now);
  }

  /**
   * Revisa si la ronda abierta ya está completa cuando cambia quién está presente (invariante 8:
   * "todos los VOTER presentes han votado"). Sin al menos un voto no revela: una ronda vacía no
   * tiene resultado que mostrar. `present` ausente = nadie se descarta por estar desconectado.
   */
  reconcileAutoReveal(now: Date, present?: ReadonlyArray<ParticipantId>): void {
    const round = this.openRound();
    if (!round || round.voteCount() === 0) return;
    this.autoRevealIfComplete(round, present, now);
  }

  /**
   * Cada uno elige su propio sombrero, también los espectadores y en mitad de una ronda: es pura
   * cosmética y no afecta a votos ni permisos. Ni el facilitador puede ponérselo a otro.
   */
  changeParticipantHat(
    targetId: ParticipantId,
    hat: Hat | null,
    requestedBy: ParticipantId,
    now: Date,
  ): void {
    const target = this.requireParticipant(targetId);
    if (!requestedBy.equals(targetId)) throw new HatChangeNotAllowedError(requestedBy);
    target.wearHat(hat);
    this.record({
      type: 'ParticipantHatChanged',
      occurredAt: now,
      gameId: this.id,
      participantId: targetId,
      hat,
    });
  }

  /**
   * Un participante sale (él mismo) o lo quita el facilitador. Es baja lógica: sus votos en rondas
   * ya reveladas se conservan, pero su voto en la ronda abierta se retira porque ya no forma parte
   * de ella. El facilitador no puede salir: sin él nadie podría tocar ajustes ni baraja.
   */
  removeParticipant(
    targetId: ParticipantId,
    requestedBy: ParticipantId,
    now: Date,
    present?: ReadonlyArray<ParticipantId>,
  ): void {
    const requester = this.requireParticipant(requestedBy);
    const target = this.requireParticipant(targetId);
    if (!requestedBy.equals(targetId) && !requester.isFacilitator) {
      throw new ParticipantRemovalNotAllowedError(requestedBy);
    }
    if (target.isFacilitator) throw new FacilitatorCannotLeaveError(targetId);

    target.leave();
    this.record({
      type: 'ParticipantLeft',
      occurredAt: now,
      gameId: this.id,
      participantId: targetId,
    });

    const round = this.openRound();
    if (!round) return;
    if (round.hasVoted(targetId)) {
      round.retractVote(targetId);
      this.record({
        type: 'VoteRetracted',
        occurredAt: now,
        gameId: this.id,
        roundId: round.id,
        participantId: targetId,
      });
    }
    this.reconcileAutoReveal(now, present);
  }

  hasParticipantLeft(id: ParticipantId): boolean {
    return this.participants.get(id.value)?.hasLeft() ?? false;
  }

  // autoReveal es una acción del sistema: se dispara directamente y no pasa por canReveal(), que
  // solo aplica al reveal manual iniciado por un participante.
  private autoRevealIfComplete(
    round: Round,
    present: ReadonlyArray<ParticipantId> | undefined,
    now: Date,
  ): void {
    if (this.settings.autoReveal && round.everyVoterHasVoted(this.voterIds(present))) {
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
      .filter((participant) => !participant.hasLeft() && !participant.isSpectator())
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

  /**
   * Solo el facilitador, y nunca con una ronda abierta: los votos ya emitidos podrían no existir
   * en la baraja nueva y quedaría una ronda con cartas que nadie puede volver a elegir. Una ronda
   * ya revelada no lo impide — su resultado es histórico y no vuelve a validarse contra la baraja.
   */
  /** Cualquier participante, espectadores incluidos (ADR 0018): la baraja es de toda la sala. */
  changeDeck(deck: Deck, requestedBy: ParticipantId, now: Date): void {
    this.requireParticipant(requestedBy);
    if (this.openRound()) throw new DeckChangeDuringVotingError(this.id);
    this.deck = deck;
    this.record({ type: 'GameDeckChanged', occurredAt: now, gameId: this.id, deck });
  }

  /** Mismo permiso que revelar: cerrar la issue es el otro extremo de la misma decisión. */
  setFinalEstimate(cardValue: CardValue, requestedBy: ParticipantId, now: Date): void {
    if (!this.canReveal(requestedBy)) throw new RevealNotAllowedError(requestedBy);
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
    if (!participant || participant.hasLeft()) throw new ParticipantNotFoundError(id);
    return participant;
  }

  private requireIssue(id: IssueId): Issue {
    const issue = this.findIssue(id);
    if (!issue) throw new IssueNotFoundError(id);
    return issue;
  }

  private voterIds(present?: ReadonlyArray<ParticipantId>): ReadonlyArray<ParticipantId> {
    return [...this.participants.values()]
      .filter((participant) => !participant.hasLeft() && !participant.isSpectator())
      .filter((participant) => !present || present.some((id) => id.equals(participant.id)))
      .map((participant) => participant.id);
  }

  private record(event: GameEvent): void {
    this.events.push(event);
  }
}
