import type { GameView, ParticipantView, RoundResultView, RoundView } from '@pp/contracts';
import { useRef } from 'react';
import type { JSX } from 'react';
import { Table } from '../game-table/components/Table.js';
import { useContainerSize } from '../game-table/hooks/useContainerSize.js';
import { orderSeatsWithViewerAt } from '../game-table/seatLayout.js';
import { StatTile } from '../results-panel/ResultsPanel.js';
import { formatPoints } from '../session-summary/summaryFormat.js';

const VIEWER_ID = 'demo-tu';
const DEALER_ID = 'demo-marco';

interface DemoPlayer {
  readonly id: string;
  readonly displayName: string;
  readonly vote: string;
  readonly isFacilitator?: boolean;
}

/**
 * La mesa de la sala con sus asientos de 112 px no encoge: se dibuja a un tamaño fijo y se escala
 * entera, como una imagen. En pantallas estrechas va con dos asientos, arriba y abajo, sobre una
 * mesa más pequeña: con cinco los nombres no se leerían, y con tres los asientos laterales tapan el
 * centro. `padding` deja sitio a los asientos que asoman por fuera de la elipse.
 */
interface DemoLayout {
  readonly players: ReadonlyArray<DemoPlayer>;
  /** Lo que daría `RoundResult.from` para esos votos. */
  readonly result: RoundResultView & { readonly average: number };
  readonly canvas: { readonly width: number; readonly height: number };
  readonly padding: string;
}

const WIDE: DemoLayout = {
  players: [
    { id: 'demo-lucia', displayName: 'Lucía', vote: '5', isFacilitator: true },
    { id: DEALER_ID, displayName: 'Marco', vote: '8' },
    { id: 'demo-ines', displayName: 'Inés', vote: '5' },
    { id: 'demo-dani', displayName: 'Dani', vote: '3' },
    { id: VIEWER_ID, displayName: 'Tú', vote: '5' },
  ],
  result: {
    distribution: { '3': 1, '5': 3, '8': 1 },
    average: 5.2,
    agreementPercentage: 60,
    mostVoted: '5',
    isUnanimous: false,
  },
  canvas: { width: 920, height: 640 },
  padding: '60px 10px',
};

const COMPACT: DemoLayout = {
  players: [
    { id: DEALER_ID, displayName: 'Marco', vote: '8' },
    { id: VIEWER_ID, displayName: 'Tú', vote: '5', isFacilitator: true },
  ],
  result: {
    distribution: { '5': 1, '8': 1 },
    average: 6.5,
    agreementPercentage: 50,
    mostVoted: '5',
    isUnanimous: false,
  },
  canvas: { width: 480, height: 400 },
  padding: '66px 10px 0',
};

/** Por debajo de este ancho (un móvil), la mesa de cinco quedaría a menos de la mitad de su tamaño. */
const COMPACT_BELOW_PX = 420;

const SETTINGS: GameView['settings'] = {
  autoReveal: true,
  whoCanReveal: 'ANYONE',
  namedRevealers: [],
  allowVoteChange: true,
  celebrate: true,
  throwEmojis: true,
  countdownSeconds: null,
  revealOnTimeout: false,
};

function demoRound(layout: DemoLayout): { game: GameView; round: RoundView } {
  const participants: ReadonlyArray<ParticipantView> = layout.players.map((player) => ({
    id: player.id,
    displayName: player.displayName,
    role: 'VOTER',
    isFacilitator: player.isFacilitator ?? false,
    online: true,
    hat: null,
  }));
  const round: RoundView = {
    id: 'demo-round',
    issueId: 'demo-issue',
    roundNumber: 1,
    status: 'REVEALED',
    votes: layout.players.map((player) => ({
      participantId: player.id,
      card: player.vote,
      hasVoted: true,
    })),
    result: layout.result,
    previousRounds: [],
    dealerId: DEALER_ID,
    timerDeadline: null,
  };
  const game: GameView = {
    id: 'demo',
    name: 'Ejemplo',
    deck: { cards: ['1', '2', '3', '5', '8', '13', '?'] },
    settings: SETTINGS,
    participants,
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
    currentRound: round,
    asyncRounds: [],
  };
  return { game, round };
}

function seatsFor(game: GameView): Parameters<typeof Table>[0]['seats'] {
  return orderSeatsWithViewerAt(game.participants, VIEWER_ID).map((p) => ({
    id: p.id,
    displayName: p.displayName,
    online: p.online,
    hat: p.hat,
    isFacilitator: p.isFacilitator,
    seat: p.seat,
  }));
}

/** Una ronda revelada con la mesa real de la sala, en un estado fijo: nunca se queda vieja. */
export function DemoTable(): JSX.Element {
  const frameRef = useRef<HTMLDivElement>(null);
  const size = useContainerSize(frameRef);
  const layout = size && size.width < COMPACT_BELOW_PX ? COMPACT : WIDE;
  const scale = size ? size.width / layout.canvas.width : 0;
  const { game, round } = demoRound(layout);
  const average = formatPoints(layout.result.average);
  const agreement = `${layout.result.agreementPercentage.toString()}%`;

  return (
    <div
      role="img"
      aria-label={`Ejemplo de ronda revelada: ${layout.players.length.toString()} votos, media ${average} y un ${agreement} de acuerdo`}
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
        style={{ height: layout.canvas.height * scale }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: layout.canvas.width,
            height: layout.canvas.height,
            padding: layout.padding,
            transform: `scale(${scale.toString()})`,
            visibility: size ? 'visible' : 'hidden',
          }}
        >
          <Table
            game={game}
            round={round}
            seats={seatsFor(game)}
            viewerId={VIEWER_ID}
            selectedCard={null}
          />
        </div>
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-2.5">
        <StatTile label="Media" value={average} />
        <StatTile label="Acuerdo" value={agreement} />
      </div>
    </div>
  );
}
