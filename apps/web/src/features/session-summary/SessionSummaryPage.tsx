import type { JSX } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../design-system/index.js';
import { loadParticipantIdentity } from '../../shared/viewer/ParticipantIdProvider.js';
import { ExportActions } from './components/ExportActions.js';
import { SendSummaryToTeam } from './components/SendSummaryToTeam.js';
import { SummaryTable } from './components/SummaryTable.js';
import { SummaryTotals } from './components/SummaryTotals.js';
import { useGameSummary } from './useGameSummary.js';

/** `/games/:gameId/summary` — la ve cualquiera con el enlace de la partida (ADR 0025). */
export function SessionSummaryPage(): JSX.Element {
  const { gameId } = useParams<{ gameId: string }>();
  if (!gameId) return <p className="p-8">Partida no encontrada.</p>;
  return <SessionSummary gameId={gameId} />;
}

function SessionSummary({ gameId }: { readonly gameId: string }): JSX.Element {
  const { summary, error } = useGameSummary(gameId);
  // La página no tiene identidad propia (la ve quien tenga el enlace); la del navegador, si la hay,
  // es la de alguien que estuvo en la partida y puede enviar el resumen.
  const identity = loadParticipantIdentity(gameId);

  if (error) {
    return (
      <div className="mx-auto flex w-[380px] max-w-full flex-col gap-4 px-4 py-16 text-center">
        <h1 className="text-lg">No se pudo cargar el resumen</h1>
        <p style={{ color: '#e5484d' }}>{error}</p>
        <Link to="/">
          <Button variant="secondary">Volver al inicio</Button>
        </Link>
      </div>
    );
  }

  if (!summary) {
    return <div className="mx-auto w-[380px] max-w-full py-16 text-center">Cargando resumen…</div>;
  }

  return (
    <div className="mx-auto flex w-[860px] max-w-full flex-col gap-5 px-4 py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="pp-kicker">Resumen de la sesión</span>
          <h1 className="truncate text-[22px]">{summary.name}</h1>
        </div>
        <Link to={`/games/${gameId}`}>
          <Button variant="secondary">Volver a la sala</Button>
        </Link>
      </header>

      {summary.issues.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
          Esta partida todavía no tiene tareas.
        </p>
      ) : (
        <>
          <SummaryTotals totals={summary.totals} />
          <ExportActions summary={summary} />
          {summary.canSendToTeam && identity ? (
            <SendSummaryToTeam gameId={gameId} participantId={identity.participantId} />
          ) : null}
          <SummaryTable issues={summary.issues} />
          <p className="text-xs" style={{ color: 'var(--pp-muted)' }}>
            Las tareas con un acuerdo por debajo del 50 % o que necesitaron varias rondas aparecen
            resaltadas. El resumen solo recoge rondas reveladas y no muestra quién votó qué.
          </p>
        </>
      )}
    </div>
  );
}
