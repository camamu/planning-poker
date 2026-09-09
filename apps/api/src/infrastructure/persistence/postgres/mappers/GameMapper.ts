import type { Insertable, Selectable } from 'kysely';
import { CardValue } from '../../../../domain/deck/CardValue.js';
import { Deck } from '../../../../domain/deck/Deck.js';
import { DisplayName } from '../../../../domain/game/DisplayName.js';
import { Game } from '../../../../domain/game/Game.js';
import { GameName } from '../../../../domain/game/GameName.js';
import { GameSettings } from '../../../../domain/game/GameSettings.js';
import type { WhoCanReveal } from '../../../../domain/game/GameSettings.js';
import { GameId, IssueId, ParticipantId, RoundId } from '../../../../domain/game/ids.js';
import { Issue } from '../../../../domain/game/Issue.js';
import type { IssueStatus } from '../../../../domain/game/Issue.js';
import { Participant } from '../../../../domain/game/Participant.js';
import type { ParticipantRole } from '../../../../domain/game/Participant.js';
import { Round } from '../../../../domain/game/Round.js';
import type { RoundStatus, RoundVote } from '../../../../domain/game/Round.js';
import { TeamId } from '../../../../domain/team/TeamId.js';
import type { GameTable, IssueTable, ParticipantTable, RoundTable, VoteTable } from '../schema.js';

export interface GameRowSet {
  readonly game: Selectable<GameTable>;
  readonly participants: ReadonlyArray<Selectable<ParticipantTable>>;
  readonly issues: ReadonlyArray<Selectable<IssueTable>>;
  readonly rounds: ReadonlyArray<Selectable<RoundTable>>;
  readonly votes: ReadonlyArray<Selectable<VoteTable>>;
}

export function toGameRow(game: Game): Insertable<GameTable> {
  const settings = game.currentSettings();
  return {
    id: game.id.value,
    name: game.currentName().value,
    deck: JSON.stringify(
      game
        .currentDeck()
        .values()
        .map((card) => card.raw),
    ),
    auto_reveal: settings.autoReveal,
    who_can_reveal: settings.whoCanReveal,
    named_revealers: JSON.stringify(settings.namedRevealers.map((id) => id.value)),
    allow_vote_change: settings.allowVoteChange,
    celebrate: settings.celebrate,
    throw_emojis: settings.throwEmojis,
    countdown_seconds: settings.countdownSeconds,
    reveal_on_timeout: settings.revealOnTimeout,
    team_id: game.currentTeamId()?.value ?? null,
  };
}

export function toParticipantRows(game: Game): Insertable<ParticipantTable>[] {
  return game.allParticipants().map((participant) => ({
    id: participant.id.value,
    game_id: game.id.value,
    display_name: participant.displayName.value,
    role: participant.currentRole(),
    is_facilitator: participant.isFacilitator,
    position: participant.joinOrder,
  }));
}

export function toIssueRows(game: Game): Insertable<IssueTable>[] {
  return game.allIssues().map((issue, position) => ({
    id: issue.id.value,
    game_id: game.id.value,
    position,
    title: issue.title,
    description: issue.description ?? null,
    external_url: issue.externalUrl ?? null,
    status: issue.currentStatus(),
    final_estimate_raw: issue.currentFinalEstimate()?.raw ?? null,
  }));
}

export function toRoundRows(game: Game): Insertable<RoundTable>[] {
  return game.allRounds().map((round, position) => ({
    id: round.id.value,
    game_id: game.id.value,
    issue_id: round.issueId.value,
    position,
    round_number: round.roundNumber,
    status: round.currentStatus(),
    revealed_at: round.currentRevealedAt(),
    timer_deadline: round.currentTimerDeadline(),
  }));
}

export function toVoteRows(game: Game): Insertable<VoteTable>[] {
  return game.allRounds().flatMap((round) =>
    round.allVotesRaw().map((vote) => ({
      round_id: round.id.value,
      participant_id: vote.participantId.value,
      card_raw: vote.card.raw,
    })),
  );
}

export function toDomainGame(rows: GameRowSet): Game {
  const votesByRound = new Map<string, RoundVote[]>();
  for (const voteRow of rows.votes) {
    const votes = votesByRound.get(voteRow.round_id) ?? [];
    votes.push({
      participantId: ParticipantId.of(voteRow.participant_id),
      card: CardValue.of(voteRow.card_raw),
    });
    votesByRound.set(voteRow.round_id, votes);
  }

  return Game.reconstitute({
    id: GameId.of(rows.game.id),
    name: GameName.of(rows.game.name),
    deck: Deck.of(rows.game.deck.map((raw) => CardValue.of(raw))),
    settings: GameSettings.of({
      autoReveal: rows.game.auto_reveal,
      whoCanReveal: parseWhoCanReveal(rows.game.who_can_reveal),
      namedRevealers: rows.game.named_revealers.map((raw) => ParticipantId.of(raw)),
      allowVoteChange: rows.game.allow_vote_change,
      celebrate: rows.game.celebrate,
      throwEmojis: rows.game.throw_emojis,
      countdownSeconds: rows.game.countdown_seconds,
      revealOnTimeout: rows.game.reveal_on_timeout,
    }),
    ...(rows.game.team_id ? { teamId: TeamId.of(rows.game.team_id) } : {}),
    // El orden importa (Game.currentDealer() lo usa) y lo garantiza la consulta con
    // `orderBy('position', 'asc')` en PostgresGameRepository, no este mapper.
    participants: rows.participants.map((row) =>
      Participant.join(
        ParticipantId.of(row.id),
        DisplayName.of(row.display_name),
        parseParticipantRole(row.role),
        row.is_facilitator,
        row.position,
      ),
    ),
    issues: rows.issues.map((row) =>
      Issue.reconstitute(
        IssueId.of(row.id),
        row.title,
        row.description ?? undefined,
        row.external_url ?? undefined,
        parseIssueStatus(row.status),
        row.final_estimate_raw === null ? null : CardValue.of(row.final_estimate_raw),
      ),
    ),
    rounds: rows.rounds.map((row) =>
      Round.reconstitute(
        RoundId.of(row.id),
        IssueId.of(row.issue_id),
        row.round_number,
        parseRoundStatus(row.status),
        votesByRound.get(row.id) ?? [],
        row.revealed_at,
        row.timer_deadline,
      ),
    ),
  });
}

function parseWhoCanReveal(value: string): WhoCanReveal {
  if (
    value === 'FACILITATOR_ONLY' ||
    value === 'ANYONE' ||
    value === 'NAMED_LIST' ||
    value === 'DEALER'
  ) {
    return value;
  }
  throw new Error(`who_can_reveal desconocido en BD: "${value}"`);
}

function parseParticipantRole(value: string): ParticipantRole {
  if (value === 'VOTER' || value === 'SPECTATOR') return value;
  throw new Error(`role de participante desconocido en BD: "${value}"`);
}

function parseIssueStatus(value: string): IssueStatus {
  if (value === 'PENDING' || value === 'VOTING' || value === 'ESTIMATED') return value;
  throw new Error(`status de issue desconocido en BD: "${value}"`);
}

function parseRoundStatus(value: string): RoundStatus {
  if (value === 'OPEN' || value === 'REVEALED' || value === 'CLOSED') return value;
  throw new Error(`status de ronda desconocido en BD: "${value}"`);
}
