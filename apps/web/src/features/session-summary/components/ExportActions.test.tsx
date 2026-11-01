import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadTextFile } from '../export/downloadTextFile.js';
import { gameSummary } from '../export/summaryFixtures.js';
import { ExportActions } from './ExportActions.js';

vi.mock('../export/downloadTextFile.js', () => ({ downloadTextFile: vi.fn() }));

describe('ExportActions', () => {
  beforeEach(() => {
    vi.mocked(downloadTextFile).mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('descarga el CSV con punto y coma y el nombre de la partida en el fichero', () => {
    render(<ExportActions summary={gameSummary()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }));

    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    const [fileName, content, mimeType] = vi.mocked(downloadTextFile).mock.calls[0] ?? [];
    expect(fileName).toMatch(/^planning-sprint-42-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(content).toContain('summary;key;description;link;estimate;rounds;agreement');
    expect(mimeType).toBe('text/csv;charset=utf-8');
  });

  it('descarga el CSV con comas cuando se elige ese separador', () => {
    render(<ExportActions summary={gameSummary()} />);

    fireEvent.change(screen.getByLabelText('Separador del CSV'), { target: { value: ',' } });
    fireEvent.click(screen.getByRole('button', { name: 'Descargar CSV' }));

    expect(vi.mocked(downloadTextFile).mock.calls[0]?.[1]).toContain(
      'summary,key,description,link,estimate,rounds,agreement',
    );
  });

  it('copia el Markdown al portapapeles y lo confirma', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<ExportActions summary={gameSummary()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copiar Markdown' }));

    expect(await screen.findByRole('button', { name: 'Copiado ✓' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('| Login | 5 | 1 | 100% |'));
    expect(screen.getByRole('status')).toHaveTextContent('Markdown copiado al portapapeles');
  });

  it('avisa cuando el navegador no deja copiar', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    render(<ExportActions summary={gameSummary()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copiar Markdown' }));

    expect(await screen.findByRole('button', { name: 'No se pudo copiar' })).toBeInTheDocument();
  });

  it('avisa también en contextos sin portapapeles', async () => {
    vi.stubGlobal('navigator', {});
    render(<ExportActions summary={gameSummary()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copiar Markdown' }));

    expect(await screen.findByRole('button', { name: 'No se pudo copiar' })).toBeInTheDocument();
  });

  it('vuelve a «Copiar Markdown» a los dos segundos', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<ExportActions summary={gameSummary()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar Markdown' }));
    await screen.findByRole('button', { name: 'Copiado ✓' });

    expect(
      await screen.findByRole('button', { name: 'Copiar Markdown' }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});
