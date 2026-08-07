import type { CardValue } from '../../deck/CardValue.js';
import type { DomainEvent } from '../../shared/DomainEvent.js';
import type { GameId, IssueId, ParticipantId, RoundId } from '../ids.js';
import type { ParticipantRole } from '../Participant.js';

export type GameEvent = DomainEvent &
  (
    | { readonly type: 'GameCreated'; readonly gameId: GameId }
    | {
        readonly type: 'ParticipantJoined';
        readonly gameId: GameId;
        readonly participantId: ParticipantId;
      }
    | {
        readonly type: 'ParticipantRoleChanged';
        readonly gameId: GameId;
        readonly participantId: ParticipantId;
        readonly role: ParticipantRole;
      }
    | { readonly type: 'IssueAdded'; readonly gameId: GameId; readonly issueId: IssueId }
    | {
        readonly type: 'VotingRoundStarted';
        readonly gameId: GameId;
        readonly roundId: RoundId;
        readonly issueId: IssueId;
      }
    | {
        readonly type: 'VoteCast';
        readonly gameId: GameId;
        readonly roundId: RoundId;
        readonly participantId: ParticipantId;
      }
    | {
        readonly type: 'VoteRetracted';
        readonly gameId: GameId;
        readonly roundId: RoundId;
        readonly participantId: ParticipantId;
      }
    | { readonly type: 'RoundRevealed'; readonly gameId: GameId; readonly roundId: RoundId }
    | {
        readonly type: 'IssueEstimated';
        readonly gameId: GameId;
        readonly issueId: IssueId;
        readonly finalEstimate: CardValue;
      }
  );
