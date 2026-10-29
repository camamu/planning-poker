import { MAX_IMPORTED_ISSUES } from '@pp/contracts';
import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, JSX } from 'react';
import { Button, Modal } from '../../design-system/index.js';
import { parseIssueInput } from './parseIssueInput.js';
import type { ParsedIssue } from './parseIssueInput.js';

export interface ImportIssuesDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Rechaza con el motivo si la API no acepta el lote; el diálogo lo muestra y no se cierra. */
  readonly onImport: (issues: ReadonlyArray<ParsedIssue>) => Promise<void>;
}

export function ImportIssuesDialog({
  open,
  onClose,
  onImport,
}: ImportIssuesDialogProps): JSX.Element {
  const [text, setText] = useState('');
  const [skipped, setSkipped] = useState<ReadonlySet<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseIssueInput(text), [text]);
  const selected = parsed.filter((_, index) => !skipped.has(index));
  const tooMany = selected.length > MAX_IMPORTED_ISSUES;
  const canImport = selected.length > 0 && !tooMany && !submitting;

  function changeText(next: string): void {
    setText(next);
    setSkipped(new Set());
    setError(null);
  }

  function toggleRow(index: number): void {
    setSkipped((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }

  function toggleAll(): void {
    setSkipped(selected.length === parsed.length ? new Set(parsed.keys()) : new Set());
  }

  function readFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;
    void file.text().then(changeText);
    // Sin esto, volver a elegir el mismo fichero no dispara `change`.
    event.target.value = '';
  }

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      await onImport(selected);
      changeText('');
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron importar las tareas.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Importar tareas"
      size="wide"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!canImport}
            onClick={() => {
              void submit();
            }}
          >
            {submitting ? 'Importando…' : importLabel(selected.length)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p style={{ color: 'var(--pp-muted)' }}>
          Pega una lista (una tarea por línea), un CSV con cabecera (Summary, Key, Description,
          Link…) o enlaces de Jira, GitHub o Linear.
        </p>

        <div className="field">
          <label htmlFor="pp-import-text">Tareas</label>
          <textarea
            id="pp-import-text"
            className="pp-input font-mono"
            rows={6}
            value={text}
            placeholder={'Implementar login\nhttps://acme.atlassian.net/browse/ABC-123'}
            onChange={(event) => {
              changeText(event.target.value);
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            aria-label="Fichero con las tareas"
            onChange={readFile}
          />
          <Button
            variant="secondary"
            onClick={() => {
              fileInput.current?.click();
            }}
          >
            Subir un .csv
          </Button>
          <span className="text-xs" style={{ color: 'var(--pp-muted)' }}>
            {summary(text, parsed.length, selected.length)}
          </span>
        </div>

        {tooMany ? (
          <p role="alert" style={{ color: '#e5484d' }}>
            Has seleccionado {selected.length.toString()} tareas y solo se pueden importar{' '}
            {MAX_IMPORTED_ISSUES.toString()} de una vez. Desmarca algunas o importa la lista por
            partes.
          </p>
        ) : null}

        {parsed.length > 0 ? (
          <PreviewTable
            issues={parsed}
            skipped={skipped}
            allSelected={selected.length === parsed.length}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
          />
        ) : null}

        {error ? (
          <p role="alert" style={{ color: '#e5484d' }}>
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function importLabel(count: number): string {
  return count === 1 ? 'Importar 1 tarea' : `Importar ${count.toString()} tareas`;
}

function summary(text: string, found: number, selected: number): string {
  if (text.trim() === '') return '';
  if (found === 0) return 'No se ha encontrado ninguna tarea en el texto.';
  return `${selected.toString()} de ${found.toString()} tareas seleccionadas`;
}

interface PreviewTableProps {
  readonly issues: ReadonlyArray<ParsedIssue>;
  readonly skipped: ReadonlySet<number>;
  readonly allSelected: boolean;
  readonly onToggleRow: (index: number) => void;
  readonly onToggleAll: () => void;
}

function PreviewTable({
  issues,
  skipped,
  allSelected,
  onToggleRow,
  onToggleAll,
}: PreviewTableProps): JSX.Element {
  return (
    <div
      className="max-h-[40vh] overflow-auto rounded-md"
      style={{ border: '1px solid var(--pp-line)' }}
    >
      <table className="w-full text-left text-xs">
        <thead style={{ background: 'var(--color-bg)' }}>
          <tr>
            <th className="w-8 p-2">
              <input
                type="checkbox"
                aria-label="Seleccionar todas"
                checked={allSelected}
                onChange={onToggleAll}
              />
            </th>
            <th className="p-2">Título</th>
            <th className="p-2">Enlace</th>
            <th className="p-2">Descripción</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, index) => (
            <tr
              // El índice es estable: la lista entera se recalcula cuando cambia el texto.
              key={index}
              style={{ opacity: skipped.has(index) ? 0.45 : 1 }}
            >
              <td className="p-2">
                <input
                  type="checkbox"
                  aria-label={`Importar «${issue.title}»`}
                  checked={!skipped.has(index)}
                  onChange={() => {
                    onToggleRow(index);
                  }}
                />
              </td>
              <td className="max-w-[200px] truncate p-2" title={issue.title}>
                {issue.title}
              </td>
              <td className="max-w-[200px] truncate p-2" title={issue.externalUrl}>
                {issue.externalUrl ?? ''}
              </td>
              <td className="max-w-[200px] truncate p-2" title={issue.description}>
                {issue.description ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
