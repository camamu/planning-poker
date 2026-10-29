import type {
  AddWebhookCommandInput,
  CreatedWebhookView,
  WebhookTestResultView,
  WebhookView,
} from '@pp/contracts';
import { useCallback, useEffect, useState } from 'react';
import {
  addWebhook,
  listWebhooks,
  removeWebhook,
  testWebhook,
} from '../../shared/api/teamsClient.js';

export type WebhookTestState =
  | { readonly status: 'sending' }
  | { readonly status: 'done'; readonly result: WebhookTestResultView }
  | { readonly status: 'error'; readonly message: string };

export interface WebhooksState {
  /** `null` mientras carga. */
  readonly webhooks: ReadonlyArray<WebhookView> | null;
  readonly error: string | null;
  /** El alta más reciente, con el secreto completo: es la única vez que se puede ver (ADR 0028). */
  readonly created: CreatedWebhookView | null;
  readonly tests: Readonly<Record<string, WebhookTestState>>;
  /** `true` si se ha creado; si falla, deja el motivo en `error`. */
  readonly add: (input: AddWebhookCommandInput) => Promise<boolean>;
  readonly remove: (webhookId: string) => Promise<void>;
  readonly test: (webhookId: string) => Promise<void>;
  readonly dismissCreated: () => void;
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

/** Hay que montarlo con `key` por equipo: no recarga si cambian `slug` o `token`. */
export function useWebhooks(slug: string, token: string): WebhooksState {
  const [webhooks, setWebhooks] = useState<ReadonlyArray<WebhookView> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedWebhookView | null>(null);
  const [tests, setTests] = useState<Readonly<Record<string, WebhookTestState>>>({});

  useEffect(() => {
    let cancelled = false;
    listWebhooks(slug, token).then(
      (loaded) => {
        if (!cancelled) setWebhooks(loaded);
      },
      (cause: unknown) => {
        if (cancelled) return;
        setError(messageOf(cause, 'No se pudieron cargar los webhooks.'));
        setWebhooks([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [slug, token]);

  const add = useCallback(
    async (input: AddWebhookCommandInput): Promise<boolean> => {
      setError(null);
      try {
        const webhook = await addWebhook(slug, token, input);
        setCreated(webhook);
        setWebhooks(await listWebhooks(slug, token));
        return true;
      } catch (cause) {
        setError(messageOf(cause, 'No se pudo crear el webhook.'));
        return false;
      }
    },
    [slug, token],
  );

  const remove = useCallback(
    async (webhookId: string): Promise<void> => {
      setError(null);
      try {
        await removeWebhook(slug, token, webhookId);
        setWebhooks(await listWebhooks(slug, token));
        setCreated((current) => (current?.id === webhookId ? null : current));
      } catch (cause) {
        setError(messageOf(cause, 'No se pudo borrar el webhook.'));
      }
    },
    [slug, token],
  );

  const test = useCallback(
    async (webhookId: string): Promise<void> => {
      setTests((current) => ({ ...current, [webhookId]: { status: 'sending' } }));
      try {
        const result = await testWebhook(slug, token, webhookId);
        setTests((current) => ({ ...current, [webhookId]: { status: 'done', result } }));
      } catch (cause) {
        const message = messageOf(cause, 'No se pudo enviar la prueba.');
        setTests((current) => ({ ...current, [webhookId]: { status: 'error', message } }));
      }
    },
    [slug, token],
  );

  const dismissCreated = useCallback(() => {
    setCreated(null);
  }, []);

  return { webhooks, error, created, tests, add, remove, test, dismissCreated };
}
