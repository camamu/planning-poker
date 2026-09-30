/** Búsqueda sin distinguir mayúsculas ni tildes: "diseno" encuentra "Diseño". */
export function matchesQuery(
  query: string,
  ...fields: ReadonlyArray<string | null | undefined>
): boolean {
  const needle = normalize(query.trim());
  if (needle === '') return true;
  return fields.some(
    (field) => field !== null && field !== undefined && normalize(field).includes(needle),
  );
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
