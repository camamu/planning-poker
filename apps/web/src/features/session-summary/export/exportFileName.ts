const MAX_SLUG_LENGTH = 50;

/** `planning-<nombre-de-partida>-<aaaa-mm-dd>.csv`, con la fecha del navegador de quien exporta. */
export function csvFileName(gameName: string, date: Date): string {
  return `planning-${slugOf(gameName)}-${isoDay(date)}.csv`;
}

/** Sin tildes ni signos, que no sirven en un nombre de fichero; un nombre sin letras queda como `partida`. */
function slugOf(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'partida' : slug;
}

function isoDay(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${date.getFullYear().toString()}-${month}-${day}`;
}
