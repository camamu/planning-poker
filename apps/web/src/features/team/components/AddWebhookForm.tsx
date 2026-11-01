import { WEBHOOK_EVENTS } from '@pp/contracts';
import type { AddWebhookCommandInput, WebhookEventName } from '@pp/contracts';
import { useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { Button, Input } from '../../../design-system/index.js';
import { WEBHOOK_EVENT_LABELS } from '../../../shared/webhooks/webhookEventLabels.js';

export interface AddWebhookFormProps {
  /** Con el equipo en su límite de webhooks no se puede añadir otro. */
  readonly disabled: boolean;
  /** Resuelve a `true` si se creó, para vaciar el formulario. */
  readonly onSubmit: (input: AddWebhookCommandInput) => Promise<boolean>;
}

export function AddWebhookForm({ disabled, onSubmit }: AddWebhookFormProps): JSX.Element {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<ReadonlySet<WebhookEventName>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = !disabled && !submitting && url.trim() !== '' && events.size > 0;

  function toggle(event: WebhookEventName, checked: boolean): void {
    setEvents((previous) => {
      const next = new Set(previous);
      if (checked) next.add(event);
      else next.delete(event);
      return next;
    });
  }

  async function submit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const created = await onSubmit({
      url: url.trim(),
      events: WEBHOOK_EVENTS.filter((candidate) => events.has(candidate)),
    });
    setSubmitting(false);
    if (created) {
      setUrl('');
      setEvents(new Set());
    }
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-[10px] p-3"
      style={{ border: '1px solid var(--pp-line)' }}
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <Input
        label="URL del receptor"
        type="url"
        placeholder="https://…"
        value={url}
        disabled={disabled}
        onChange={(event) => {
          setUrl(event.target.value);
        }}
      />
      <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
        <legend className="pp-kicker mb-1">Avisar cuando</legend>
        {WEBHOOK_EVENTS.map((webhookEvent) => (
          <label key={webhookEvent} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={events.has(webhookEvent)}
              onChange={(event) => {
                toggle(webhookEvent, event.target.checked);
              }}
            />
            {WEBHOOK_EVENT_LABELS[webhookEvent]}
          </label>
        ))}
      </fieldset>
      <Button type="submit" variant="primary" disabled={!canSubmit}>
        Añadir webhook
      </Button>
    </form>
  );
}
