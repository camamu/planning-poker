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
  created_at: Generated<Date>;
}

export interface ParticipantTable {
  id: string;
  game_id: string;
  display_name: string;
  role: string;
  is_facilitator: boolean;
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
}

export interface VoteTable {
  round_id: string;
  participant_id: string;
  card_raw: string;
}

export interface Database {
  games: GameTable;
  participants: ParticipantTable;
  issues: IssueTable;
  rounds: RoundTable;
  votes: VoteTable;
}
