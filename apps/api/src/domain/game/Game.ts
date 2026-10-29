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
import type { IssueChanges, IssueDetails, IssueDraft } from './Issue.js';
import { Participant } from './Participant.js';
import type { ParticipantRole } from './Participant.js';
import { Round } from './Round.js';
import type { AsyncRoundEntry } from './Round.js';
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

export class FacilitatorTransferNotAllowedError extends DomainError {
  constructor(readonly participantId: ParticipantId) {
    super(`El participante ${participantId.value} no es el facilitador y no puede cederlo.`);
  }
}

export class FacilitatorStillPresentError extends DomainError {
  constructor(readonly facilitatorId: ParticipantId) {
    super(`El facilitador ${facilitatorId.value} sigue conectado: no se puede tomar su relevo.`);
  }
}

export class FacilitatorPresenceUnknownError extends DomainError {
  constructor(readonly gameId: GameId) {
    super(
      `Todavía no se sabe quién está conectado a la partida ${gameId.value}: inténtalo de nuevo en unos segundos.`,
    );
  }
}

export class GameWithoutFacilitatorError extends DomainError {
  constructor(readonly gameId: GameId) {
    super(`La partida ${gameId.value} no tiene facilitador.`);
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

export class NoOpenAsyncRoundError extends DomainError {
  constructor(readonly issueId: IssueId) {
    super(`La tarea ${issueId.value} no tiene ninguna ronda abierta en diferido.`);
  }
}

export class IssueNotPendingError extends DomainError {
  constructor(readonly issueId: IssueId) {
    super(
      `La tarea ${issueId.value} no se puede abrir en diferido: tiene que estar pendiente y sin ronda abierta.`,
    );
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

  /** Las rondas de una tarea en el orden en que se abrieron, para compararlas entre sí. */
  roundsOf(issueId: IssueId): ReadonlyArray<Round> {
    return this.rounds.filter((round) => round.issueId.equals(issueId));
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

  addIssue(id: IssueId, title: string, now: Date, details: IssueDetails = {}): void {
    this.issues.push(Issue.create(id, title, details.description, details.externalUrl));
    this.record({ type: 'IssueAdded', occurredAt: now, gameId: this.id, issueId: id });
  }

  /**
   * Todas o ninguna: se crean primero (un título vacío lanza antes de tocar la cola) y se añaden
   * de golpe. Registra un único evento en vez de un `IssueAdded` por tarea: con N eventos cada
   * cliente haría N `resync` (ADR 0023). Una lista vacía no cambia nada y no emite nada.
   */
  importIssues(entries: ReadonlyArray<IssueDraft>, now: Date): void {
    const imported = entries.map((entry) =>
      Issue.create(entry.id, entry.title, entry.description, entry.externalUrl),
    );
    if (imported.length === 0) return;
    this.issues.push(...imported);
    this.record({
      type: 'IssuesImported',
      occurredAt: now,
      gameId: this.id,
      issueIds: imported.map((issue) => issue.id),
    });
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

  /**
   * Si la tarea tiene una ronda asíncrona abierta, la ronda en vivo la absorbe (ADR 0027): arranca
   * con sus votos y la asíncrona se retira, para que quien votó en diferido no repita y no queden dos
   * rondas abiertas sobre la misma tarea. Esos votos pueden completar la ronda, así que se repasa el
   * auto-revelado como al votar; si no, la ronda se revelaría sola en el siguiente cambio de presencia.
   */
  startVotingRound(
    id: RoundId,
    issueId: IssueId,
    now: Date,
    present?: ReadonlyArray<ParticipantId>,
  ): void {
    if (this.openRound()) throw new AnotherRoundOpenError(this.id);
    const issue = this.requireIssue(issueId);

    const absorbed = this.openAsyncRound(issueId);
    if (absorbed) this.rounds.splice(this.rounds.indexOf(absorbed), 1);

    const roundNumber = this.roundsOf(issueId).length + 1;
    const timerDeadline =
      this.settings.countdownSeconds != null
        ? new Date(now.getTime() + this.settings.countdownSeconds * 1000)
        : null;
    const round = Round.open(id, issueId, roundNumber, timerDeadline, now);
    if (absorbed) round.adoptVotesFrom(absorbed);
    this.rounds.push(round);
    issue.startVoting();
    this.record({
      type: 'VotingRoundStarted',
      occurredAt: now,
      gameId: this.id,
      roundId: id,
      issueId,
    });

    if (absorbed && round.voteCount() > 0) this.autoRevealIfComplete(round, present, now);
  }

  /**
   * Abre en diferido varias tareas de golpe, todas o ninguna: se validan todas antes de crear
   * ninguna. Cada una tiene que estar pendiente y sin ronda abierta; una repetida en la lista falla
   * igual que una ya abierta. Cualquier participante puede abrirlas, como una ronda en vivo. Una
   * lista vacía no cambia nada y no emite nada.
   */
  openAsyncRounds(
    entries: ReadonlyArray<AsyncRoundEntry>,
    requestedBy: ParticipantId,
    now: Date,
  ): void {
    this.requireParticipant(requestedBy);
    const seen = new Set<string>();
    for (const entry of entries) {
      const issue = this.requireIssue(entry.issueId);
      if (
        issue.currentStatus() !== 'PENDING' ||
        this.openAsyncRound(entry.issueId) ||
        seen.has(entry.issueId.value)
      ) {
        throw new IssueNotPendingError(entry.issueId);
      }
      seen.add(entry.issueId.value);
    }
    if (entries.length === 0) return;

    for (const entry of entries) {
      const roundNumber = this.roundsOf(entry.issueId).length + 1;
      this.rounds.push(Round.openAsync(entry.roundId, entry.issueId, roundNumber, now));
    }
    this.record({ type: 'AsyncRoundsOpened', occurredAt: now, gameId: this.id, rounds: entries });
  }

  /**
   * Mismas reglas que `castVote` (espectador, carta en la baraja, `allowVoteChange`) sobre la ronda
   * asíncrona abierta de la tarea. Nunca revela: eso lo decide quien puede revelar, en lote.
   */
  castAsyncVote(participantId: ParticipantId, issueId: IssueId, card: CardValue, now: Date): void {
    this.requireVoteAllowed(participantId, card);
    const round = this.openAsyncRound(issueId);
    if (!round) throw new NoOpenAsyncRoundError(issueId);
    if (!this.placeVote(round, participantId, card)) return;

    this.record({
      type: 'AsyncVoteCast',
      occurredAt: now,
      gameId: this.id,
      roundId: round.id,
      issueId,
      participantId,
    });
  }

  /**
   * Revela las rondas asíncronas abiertas que tienen al menos un voto: las de `issueIds`, o todas
   * con `'ALL'`. Una ronda sin votos no tiene resultado que enseñar y se deja abierta; una tarea sin
   * ronda asíncrona abierta (alguien se adelantó) se ignora. Si no queda nada que revelar, no emite.
   */
  revealAsyncRounds(
    issueIds: ReadonlyArray<IssueId> | 'ALL',
    requestedBy: ParticipantId,
    now: Date,
  ): void {
    if (!this.canRevealWithoutLiveRound(requestedBy)) throw new RevealNotAllowedError(requestedBy);
    if (issueIds !== 'ALL') {
      for (const issueId of issueIds) this.requireIssue(issueId);
    }

    const revealed = this.rounds.filter(
      (round) =>
        round.isAsync() &&
        round.isOpen() &&
        round.voteCount() > 0 &&
        (issueIds === 'ALL' || issueIds.some((issueId) => issueId.equals(round.issueId))),
    );
    if (revealed.length === 0) return;

    for (const round of revealed) round.reveal(now);
    this.record({
      type: 'AsyncRoundsRevealed',
      occurredAt: now,
      gameId: this.id,
      rounds: revealed.map((round) => ({ roundId: round.id, issueId: round.issueId })),
    });
  }

  /**
   * Las rondas asíncronas que siguen vivas para la sala: abiertas, o reveladas y a la espera de
   * estimación. Una tarea que ya se ha llevado a la mesa o se ha estimado tiene una ronda posterior o
   * cerrada, y deja de aparecer aquí.
   */
  activeAsyncRounds(): ReadonlyArray<Round> {
    return this.rounds.filter(
      (round) =>
        round.isAsync() &&
        round.currentStatus() !== 'CLOSED' &&
        this.roundsOf(round.issueId).at(-1) === round,
    );
  }

  castVote(
    participantId: ParticipantId,
    card: CardValue,
    now: Date,
    present?: ReadonlyArray<ParticipantId>,
  ): void {
    this.requireVoteAllowed(participantId, card);
    const round = this.requireOpenRound();
    if (!this.placeVote(round, participantId, card)) return;

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

    // También las rondas asíncronas abiertas: un voto de quien ya no está no debe salir al revelarlas.
    for (const round of this.rounds.filter((r) => r.isOpen() && r.hasVoted(targetId))) {
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

  /** Para acciones fuera del agregado que piden «estar en la partida» (p. ej. enviar el resumen a un webhook). */
  assertParticipant(id: ParticipantId): void {
    this.requireParticipant(id);
  }

  hasParticipantLeft(id: ParticipantId): boolean {
    return this.participants.get(id.value)?.hasLeft() ?? false;
  }

  /**
   * Solo el facilitador actual, y a alguien que siga en la partida. Cederse el rol a uno mismo no
   * hace nada (ni evento). Sigue habiendo exactamente un facilitador: lo que uno pierde lo gana el
   * otro en el mismo gesto (ADR 0021).
   */
  transferFacilitator(toId: ParticipantId, requestedBy: ParticipantId, now: Date): void {
    const requester = this.requireParticipant(requestedBy);
    if (!requester.isFacilitator) throw new FacilitatorTransferNotAllowedError(requestedBy);
    const target = this.requireParticipant(toId);
    if (requestedBy.equals(toId)) return;
    this.handOverFacilitator(requester, target, now);
  }

  /**
   * Cualquier participante puede tomar el relevo de un facilitador que no está conectado, para que
   * la sala no se quede sin quien toque ajustes o, con `FACILITATOR_ONLY`, revele. La presencia
   * sigue fuera del dominio (ADR 0015): llega como dato. `present` ausente = todavía no se sabe
   * quién está (la API acaba de arrancar), y se rechaza para no quitarle el rol a quien solo está
   * reconectando. Quien pide cuenta como presente: si es el propio facilitador, no hay relevo que tomar.
   */
  claimFacilitator(
    requestedBy: ParticipantId,
    now: Date,
    present?: ReadonlyArray<ParticipantId>,
  ): void {
    const claimer = this.requireParticipant(requestedBy);
    const current = this.requireFacilitator();
    if (current.id.equals(requestedBy)) throw new FacilitatorStillPresentError(current.id);
    if (!present) throw new FacilitatorPresenceUnknownError(this.id);
    if (present.some((id) => id.equals(current.id))) {
      throw new FacilitatorStillPresentError(current.id);
    }
    this.handOverFacilitator(current, claimer, now);
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
   * El dealer sale de la ronda en vivo, así que sin ella `DEALER` no designaría a nadie y las rondas
   * asíncronas no se podrían revelar ni estimar. En ese caso decide el facilitador.
   */
  private canRevealWithoutLiveRound(participantId: ParticipantId): boolean {
    const participant = this.requireParticipant(participantId);
    if (this.settings.whoCanReveal === 'DEALER' && this.currentDealer() === null) {
      return participant.isFacilitator;
    }
    return this.canReveal(participantId);
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
    if (this.openRound() || this.rounds.some((round) => round.isAsync() && round.isOpen())) {
      throw new DeckChangeDuringVotingError(this.id);
    }
    this.deck = deck;
    this.record({ type: 'GameDeckChanged', occurredAt: now, gameId: this.id, deck });
  }

  /**
   * Mismo permiso que revelar: cerrar la issue es el otro extremo de la misma decisión. Con `issueId`
   * cierra la última ronda de esa tarea en vez de la ronda actual de la mesa, que es como se estiman
   * las tareas reveladas en lote sin llevarlas antes a la mesa (ADR 0027).
   */
  setFinalEstimate(
    cardValue: CardValue,
    requestedBy: ParticipantId,
    now: Date,
    issueId?: IssueId,
  ): void {
    const allowed =
      issueId === undefined
        ? this.canReveal(requestedBy)
        : this.canRevealWithoutLiveRound(requestedBy);
    if (!allowed) throw new RevealNotAllowedError(requestedBy);
    if (!this.deck.contains(cardValue)) throw new CardNotInDeckError(cardValue);

    if (issueId !== undefined) this.requireIssue(issueId);
    const round = issueId === undefined ? this.currentRound() : this.roundsOf(issueId).at(-1);
    if (!round || round.currentStatus() !== 'REVEALED') {
      throw new EstimateRequiresRevealedRoundError(this.id);
    }

    const issue = this.requireIssue(round.issueId);
    issue.estimate(cardValue, now);
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

  /**
   * La ronda en vivo más reciente de la partida, abierta o no. Base de la proyección de lectura. Las
   * rondas asíncronas no cuentan (ADR 0027): conviven con la mesa sin ser nunca «la ronda actual».
   */
  currentRound(): Round | undefined {
    return this.rounds.findLast((round) => round.isLive());
  }

  findIssue(id: IssueId): Issue | undefined {
    return this.issues.find((issue) => issue.id.equals(id));
  }

  private openRound(): Round | undefined {
    return this.rounds.find((round) => round.isLive() && round.isOpen());
  }

  private openAsyncRound(issueId: IssueId): Round | undefined {
    return this.rounds.find(
      (round) => round.isAsync() && round.isOpen() && round.issueId.equals(issueId),
    );
  }

  private requireOpenRound(): Round {
    const round = this.openRound();
    if (!round) throw new NoOpenRoundError(this.id);
    return round;
  }

  private requireVoteAllowed(participantId: ParticipantId, card: CardValue): void {
    const participant = this.requireParticipant(participantId);
    if (participant.isSpectator()) throw new SpectatorCannotVoteError(participantId);
    if (!this.deck.contains(card)) throw new CardNotInDeckError(card);
  }

  /** Devuelve `false` si el voto ya era ese: repetirlo no es un hecho nuevo y no genera evento. */
  private placeVote(round: Round, participantId: ParticipantId, card: CardValue): boolean {
    if (round.hasSameVote(participantId, card)) return false;
    if (!this.settings.allowVoteChange && round.hasVoted(participantId)) {
      throw new VoteChangeNotAllowedError(participantId);
    }
    round.castVote(participantId, card);
    return true;
  }

  private requireParticipant(id: ParticipantId): Participant {
    const participant = this.participants.get(id.value);
    if (!participant || participant.hasLeft()) throw new ParticipantNotFoundError(id);
    return participant;
  }

  private requireFacilitator(): Participant {
    const facilitator = [...this.participants.values()].find(
      (participant) => participant.isFacilitator && !participant.hasLeft(),
    );
    if (!facilitator) throw new GameWithoutFacilitatorError(this.id);
    return facilitator;
  }

  private handOverFacilitator(from: Participant, to: Participant, now: Date): void {
    from.demote();
    to.promote();
    this.record({
      type: 'FacilitatorChanged',
      occurredAt: now,
      gameId: this.id,
      previousId: from.id,
      nextId: to.id,
    });
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
