import type { WebhookEventName } from '@pp/contracts';

/** Cómo se llama cada evento de webhook de cara a las personas: la página del equipo y los avisos de la sala. */
export const WEBHOOK_EVENT_LABELS: Record<WebhookEventName, string> = {
  'issue.estimated': 'Tarea estimada',
  'issues.imported': 'Tareas importadas',
  'session.summary': 'Resumen de sesión',
};
