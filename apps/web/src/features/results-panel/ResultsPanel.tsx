import type { RoundView } from '@pp/contracts';
import type { JSX } from 'react';
import { Badge, Button, Tooltip } from '../../design-system/index.js';
import { formatCountdown } from '../game-table/hooks/useCountdown.js';
import { Confetti } from './Confetti.js';
import { DistributionBar } from './DistributionBar.js';

export interface ResultsPanelProps {
  readonly round: RoundView | null;
  readonly celebrate: boolean;
  readonly votedCount: number;
  readonly totalVoters: number;
  readonly remainingMs: number | null;
  readonly canReveal: boolean;
  readonly onReveal: () => void;
  readonly onRevote: () => void;
  readonly hasNextIssue: boolean;
  readonly onNextIssue: () => void;
}

export function ResultsPanel(props: ResultsPanelProps): JSX.Element {
  const { round } = props;
  if (!round) {
    return (
      <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
        Todavía no hay ninguna ronda abierta.
      </p>
    );
  }

  if (round.status === 'OPEN') {
    return <WaitingPanel {...props} round={round} />;
  }
  return <RevealedPanel {...props} round={round} />;
}

function WaitingPanel(props: ResultsPanelProps & { round: RoundView }): JSX.Element {
  const { votedCount, totalVoters } = props;
  const pct = totalVoters === 0 ? 0 : Math.round((votedCount / totalVoters) * 100);
  const revealDisabled = !props.canReveal || votedCount === 0;

  return (
    <div className="flex h-full flex-col gap-4.5">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Quién ha votado</span>
          <span className="text-xs" style={{ color: 'var(--pp-muted)' }}>
            {votedCount} de {totalVoters}
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: 'var(--pp-line)' }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${pct.toString()}%`, background: 'var(--color-accent)' }}
          />
        </div>
      </div>

      {props.remainingMs !== null ? (
        <div
          className="flex flex-col gap-2 rounded-xl border border-dashed p-3.5"
          style={{ borderColor: 'var(--pp-line)' }}
        >
          <span className="pp-kicker">Cuenta atrás</span>
          <div className="font-mono text-[26px] font-semibold">
            {formatCountdown(props.remainingMs)}
          </div>
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-2">
        <Button variant="primary" block disabled={revealDisabled} onClick={props.onReveal}>
          Revelar las cartas
        </Button>
        {revealDisabled ? (
          <span className="text-center text-[11px]" style={{ color: 'var(--pp-muted)' }}>
            {votedCount === 0 ? 'Nadie ha votado todavía.' : 'No tienes permiso para revelar.'}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function RevealedPanel(props: ResultsPanelProps & { round: RoundView }): JSX.Element {
  const { round } = props;
  const result = round.result;
  if (!result) {
    return <p className="text-sm">Sin resultado.</p>;
  }
  const total = round.votes.filter((vote) => vote.card !== null).length;
  const entries = Object.entries(result.distribution).sort(([, a], [, b]) => b - a);

  return (
    <div className="relative flex h-full flex-col gap-4">
      {props.celebrate && result.isUnanimous ? <Confetti /> : null}
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-semibold">Resultado</span>
        <Badge variant={result.isUnanimous ? 'accent' : 'outline'}>
          {result.isUnanimous ? '🎉 Revelada' : 'Revelada'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {result.average !== null ? (
          <StatTile label="Media" value={result.average.toString()} />
        ) : (
          <StatTile label="Carta más votada" value={result.mostVoted ?? '—'} />
        )}
        <StatTile label="Acuerdo" value={`${result.agreementPercentage.toString()}%`} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="pp-kicker">Distribución</span>
        {entries.map(([label, count]) => (
          <DistributionBar
            key={label}
            label={label}
            count={count}
            total={total}
            isMostVoted={label === result.mostVoted}
          />
        ))}
      </div>

      <p className="text-xs" style={{ color: 'var(--pp-muted)' }}>
        {result.isUnanimous
          ? 'Unanimidad total — se puede pasar a la siguiente sin discutir.'
          : `Acuerdo del ${result.agreementPercentage.toString()}%. Puede merecer una segunda vuelta.`}
      </p>

      <div className="mt-auto flex flex-col gap-2">
        <Tooltip label="Marcar la estimación final llega en un bloque futuro">
          <Button variant="primary" block disabled>
            Aceptar {result.average ?? result.mostVoted} y pasar página
          </Button>
        </Tooltip>
        <div className="flex gap-2">
          <Button variant="secondary" block onClick={props.onRevote}>
            Volver a votar
          </Button>
          <Button
            variant="secondary"
            block
            disabled={!props.hasNextIssue}
            onClick={props.onNextIssue}
          >
            Siguiente tarea
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div
      className="rounded-[10px] p-3"
      style={{ background: 'var(--color-bg)', border: '1px solid var(--color-divider)' }}
    >
      <div className="mb-1 text-[11px]" style={{ color: 'var(--pp-muted)' }}>
        {label}
      </div>
      <div className="font-mono text-2xl font-semibold">{value}</div>
    </div>
  );
}
