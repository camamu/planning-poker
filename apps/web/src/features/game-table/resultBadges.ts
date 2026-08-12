import type { RoundVoteView } from '@pp/contracts';

const SPECIAL_CARDS = new Set(['?', '☕']);

function numericValue(raw: string): number | null {
  if (SPECIAL_CARDS.has(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface ResultBadges {
  readonly feathers: ReadonlySet<string>;
  readonly capes: ReadonlySet<string>;
}

/**
 * Plumas para quien votó más alto, capa para quien votó más bajo — solo si hay dispersión real
 * (docs/06-handoff-diseno.md "Interactions & Behavior"). Se calcula en el cliente a partir de
 * datos ya públicos tras el reveal; no hace falta nada nuevo del servidor.
 */
export function computeResultBadges(votes: ReadonlyArray<RoundVoteView>): ResultBadges {
  const numeric = votes
    .map((vote) => ({
      participantId: vote.participantId,
      value: vote.card ? numericValue(vote.card) : null,
    }))
    .filter((entry): entry is { participantId: string; value: number } => entry.value !== null);

  if (numeric.length < 2) return { feathers: new Set(), capes: new Set() };

  const max = Math.max(...numeric.map((entry) => entry.value));
  const min = Math.min(...numeric.map((entry) => entry.value));
  if (max === min) return { feathers: new Set(), capes: new Set() };

  return {
    feathers: new Set(
      numeric.filter((entry) => entry.value === max).map((entry) => entry.participantId),
    ),
    capes: new Set(
      numeric.filter((entry) => entry.value === min).map((entry) => entry.participantId),
    ),
  };
}
