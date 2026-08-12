import { useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import type { ParticipantRoleView } from '@pp/contracts';
import { Button, Input, SegmentedControl } from '../../design-system/index.js';
import { joinGame } from '../../shared/api/gamesClient.js';
import { saveParticipantIdentity } from '../../shared/viewer/ParticipantIdProvider.js';
import type { ParticipantIdentity } from '../../shared/viewer/ParticipantIdProvider.js';

export interface JoinGamePageProps {
  readonly gameId: string;
  readonly onJoined: (identity: ParticipantIdentity) => void;
}

const ROLE_OPTIONS: ReadonlyArray<{ value: ParticipantRoleView; label: string }> = [
  { value: 'VOTER', label: '🃏 Voto' },
  { value: 'SPECTATOR', label: '👀 Miro' },
];

export function JoinGamePage({ gameId, onJoined }: JoinGamePageProps): JSX.Element {
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<ParticipantRoleView>('VOTER');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await joinGame(gameId, { displayName, role });
      const identity: ParticipantIdentity = { participantId: result.participantId, displayName };
      saveParticipantIdentity(gameId, identity);
      onJoined(identity);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo entrar a la partida.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-[400px] max-w-full flex-col items-center gap-4 py-16 text-center">
      <div className="flex gap-2" aria-hidden="true">
        <span className="text-2xl">🂡</span>
        <span className="text-2xl">🂮</span>
        <span className="text-2xl">🂫</span>
      </div>
      <h1 className="text-lg">Te esperan para estimar</h1>
      <form
        className="flex w-full flex-col gap-4"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <Input
          label="Tu nombre"
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
          }}
          required
        />
        <div className="field flex flex-col items-center gap-2">
          <SegmentedControl<ParticipantRoleView>
            name="role"
            value={role}
            onChange={setRole}
            options={ROLE_OPTIONS}
          />
        </div>
        {error ? <p style={{ color: '#e5484d' }}>{error}</p> : null}
        <Button type="submit" variant="primary" block disabled={submitting}>
          {submitting ? 'Entrando…' : 'Sentarme a la mesa'}
        </Button>
      </form>
    </div>
  );
}
