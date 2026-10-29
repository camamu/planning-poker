import type { GameSummaryView } from '@pp/contracts';
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Button, Select } from '../../../design-system/index.js';
import { csvFileName } from '../export/exportFileName.js';
import { downloadTextFile } from '../export/downloadTextFile.js';
import { toCsv } from '../export/toCsv.js';
import type { CsvSeparator } from '../export/toCsv.js';
import { toMarkdown } from '../export/toMarkdown.js';

export interface ExportActionsProps {
  readonly summary: GameSummaryView;
}

type CopyState = 'idle' | 'copied' | 'failed';

const SEPARATOR_OPTIONS = [
  { value: ';', label: 'Punto y coma (Excel en español)' },
  { value: ',', label: 'Coma' },
];

const COPY_LABELS: Record<CopyState, string> = {
  idle: 'Copiar Markdown',
  copied: 'Copiado ✓',
  failed: 'No se pudo copiar',
};

export function ExportActions({ summary }: ExportActionsProps): JSX.Element {
  const [separator, setSeparator] = useState<CsvSeparator>(';');
  const [copyState, setCopyState] = useState<CopyState>('idle');

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => {
      setCopyState('idle');
    }, 2000);
    return () => {
      clearTimeout(timer);
    };
  }, [copyState]);

  const downloadCsv = (): void => {
    downloadTextFile(
      csvFileName(summary.name, new Date()),
      toCsv(summary, { separator }),
      'text/csv;charset=utf-8',
    );
  };

  // `navigator.clipboard` no existe fuera de contextos seguros: se captura en vez de comprobarlo.
  const copyMarkdown = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(toMarkdown(summary));
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <section aria-label="Exportar el resumen" className="flex flex-wrap items-end gap-2.5">
      <Select
        label="Separador del CSV"
        options={SEPARATOR_OPTIONS}
        value={separator}
        onChange={(event) => {
          setSeparator(event.target.value === ',' ? ',' : ';');
        }}
      />
      <Button variant="secondary" onClick={downloadCsv}>
        Descargar CSV
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          void copyMarkdown();
        }}
      >
        {COPY_LABELS[copyState]}
      </Button>
      <span role="status" className="sr-only">
        {copyState === 'copied' ? 'Markdown copiado al portapapeles' : ''}
      </span>
    </section>
  );
}
