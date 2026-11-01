import type { SendSessionSummaryResultView } from '@pp/contracts';
import { useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../../design-system/index.js';
import { sendSessionSummary } from '../../../shared/api/gamesClient.js';

export interface SendSummaryToTeamProps {
  readonly gameId: string;
  /** Quien lo envía: tiene que ser un participante de la partida. */
  readonly participantId: string;
}

type SendState =
  | { readonly status: 'idle' }
  | { readonly status: 'sending' }
  | { readonly status: 'done'; readonly result: SendSessionSummaryResultView }
  | { readonly status: 'error'; readonly message: string };

function plural(count: number): string {
  return count === 1 ? '1 webhook' : `${count.toString()} webhooks`;
}

function describe(result: SendSessionSummaryResultView): string {
  if (result.failed === 0) return `Resumen enviado a ${plural(result.delivered)} del equipo.`;
  const total = result.delivered + result.failed;
  return `No se pudo enviar a ${result.failed.toString()} de ${plural(total)} del equipo.`;
}

/** «Enviar resumen» (ADR 0028): solo se ofrece si el equipo tiene un webhook suscrito a `session.summary`. */
export function SendSummaryToTeam({ gameId, participantId }: SendSummaryToTeamProps): JSX.Element {
  const [state, setState] = useState<SendState>({ status: 'idle' });

  function send(): void {
    setState({ status: 'sending' });
    sendSessionSummary(gameId, participantId).then(
      (result) => {
        setState({ status: 'done', result });
      },
      (cause: unknown) => {
        setState({
          status: 'error',
          message: cause instanceof Error ? cause.message : 'No se pudo enviar el resumen.',
        });
      },
    );
  }

  const failed = state.status === 'error' || (state.status === 'done' && state.result.failed > 0);

  return (
    <section aria-label="Enviar el resumen al equipo" className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" disabled={state.status === 'sending'} onClick={send}>
        {state.status === 'sending' ? 'Enviando…' : 'Enviar resumen'}
      </Button>
      <span
        role="status"
        className="text-xs"
        style={{ color: failed ? '#e5484d' : 'var(--pp-muted)' }}
      >
        {state.status === 'done' ? describe(state.result) : null}
        {state.status === 'error' ? state.message : null}
      </span>
    </section>
  );
}
