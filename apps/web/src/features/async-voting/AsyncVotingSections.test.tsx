import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { asyncRoundView, asyncVotingProps, issueView } from './asyncVotingFixtures.js';
import { AsyncVotingSections } from './AsyncVotingSections.js';
import type { AsyncVotingSectionsProps } from './AsyncVotingSections.js';
import type { AsyncVotingProps } from './types.js';

const ISSUES = [issueView('a'), issueView('b')];

function renderSections(
  asyncVoting: AsyncVotingProps,
  overrides: Partial<AsyncVotingSectionsProps> = {},
): AsyncVotingSectionsProps {
  const props: AsyncVotingSectionsProps = {
    issues: ISSUES,
    asyncVoting,
    canStartRound: true,
    onStartRound: vi.fn(),
    ...overrides,
  };
  render(<AsyncVotingSections {...props} />);
  return props;
}

const revealedRound = asyncRoundView('a', {
  status: 'REVEALED',
  voterIds: ['p1', 'p2'],
  votes: [
    { participantId: 'p1', card: '5' },
    { participantId: 'p2', card: '8' },
  ],
  result: {
    distribution: { '5': 1, '8': 1 },
    average: 6.5,
    agreementPercentage: 50,
    mostVoted: '5',
    isUnanimous: false,
  },
});

