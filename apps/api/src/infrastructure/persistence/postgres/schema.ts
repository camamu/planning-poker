import type { ColumnType, Generated } from 'kysely';

export interface GameTable {
  id: string;
  name: string;
  /** Array de `CardValue.raw` en orden de presentación, serializado a JSON al escribir. */
  deck: ColumnType<ReadonlyArray<string>, string, string>;
  auto_reveal: boolean;
  who_can_reveal: string;
  /** Array de `ParticipantId.value`, serializado a JSON al escribir. */
  named_revealers: ColumnType<ReadonlyArray<string>, string, string>;
  allow_vote_change: boolean;
  celebrate: boolean;
  throw_emojis: boolean;
  /** F5 — segundos de cuenta atrás por ronda, o `null` si está desactivada. */
  countdown_seconds: number | null;
  reveal_on_timeout: boolean;
  /** Equipo del que salió la baraja, o `null` si la partida se creó fuera de un equipo. */
  team_id: string | null;
  created_at: Generated<Date>;
}

export interface ParticipantTable {
  id: string;
  game_id: string;
  display_name: string;
  role: string;
  is_facilitator: boolean;
  /** Orden de entrada a la partida; base de `Game.currentDealer()`. Mismo patrón que issues/rounds. */
  position: number;
}

export interface IssueTable {
  id: string;
  game_id: string;
  position: number;
  title: string;
  description: string | null;
  external_url: string | null;
  status: string;
  final_estimate_raw: string | null;
}

export interface RoundTable {
  id: string;
  game_id: string;
  issue_id: string;
  position: number;
  round_number: number;
  status: string;
  revealed_at: Date | null;
  /** F5 — fecha límite de la cuenta atrás con la que se abrió la ronda, o `null`. */
  timer_deadline: Date | null;
}

export interface VoteTable {
  round_id: string;
  participant_id: string;
  card_raw: string;
}

export interface TeamTable {
  id: string;
  slug: string;
  name: string;
  token_hash: string;
  created_at: Generated<Date>;
}

export interface DeckTable {
  id: string;
  /** `null` = baraja de sistema. */
  team_id: string | null;
  name: string;
  /** Array de `CardValue.raw` en orden de presentación, serializado a JSON al escribir. */
  cards: ColumnType<ReadonlyArray<string>, string, string>;
  created_at: Generated<Date>;
}

export interface Database {
  games: GameTable;
  participants: ParticipantTable;
  issues: IssueTable;
  rounds: RoundTable;
  votes: VoteTable;
  teams: TeamTable;
  decks: DeckTable;
}
