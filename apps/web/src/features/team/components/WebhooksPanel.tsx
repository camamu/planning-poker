import { MAX_WEBHOOKS_PER_TEAM } from '@pp/contracts';
import type { CreatedWebhookView, WebhookView } from '@pp/contracts';
import { useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../../design-system/index.js';
import { WEBHOOK_EVENT_LABELS } from '../../../shared/webhooks/webhookEventLabels.js';
import { useWebhooks } from '../useWebhooks.js';
import type { WebhookTestState } from '../useWebhooks.js';
import { AddWebhookForm } from './AddWebhookForm.js';

export interface WebhooksPanelProps {
  readonly slug: string;
  readonly token: string;
}

function describeTest(test: WebhookTestState): { text: string; failed: boolean } {
  if (test.status === 'sending') return { text: 'Enviando la prueba…', failed: false };
  if (test.status === 'error') return { text: test.message, failed: true };
  if (test.result.ok) {
    return { text: `El receptor contestó HTTP ${String(test.result.status)}.`, failed: false };
  }
  return { text: `No llegó: ${test.result.error ?? 'error desconocido'}.`, failed: true };
}

/** El secreto completo, una sola vez: después solo se ven sus 4 últimos caracteres (ADR 0028). */
function CreatedSecret(props: {
  readonly webhook: CreatedWebhookView;
  readonly onDismiss: () => void;
}): JSX.Element {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(props.webhook.secret);
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-[10px] p-3"
      style={{ border: '1px solid var(--color-accent)', background: 'rgba(145,132,217,.08)' }}
    >
      <span className="text-sm font-semibold">Webhook creado</span>
      <p className="text-xs" style={{ color: 'var(--pp-muted)' }}>
        Este es el secreto con el que se firman sus envíos. Cópialo ahora: no se vuelve a mostrar.
      </p>
      <code className="break-all rounded-md p-2 text-xs" style={{ background: 'var(--color-bg)' }}>
        {props.webhook.secret}
      </code>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            void copy();
          }}
        >
          {copied === 'copied' ? 'Copiado ✓' : 'Copiar secreto'}
        </Button>
        {copied === 'failed' ? (
          <span className="text-xs" style={{ color: '#e5484d' }}>
            No se pudo copiar: selecciónalo a mano.
          </span>
        ) : null}
        <Button variant="ghost" onClick={props.onDismiss}>
          Ya lo he guardado
        </Button>
      </div>
    </div>
  );
}

function WebhookRow(props: {
  readonly webhook: WebhookView;
  readonly test: WebhookTestState | undefined;
  readonly onTest: () => void;
  readonly onRemove: () => void;
}): JSX.Element {
  const { webhook } = props;
  const result = props.test ? describeTest(props.test) : null;

  return (
    <li
      className="flex flex-col gap-2 rounded-[10px] p-3"
      style={{ border: '1px solid var(--pp-line)' }}
    >
      <span className="break-all text-sm font-medium">{webhook.url}</span>
      <div className="flex flex-wrap gap-1.5">
        {webhook.events.map((event) => (
          <span key={event} className="tag tag-neutral">
            {WEBHOOK_EVENT_LABELS[event]}
          </span>
        ))}
      </div>
      <span className="text-xs" style={{ color: 'var(--pp-muted)' }}>
        Secreto: …{webhook.secretHint}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={props.test?.status === 'sending'}
          aria-label={`Enviar prueba a ${webhook.url}`}
          onClick={props.onTest}
        >
          Enviar prueba
        </Button>
        <Button variant="ghost" aria-label={`Borrar ${webhook.url}`} onClick={props.onRemove}>
          Borrar
        </Button>
      </div>
      {result ? (
        <span
          role="status"
          className="text-xs"
          style={{ color: result.failed ? '#e5484d' : 'var(--pp-muted)' }}
        >
          {result.text}
        </span>
      ) : null}
    </li>
  );
}

/** Pestaña «Webhooks» de la página del equipo (ADR 0028). Hay que montarla con `key` por equipo. */
export function WebhooksPanel({ slug, token }: WebhooksPanelProps): JSX.Element {
  const state = useWebhooks(slug, token);
  const count = state.webhooks?.length ?? 0;
  const atLimit = count >= MAX_WEBHOOKS_PER_TEAM;

  function confirmRemove(webhook: WebhookView): void {
    if (window.confirm(`¿Borrar el webhook de ${webhook.url}?`)) void state.remove(webhook.id);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
        Un webhook avisa por HTTP a otra herramienta (Jira Automation, n8n, Zapier…) cuando se
        estima una tarea, se importan tareas o se envía el resumen de una sesión. Cada envío va
        firmado con el secreto del webhook. Solo lo envían las partidas creadas desde este equipo.
      </p>

      {state.error ? (
        <p role="alert" className="text-sm" style={{ color: '#e5484d' }}>
          {state.error}
        </p>
      ) : null}

      {state.created ? (
        <CreatedSecret webhook={state.created} onDismiss={state.dismissCreated} />
      ) : null}

      {state.webhooks === null ? (
        <p className="text-sm">Cargando webhooks…</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <span className="pp-kicker">Webhooks del equipo</span>
            <span className="text-xs" style={{ color: 'var(--pp-muted)' }}>
              {count.toString()} de {MAX_WEBHOOKS_PER_TEAM.toString()}
            </span>
          </div>
          {state.webhooks.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
              Todavía no hay webhooks.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {state.webhooks.map((webhook) => (
                <WebhookRow
                  key={webhook.id}
                  webhook={webhook}
                  test={state.tests[webhook.id]}
                  onTest={() => {
                    void state.test(webhook.id);
                  }}
                  onRemove={() => {
                    confirmRemove(webhook);
                  }}
                />
              ))}
            </ul>
          )}
          {atLimit ? (
            <p className="text-xs" style={{ color: 'var(--pp-muted)' }}>
              Un equipo puede tener hasta {MAX_WEBHOOKS_PER_TEAM.toString()} webhooks: borra uno
              para añadir otro.
            </p>
          ) : null}
          <AddWebhookForm disabled={atLimit} onSubmit={state.add} />
        </>
      )}
    </div>
  );
}
