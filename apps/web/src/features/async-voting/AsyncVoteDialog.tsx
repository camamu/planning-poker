import type { JSX } from 'react';
import { Button, Modal } from '../../design-system/index.js';
import { VotingCardGrid } from '../game-table/components/VotingCardGrid.js';

export interface AsyncVoteDialogProps {
  readonly open: boolean;
  readonly issueTitle: string;
  readonly cards: ReadonlyArray<string>;
  /** La carta que ya tiene puesta quien vota, si la tiene. */
  readonly selected: string | null;
  readonly canChangeVote: boolean;
  readonly onVote: (card: string) => void;
  readonly onClose: () => void;
}

export function AsyncVoteDialog(props: AsyncVoteDialogProps): JSX.Element | null {
  const locked = props.selected !== null && !props.canChangeVote;

  return (
    <Modal
      open={props.open}
      title={`Vota «${props.issueTitle}»`}
      onClose={props.onClose}
      actions={
        <Button variant="secondary" onClick={props.onClose}>
          Cerrar
        </Button>
      }
    >
      <p className="mb-2 text-xs" style={{ color: 'var(--pp-muted)' }}>
        {locked
          ? 'Ya has votado y esta partida no permite cambiar el voto.'
          : 'Tu voto queda oculto hasta que se revele.'}
      </p>
      <VotingCardGrid
        cards={props.cards}
        selected={props.selected}
        disabled={locked}
        onSelect={(card) => {
          props.onVote(card);
          props.onClose();
        }}
      />
    </Modal>
  );
}
