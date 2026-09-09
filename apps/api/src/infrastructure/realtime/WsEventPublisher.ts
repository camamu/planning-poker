import type { ServerEvent } from '@pp/contracts';
import { toRoundResultView } from '../../application/read-models/toGameView.js';
import type { EventPublisher } from '../../application/ports/EventPublisher.js';
import type { GameRepository } from '../../application/ports/GameRepository.js';
import type { RealtimeBroadcaster } from '../../application/ports/RealtimeBroadcaster.js';
import type { GameEvent } from '../../domain/game/events/GameEvent.js';
import type { GameId } from '../../domain/game/ids.js';
import type { GameVersionTracker } from './GameVersionTracker.js';

// `Omit` no distribuye sobre uniones: aplicado directo a `ServerEvent` colapsaría las variantes
// del discriminated union en una sola forma. Sin esto, TS deja de saber que 'issue_estimated'
// trae `finalEstimate` o que 'participant_joined' trae `participantId`.
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type OutboundEvent = DistributiveOmit<ServerEvent, 'version'>;

/**
 * Traduce eventos de dominio a mensajes de tiempo real y los reparte por la room de la partida.
 * `save()` siempre precede a `publishAll()` en los casos de uso (regla permanente 3), así que
 * releer por `GameRepository` aquí ve el estado ya persistido — necesario para `RoundRevealed`,
 * cuyo evento de dominio no lleva los votos ni el resultado.
 */
export class WsEventPublisher implements EventPublisher {
  constructor(
    private readonly games: GameRepository,
    private readonly broadcaster: RealtimeBroadcaster,
    private readonly versions: GameVersionTracker,
  ) {}

  async publishAll(events: ReadonlyArray<GameEvent>): Promise<void> {
    for (const event of events) {
      await this.publishOne(event);
    }
  }

  private async publishOne(event: GameEvent): Promise<void> {
    const outbound = await this.toOutboundEvent(event);
    if (!outbound) return;

    const version = this.versions.next(event.gameId);
    await this.broadcaster.broadcastToGame(event.gameId, { ...outbound, version });
  }

  private async toOutboundEvent(event: GameEvent): Promise<OutboundEvent | null> {
    switch (event.type) {
      case 'GameCreated':
        // Nadie está todavía en la room de una partida que se acaba de crear.
        return null;
      case 'ParticipantJoined':
        return { type: 'participant_joined', participantId: event.participantId.value };
      case 'ParticipantRoleChanged':
        return {
          type: 'participant_role_changed',
          participantId: event.participantId.value,
          role: event.role,
        };
      case 'IssueAdded':
        return { type: 'issue_added', issueId: event.issueId.value };
      case 'VotingRoundStarted':
        return {
          type: 'round_started',
          roundId: event.roundId.value,
          issueId: event.issueId.value,
        };
      case 'VoteCast':
        return {
          type: 'participant_voted',
          roundId: event.roundId.value,
          participantId: event.participantId.value,
        };
      case 'VoteRetracted':
        return {
          type: 'vote_retracted',
          roundId: event.roundId.value,
          participantId: event.participantId.value,
        };
      case 'RoundRevealed':
        return this.toRoundRevealedEvent(event.gameId);
      case 'IssueEstimated':
        return {
          type: 'issue_estimated',
          issueId: event.issueId.value,
          finalEstimate: event.finalEstimate.raw,
        };
      case 'GameSettingsChanged':
        return {
          type: 'settings_changed',
          settings: {
            autoReveal: event.settings.autoReveal,
            whoCanReveal: event.settings.whoCanReveal,
            namedRevealers: event.settings.namedRevealers.map((id) => id.value),
            allowVoteChange: event.settings.allowVoteChange,
            celebrate: event.settings.celebrate,
            throwEmojis: event.settings.throwEmojis,
            countdownSeconds: event.settings.countdownSeconds,
            revealOnTimeout: event.settings.revealOnTimeout,
          },
        };
    }
  }

  private async toRoundRevealedEvent(gameId: GameId): Promise<OutboundEvent | null> {
    const game = await this.games.findById(gameId);
    const round = game?.currentRound();
    if (!round?.isRevealed()) return null;

    return {
      type: 'round_revealed',
      roundId: round.id.value,
      votes: round
        .revealedVotes()
        .map((vote) => ({ participantId: vote.participantId.value, card: vote.card.raw })),
      result: toRoundResultView(round.revealedResult()),
    };
  }
}
