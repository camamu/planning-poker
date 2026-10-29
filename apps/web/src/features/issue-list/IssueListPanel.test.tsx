import type { IssueView } from '@pp/contracts';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { asyncRoundView, asyncVotingProps } from '../async-voting/asyncVotingFixtures.js';
import { IssueListPanel } from './IssueListPanel.js';
import type { IssueListPanelProps } from './IssueListPanel.js';

const issue = (
  id: string,
  status: IssueView['status'],
  finalEstimate: string | null = null,
): IssueView => ({
  id,
  title: `Tarea ${id}`,
  description: null,
  externalUrl: null,
  status,
  finalEstimate,
});

const QUEUE: ReadonlyArray<IssueView> = [
  issue('est', 'ESTIMATED', '5'),
  issue('p1', 'PENDING'),
  issue('mesa', 'VOTING'),
  issue('p2', 'PENDING'),
  issue('p3', 'PENDING'),
];

function renderPanel(overrides: Partial<IssueListPanelProps> = {}): IssueListPanelProps {
  const props: IssueListPanelProps = {
    issues: QUEUE,
    currentIssueId: 'mesa',
    canStartRound: false,
    onAddIssue: vi.fn(),
    onImportIssues: vi.fn(() => Promise.resolve()),
    onRenameIssue: vi.fn(),
    onDeleteIssue: vi.fn(),
    onReorderIssues: vi.fn(),
    onStartRound: vi.fn(),
    asyncVoting: asyncVotingProps(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<IssueListPanel {...props} />);
  return props;
}

function dragHandle(index: number): HTMLElement {
  const handle = screen.getAllByText('⋮⋮')[index];
  if (!handle) throw new Error(`no hay tirador de arrastre en la posición ${index.toString()}`);
  return handle;
}

function openMenu(id: string): void {
  fireEvent.click(screen.getByRole('button', { name: `Más acciones de «Tarea ${id}»` }));
}

describe('IssueListPanel: gestión de tareas', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('ofrece Borrar solo en las tareas que nunca se han votado', () => {
    renderPanel();

    for (const id of ['est', 'mesa']) {
      openMenu(id);
      expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Borrar' })).not.toBeInTheDocument();
      openMenu(id);
    }

    openMenu('p1');
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument();
  });

  it('edita el título en línea y lo envía recortado al guardar', () => {
    const props = renderPanel();

    openMenu('p1');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Título de la tarea'), {
      target: { value: '  Tarea p1 corregida ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(props.onRenameIssue).toHaveBeenCalledWith('p1', 'Tarea p1 corregida');
    expect(screen.queryByLabelText('Título de la tarea')).not.toBeInTheDocument();
  });

  it('también permite corregir una tarea ya estimada', () => {
    const props = renderPanel();

    openMenu('est');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Título de la tarea'), { target: { value: 'Otra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(props.onRenameIssue).toHaveBeenCalledWith('est', 'Otra');
  });

  it('no envía nada si el título queda vacío, no cambia o se cancela con Escape', () => {
    const props = renderPanel();

    openMenu('p1');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Título de la tarea'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    openMenu('p1');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    openMenu('p1');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Título de la tarea'), { target: { value: 'Nuevo' } });
    fireEvent.keyDown(screen.getByLabelText('Título de la tarea'), { key: 'Escape' });

    expect(props.onRenameIssue).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Título de la tarea')).not.toBeInTheDocument();
  });

  it('borra tras confirmar y no borra si se cancela la confirmación', () => {
    const confirm = vi.spyOn(window, 'confirm');
    const props = renderPanel();

    confirm.mockReturnValueOnce(false);
    openMenu('p2');
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(props.onDeleteIssue).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    openMenu('p2');
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(props.onDeleteIssue).toHaveBeenCalledWith('p2');
    expect(confirm).toHaveBeenLastCalledWith('¿Borrar la tarea «Tarea p2»?');
  });

  it('baja una tarea y manda la cola entera con las demás en su sitio', () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Bajar «Tarea p1»' }));

    expect(props.onReorderIssues).toHaveBeenCalledWith(['est', 'p2', 'mesa', 'p1', 'p3']);
  });

  it('sube una tarea y manda la cola entera con las demás en su sitio', () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Subir «Tarea p3»' }));

    expect(props.onReorderIssues).toHaveBeenCalledWith(['est', 'p1', 'mesa', 'p3', 'p2']);
  });

  it('no deja subir la primera tarea por estimar ni bajar la última', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: 'Subir «Tarea p1»' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bajar «Tarea p3»' })).toBeDisabled();
  });

  it('no ofrece reordenar la tarea de la mesa ni las ya estimadas', () => {
    renderPanel();

    expect(screen.queryByRole('button', { name: 'Subir «Tarea mesa»' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bajar «Tarea est»' })).not.toBeInTheDocument();
  });

  it('reordena arrastrando una tarea sobre otra', () => {
    const props = renderPanel();
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '' };

    fireEvent.dragStart(dragHandle(0), { dataTransfer });
    fireEvent.dragOver(screen.getByText('Tarea p3'));
    fireEvent.drop(screen.getByText('Tarea p3'));

    expect(props.onReorderIssues).toHaveBeenCalledWith(['est', 'p2', 'mesa', 'p3', 'p1']);
  });

  it('soltar una tarea sobre sí misma no pide ningún cambio', () => {
    const props = renderPanel();
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '' };

    fireEvent.dragStart(dragHandle(1), { dataTransfer });
    fireEvent.drop(screen.getByText('Tarea p2'));

    expect(props.onReorderIssues).not.toHaveBeenCalled();
  });

  it('sigue arrancando la ronda al pulsar el título de una tarea por estimar', () => {
    const props = renderPanel({ canStartRound: true, currentIssueId: null });

    fireEvent.click(screen.getByText('Tarea p2'));

    expect(props.onStartRound).toHaveBeenCalledWith('p2');
  });
});