describe('AsyncVotingSections: rondas abiertas', () => {
  afterEach(cleanup);

  it('no pinta nada si no hay rondas en diferido', () => {
    const { container } = render(
      <AsyncVotingSections
        issues={ISSUES}
        asyncVoting={asyncVotingProps()}
        canStartRound
        onStartRound={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('cuenta los votantes que han votado sobre el total de votantes, sin los espectadores', () => {
    renderSections(asyncVotingProps({ rounds: [asyncRoundView('a', { voterIds: ['p1', 'p2'] })] }));

    expect(screen.getByText('2 de 3 han votado')).toBeInTheDocument();
  });

  it('«Votar» abre la mano de cartas y elegir una vota y cierra el modal', () => {
    const props = asyncVotingProps({ rounds: [asyncRoundView('a')] });
    renderSections(props);

    fireEvent.click(screen.getByRole('button', { name: 'Votar' }));
    const dialog = screen.getByRole('dialog', { name: 'Vota «Tarea a»' });
    fireEvent.click(within(dialog).getByRole('button', { name: '8' }));

    expect(props.onVote).toHaveBeenCalledWith('a', '8');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marca la carta que ya tiene puesta quien vota y ofrece cambiarla', () => {
    renderSections(
      asyncVotingProps({ rounds: [asyncRoundView('a', { voterIds: ['p1'], ownCard: '5' })] }),
    );

    expect(screen.getByText('Tu voto: 5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar voto' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: '5' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('el voto pintado y aún sin confirmar manda sobre el confirmado', () => {
    renderSections(
      asyncVotingProps({
        rounds: [asyncRoundView('a', { voterIds: ['p1'], ownCard: '5' })],
        pendingCards: { a: '13' },
      }),
    );

    expect(screen.getByText('Tu voto: 13')).toBeInTheDocument();
  });

  it('si la partida no permite cambiar el voto, ya votado deja las cartas bloqueadas', () => {
    renderSections(
      asyncVotingProps({
        rounds: [asyncRoundView('a', { voterIds: ['p1'], ownCard: '5' })],
        canChangeVote: false,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar voto' }));
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(/no permite cambiar el voto/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '8' })).toBeDisabled();
  });

  it('un espectador ve el avance pero no puede votar', () => {
    renderSections(
      asyncVotingProps({
        rounds: [asyncRoundView('a', { voterIds: ['p1'] })],
        viewerCanVote: false,
      }),
    );

    expect(screen.getByText('1 de 3 han votado')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^(Votar|Cambiar voto)$/ }),
    ).not.toBeInTheDocument();
  });
});

describe('AsyncVotingSections: llevar una tarea abierta a la mesa', () => {
  afterEach(cleanup);

  it('«Votar en vivo» en una ronda abierta la pasa a la mesa conservando lo votado', () => {
    const props = renderSections(
      asyncVotingProps({ rounds: [asyncRoundView('a', { voterIds: ['p2'] })] }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Votar en vivo «Tarea a»' }));

    expect(props.onStartRound).toHaveBeenCalledWith('a');
  });

  it('no lo ofrece cuando la mesa ya tiene una ronda', () => {
    renderSections(asyncVotingProps({ rounds: [asyncRoundView('a', { voterIds: ['p2'] })] }), {
      canStartRound: false,
    });

    expect(screen.queryByRole('button', { name: /Votar en vivo/ })).not.toBeInTheDocument();
  });
});

describe('AsyncVotingSections: revelar', () => {
  afterEach(cleanup);

  it('«Revelar todas» revela en lote cuando alguien puede y hay votos', () => {
    const props = asyncVotingProps({ rounds: [asyncRoundView('a', { voterIds: ['p1'] })] });
    renderSections(props);

    fireEvent.click(screen.getByRole('button', { name: 'Revelar todas' }));

    expect(props.onReveal).toHaveBeenCalledWith();
  });

  it('«Revelar» de una tarea revela solo esa', () => {
    const props = asyncVotingProps({ rounds: [asyncRoundView('b', { voterIds: ['p2'] })] });
    renderSections(props);

    fireEvent.click(screen.getByRole('button', { name: 'Revelar «Tarea b»' }));

    expect(props.onReveal).toHaveBeenCalledWith(['b']);
  });

  it('no ofrece revelar una ronda en la que todavía no ha votado nadie', () => {
    renderSections(asyncVotingProps({ rounds: [asyncRoundView('a')] }));

    expect(screen.queryByRole('button', { name: /Revelar/ })).not.toBeInTheDocument();
  });

  it('no ofrece revelar a quien no tiene permiso', () => {
    renderSections(
      asyncVotingProps({
        rounds: [asyncRoundView('a', { voterIds: ['p1'] })],
        canReveal: false,
      }),
    );

    expect(screen.queryByRole('button', { name: /Revelar/ })).not.toBeInTheDocument();
  });
});

describe('AsyncVotingSections: resultados en diferido', () => {
  afterEach(cleanup);

  it('enseña la media, el acuerdo y qué votó cada persona', () => {
    renderSections(asyncVotingProps({ rounds: [revealedRound] }));

    expect(screen.getByText('Resultados en diferido')).toBeInTheDocument();
    expect(screen.getByText('6.5')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    const votes = screen.getByRole('list', { name: 'Votos de cada persona' });
    expect(within(votes).getByText(/Ada/)).toBeInTheDocument();
    expect(within(votes).getByText(/Grace/)).toBeInTheDocument();
  });

  it('redondea la media a dos decimales en vez de enseñar todos los de la división', () => {
    const result = revealedRound.result;
    if (!result) throw new Error('el fixture no tiene resultado');
    renderSections(
      asyncVotingProps({
        rounds: [{ ...revealedRound, result: { ...result, average: 26 / 3 } }],
      }),
    );

    expect(screen.getByText('8.67')).toBeInTheDocument();
  });

  it('con una baraja sin media enseña la carta más votada', () => {
    const result = revealedRound.result;
    if (!result) throw new Error('el fixture no tiene resultado');
    renderSections(
      asyncVotingProps({
        rounds: [{ ...revealedRound, result: { ...result, average: null, mostVoted: 'M' } }],
      }),
    );

    expect(screen.getByText('Más votada')).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('propone la carta más votada y acepta la estimación de esa tarea', () => {
    const props = asyncVotingProps({ rounds: [revealedRound] });
    renderSections(props);

    expect(screen.getByLabelText('Estimación')).toHaveValue('5');
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(props.onAcceptEstimate).toHaveBeenCalledWith('a', '5');
  });

  it('permite elegir otra carta antes de aceptar', () => {
    const props = asyncVotingProps({ rounds: [revealedRound] });
    renderSections(props);

    fireEvent.change(screen.getByLabelText('Estimación'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(props.onAcceptEstimate).toHaveBeenCalledWith('a', '8');
  });

  it('quien no puede cerrar estimaciones ve el motivo y no el selector', () => {
    renderSections(asyncVotingProps({ rounds: [revealedRound], canReveal: false }));

    expect(screen.queryByLabelText('Estimación')).not.toBeInTheDocument();
    expect(screen.getByText(/Solo quien puede revelar/)).toBeInTheDocument();
  });

  it('«Votar en vivo» pasa la tarea a la mesa', () => {
    const props = renderSections(asyncVotingProps({ rounds: [revealedRound] }));

    fireEvent.click(screen.getByRole('button', { name: 'Votar en vivo' }));

    expect(props.onStartRound).toHaveBeenCalledWith('a');
  });

  it('no ofrece votar en vivo cuando la mesa está ocupada', () => {
    renderSections(asyncVotingProps({ rounds: [revealedRound] }), { canStartRound: false });

    expect(screen.queryByRole('button', { name: 'Votar en vivo' })).not.toBeInTheDocument();
  });
});
