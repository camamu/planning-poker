import type { GameView, ParticipantView, RoundView } from '@pp/contracts';
import { useRef } from 'react';
import type { JSX } from 'react';
import { Table } from '../game-table/components/Table.js';
import { useContainerSize } from '../game-table/hooks/useContainerSize.js';
import { orderSeatsWithViewerAt } from '../game-table/seatLayout.js';
import { StatTile } from '../results-panel/ResultsPanel.js';
import { formatPoints } from '../session-summary/summaryFormat.js';

const VIEWER_ID = 'demo-tu';

function participant(id: string, displayName: string, isFacilitator = false): ParticipantView {
  return { id, displayName, role: 'VOTER', isFacilitator, online: true, hat: null };
}

const PARTICIPANTS: ReadonlyArray<ParticipantView> = [
  participant('demo-lucia', 'Lucía', true),
  participant('demo-marco', 'Marco'),
  participant('demo-ines', 'Inés'),
  participant('demo-dani', 'Dani'),
  participant(VIEWER_ID, 'Tú'),
];

const VOTES: Record<string, string> = {
  'demo-lucia': '5',
  'demo-marco': '8',
  'demo-ines': '5',
  'demo-dani': '3',
  [VIEWER_ID]: '5',
};

/* Los mismos agregados que daría `RoundResult.from` para estos cinco votos. */
const RESULT = {
  distribution: { '3': 1, '5': 3, '8': 1 },
  average: 5.2,
  agreementPercentage: 60,
  mostVoted: '5',
  isUnanimous: false,
};

const ROUND: RoundView = {
  id: 'demo-round',
  issueId: 'demo-issue',
  roundNumber: 1,
  status: 'REVEALED',
  votes: PARTICIPANTS.map((p) => ({
    participantId: p.id,
    card: VOTES[p.id] ?? null,
    hasVoted: true,
  })),
  result: RESULT,
  previousRounds: [],
  dealerId: 'demo-marco',
  timerDeadline: null,
};

const GAME: GameView = {
  id: 'demo',
  name: 'Ejemplo',
  deck: { cards: ['1', '2', '3', '5', '8', '13', '?'] },
  settings: {
    autoReveal: true,
    whoCanReveal: 'ANYONE',
    namedRevealers: [],
    allowVoteChange: true,
    celebrate: true,
    throwEmojis: true,
    countdownSeconds: null,
    revealOnTimeout: false,
  },
  participants: PARTICIPANTS,
  issues: [
    {
      id: 'demo-issue',
      title: 'Reintentos de cobro fallidos',
      description: null,
      externalUrl: null,
      status: 'VOTING',
      finalEstimate: null,
    },
  ],
  currentRound: ROUND,
  asyncRounds: [],
};

const SEATS = orderSeatsWithViewerAt(PARTICIPANTS, VIEWER_ID).map((p) => ({
  id: p.id,
  displayName: p.displayName,
  online: p.online,
  hat: p.hat,
  isFacilitator: p.isFacilitator,
  seat: p.seat,
}));

/*
 * La mesa de la sala a su tamaño real (900×520) más el margen que ocupan los asientos que asoman
 * por arriba y por abajo; se escala entera para que quepa, como si fuera una imagen.
 */
const CANVAS_WIDTH = 920;
const CANVAS_HEIGHT = 640;

/** Una ronda revelada con la mesa real de la sala, en un estado fijo: nunca se queda vieja. */
export function DemoTable(): JSX.Element {
  const frameRef = useRef<HTMLDivElement>(null);
  const size = useContainerSize(frameRef);
  const scale = size ? size.width / CANVAS_WIDTH : 0;

  return (
    <div
      role="img"
      aria-label="Ejemplo de ronda revelada: cinco votos, media 5,2 y un 60% de acuerdo"
      className="flex flex-col gap-2.5 rounded-2xl p-3"
      style={{
        background: 'color-mix(in srgb, var(--color-surface) 55%, transparent)',
        boxShadow: '0 0 0 1px var(--pp-line)',
      }}
    >
      <div
        ref={frameRef}
        aria-hidden="true"
        inert
        className="relative w-full overflow-hidden"
        style={{ height: CANVAS_HEIGHT * scale }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left px-[10px] py-[60px]"
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            transform: `scale(${scale.toString()})`,
            visibility: size ? 'visible' : 'hidden',
          }}
        >
          <Table game={GAME} round={ROUND} seats={SEATS} viewerId={VIEWER_ID} selectedCard={null} />
        </div>
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-2.5">
        <StatTile label="Media" value={formatPoints(RESULT.average)} />
        <StatTile label="Acuerdo" value={`${RESULT.agreementPercentage.toString()}%`} />
      </div>
    </div>
  );
}