describe('IssueListPanel: importar tareas y enlaces', () => {
  afterEach(cleanup);

  it('abre el diálogo de importación y le pasa el lote a onImportIssues', async () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Importar tareas…' }));
    fireEvent.change(screen.getByLabelText('Tareas'), { target: { value: 'Una\nOtra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Importar 2 tareas' }));

    await waitFor(() => {
      expect(props.onImportIssues).toHaveBeenCalledWith([{ title: 'Una' }, { title: 'Otra' }]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('muestra un enlace solo en las tareas con externalUrl', () => {
    renderPanel({
      issues: [
        { ...issue('p1', 'PENDING'), externalUrl: 'https://acme.atlassian.net/browse/ABC-1' },
        issue('p2', 'PENDING'),
      ],
      currentIssueId: null,
    });

    const link = screen.getByRole('link', { name: 'Abrir «Tarea p1» en una pestaña nueva' });
    expect(link).toHaveAttribute('href', 'https://acme.atlassian.net/browse/ABC-1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('no pinta como enlace un externalUrl que no sea http(s)', () => {
    renderPanel({
      issues: [{ ...issue('p1', 'PENDING'), externalUrl: 'javascript:alert(1)' }],
      currentIssueId: null,
    });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('IssueListPanel: votación en diferido', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function select(id: string): void {
    fireEvent.click(
      screen.getByRole('checkbox', { name: `Seleccionar «Tarea ${id}» para votar en diferido` }),
    );
  }

  it('no ofrece abrir en diferido mientras no haya tareas marcadas', () => {
    renderPanel();

    expect(
      screen.queryByRole('button', { name: /Abrir para votar en diferido/ }),
    ).not.toBeInTheDocument();
  });

  it('abre en diferido las tareas marcadas, en el orden de la cola, y desmarca después', () => {
    const props = renderPanel();

    select('p3');
    select('p1');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir para votar en diferido (2)' }));

    expect(props.asyncVoting.onOpen).toHaveBeenCalledWith(['p1', 'p3']);
    expect(
      screen.queryByRole('button', { name: /Abrir para votar en diferido/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /«Tarea p1»/ })).not.toBeChecked();
  });

  it('solo se pueden marcar las tareas por estimar, no la de la mesa ni las ya estimadas', () => {
    renderPanel();

    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.queryByRole('checkbox', { name: /«Tarea mesa»/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /«Tarea est»/ })).not.toBeInTheDocument();
  });

  it('las tareas con una ronda en diferido salen de «Por estimar» y aparecen en su sección', () => {
    renderPanel({
      asyncVoting: asyncVotingProps({
        rounds: [asyncRoundView('p2', { voterIds: ['p1'] })],
      }),
    });

    expect(screen.getByText('Votando en diferido')).toBeInTheDocument();
    expect(screen.getByText('1 de 3 han votado')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /«Tarea p2»/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('reordenar las tareas por estimar deja en su sitio las que están en diferido', () => {
    const props = renderPanel({
      asyncVoting: asyncVotingProps({ rounds: [asyncRoundView('p2')] }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Bajar «Tarea p1»' }));

    expect(props.onReorderIssues).toHaveBeenCalledWith(['est', 'p3', 'mesa', 'p2', 'p1']);
  });
});
