const SPECIAL_CARDS = new Set(['?', '☕']);

function count(n: number, one: string, many: string): string {
  return `${n.toString()} ${n === 1 ? one : many}`;
}

/** La línea de debajo del nombre de la partida: «7 valores · 6 votantes · 1 mirón». */
export function roomMeta(
  deckCards: ReadonlyArray<string>,
  voters: number,
  spectators: number,
): string {
  const values = deckCards.filter((card) => !SPECIAL_CARDS.has(card)).length;
  return [
    count(values, 'valor', 'valores'),
    count(voters, 'votante', 'votantes'),
    count(spectators, 'mirón', 'mirones'),
  ].join(' · ');
}
