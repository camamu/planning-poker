import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportIssuesDialog } from './ImportIssuesDialog.js';

function renderDialog(onImport = vi.fn(() => Promise.resolve())): {
  onImport: typeof onImport;
  onClose: () => void;
} {
  const onClose = vi.fn();
  render(<ImportIssuesDialog open onClose={onClose} onImport={onImport} />);
  return { onImport, onClose };
}

function paste(text: string): void {
  fireEvent.change(screen.getByLabelText('Tareas'), { target: { value: text } });
}

describe('ImportIssuesDialog', () => {
  afterEach(cleanup);

  it('no ofrece importar nada mientras no hay texto', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Importar 0 tareas' })).toBeDisabled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('muestra una vista previa con una fila por tarea, todas marcadas', () => {
    renderDialog();

    paste('Implementar login\nhttps://acme.atlassian.net/browse/ABC-123');

    expect(screen.getByRole('checkbox', { name: 'Importar «Implementar login»' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Importar «ABC-123»' })).toBeChecked();
    expect(screen.getByText('https://acme.atlassian.net/browse/ABC-123')).toBeInTheDocument();
    expect(screen.getByText('2 de 2 tareas seleccionadas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar 2 tareas' })).toBeEnabled();
  });

  it('solo importa las filas marcadas', async () => {
    const { onImport } = renderDialog();
    paste('Primera\nSegunda\nTercera');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Importar «Segunda»' }));
    fireEvent.click(screen.getByRole('button', { name: 'Importar 2 tareas' }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith([{ title: 'Primera' }, { title: 'Tercera' }]);
    });
  });

  it('seleccionar todas desmarca y vuelve a marcar el lote entero', () => {
    renderDialog();
    paste('Primera\nSegunda');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar todas' }));
    expect(screen.getByRole('button', { name: 'Importar 0 tareas' })).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar todas' }));
    expect(screen.getByRole('button', { name: 'Importar 2 tareas' })).toBeEnabled();
  });

  it('lee un CSV con cabecera y manda título, descripción y enlace', async () => {
    const { onImport } = renderDialog();
    paste('Summary,Description,Link\nLogin,Con OAuth,https://acme.atlassian.net/browse/ABC-1');

    fireEvent.click(screen.getByRole('button', { name: 'Importar 1 tarea' }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith([
        {
          title: 'Login',
          description: 'Con OAuth',
          externalUrl: 'https://acme.atlassian.net/browse/ABC-1',
        },
      ]);
    });
  });

  it('carga el texto de un fichero subido', async () => {
    renderDialog();
    const file = new File(['Summary\nDesde fichero\n'], 'tareas.csv', { type: 'text/csv' });

    fireEvent.change(screen.getByLabelText('Fichero con las tareas'), {
      target: { files: [file] },
    });

    expect(await screen.findByRole('checkbox', { name: 'Importar «Desde fichero»' })).toBeChecked();
  });

  it('avisa si no encuentra ninguna tarea en el texto', () => {
    renderDialog();

    paste('Summary,Description');

    expect(screen.getByText('No se ha encontrado ninguna tarea en el texto.')).toBeInTheDocument();
  });

  it('avisa y no deja importar si se superan las 200 tareas, y vuelve a dejar al desmarcar', () => {
    renderDialog();

    paste(Array.from({ length: 201 }, (_, index) => `Tarea ${index.toString()}`).join('\n'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Has seleccionado 201 tareas y solo se pueden importar 200 de una vez',
    );
    expect(screen.getByRole('button', { name: 'Importar 201 tareas' })).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Importar «Tarea 200»' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar 200 tareas' })).toBeEnabled();
  });

  it('se cierra y se vacía al importar con éxito', async () => {
    const { onClose } = renderDialog();
    paste('Primera');

    fireEvent.click(screen.getByRole('button', { name: 'Importar 1 tarea' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(screen.getByLabelText('Tareas')).toHaveValue('');
  });

  it('muestra el motivo y no se cierra si la API rechaza la importación', async () => {
    const { onClose } = renderDialog(vi.fn(() => Promise.reject(new Error('Título inválido'))));
    paste('Primera');

    fireEvent.click(screen.getByRole('button', { name: 'Importar 1 tarea' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Título inválido');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Tareas')).toHaveValue('Primera');
    expect(screen.getByRole('button', { name: 'Importar 1 tarea' })).toBeEnabled();
  });
});
