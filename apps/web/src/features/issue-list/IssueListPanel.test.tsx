import type { IssueView } from '@pp/contracts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IssueListPanel } from './IssueListPanel.js';
import type { IssueListPanelProps } from './IssueListPanel.js';

const issue = (
  id: string,
  status: IssueView['status'],
  finalEstimate: string | null = null,
): IssueView => ({
  id,
  title: `Tarea ${id}`,
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
    onRenameIssue: vi.fn(),
    onDeleteIssue: vi.fn(),
    onReorderIssues: vi.fn(),
    onStartRound: vi.fn(),
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
