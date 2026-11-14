/**
 * Tamaños máximos de lo que entra por el borde (ADR 0031). Son higiene de entrada, no reglas de
 * negocio: por eso viven aquí y no en el dominio, igual que `MAX_IMPORTED_ISSUES`. El front los
 * importa para el `maxLength` de sus campos, de modo que el servidor y la pantalla no discrepen.
 * Se cuentan en unidades UTF-16, que es lo que mide `z.string().max()`.
 */

/** Cualquier identificador (UUID, slug de baraja del sistema, `participantId`…): 36 sobra. */
export const MAX_ID_LENGTH = 64;
/** El slug se deriva del nombre del equipo, así que admite su longitud más un sufijo. */
export const MAX_SLUG_LENGTH = 100;

export const MAX_PLAYER_NAME_LENGTH = 40;
export const MAX_GAME_NAME_LENGTH = 80;
export const MAX_TEAM_NAME_LENGTH = 80;
export const MAX_DECK_NAME_LENGTH = 60;

/**
 * Una carta, sea de baraja o de voto. Es amplio a propósito: las barajas personalizadas que ya
 * existen se crearon sin tope y sus cartas tienen que seguir pudiendo votarse.
 */
export const MAX_CARD_LENGTH = 32;
export const MAX_CARDS_PER_DECK = 40;

export const MAX_ISSUE_TITLE_LENGTH = 200;
/**
 * Con `MAX_IMPORTED_ISSUES` tareas de título, descripción y enlace al máximo, el cuerpo de la
 * importación sigue por debajo del 1 MiB de `bodyLimit` de Fastify.
 */
export const MAX_ISSUE_DESCRIPTION_LENGTH = 2000;
export const MAX_URL_LENGTH = 2048;

/** Un emoji con tono de piel y unión de varios (ZWJ) ronda las 11 unidades UTF-16. */
export const MAX_EMOJI_LENGTH = 32;

export const MAX_NAMED_REVEALERS = 50;
/** Tope de la cantidad de ids de una orden de reordenación: una cota del cuerpo, no del tablero. */
export const MAX_REORDERED_ISSUES = 2000;

export const MAX_COUNTDOWN_SECONDS = 3600;
export const MAX_TIMER_SECONDS = 3600;

/**
 * El mensaje de `connect_error` cuando el servidor rechaza una conexión de Socket.IO por exceso de
 * uso. Socket.IO no reintenta solo una conexión rechazada por el servidor, así que el cliente
 * necesita reconocerlo para volver a intentarlo.
 */
export const RATE_LIMITED_CONNECTION_ERROR = 'rate_limited';
