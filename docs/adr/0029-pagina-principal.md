# 0029 — Página principal en `/`

_Borrador escrito al planificar el bloque 21 (`docs/07-plan-v2.md` §13). Actualizar en la PR del
bloque si la implementación se desvía._

## Contexto

`04-brief-diseno.md` §2 y §6 descartaron una landing: la app era «se entra por un enlace, se pone un
nombre y se juega», y `/` es directamente el formulario de crear partida. Con equipos, barajas,
espectadores, temporizador y lo que añade el plan v2, quien llega a la URL sin un enlace de sala no
tiene forma de saber qué hace la herramienta ni qué ofrece, y la app se quiere poder enseñar.

## Decisión

- **`/` pasa a ser la página principal** y el formulario se mueve a `/games/new`, siguiendo el
  estilo de rutas en inglés que ya usan `/games/:id` y `/teams/new`. Los enlaces antiguos
  `/?team=…&deckId=…` (los que genera la página del equipo) redirigen a `/games/new` con los mismos
  parámetros.
- **Un clic hasta crear la sala**: «Crear sala» es el botón principal de la cabecera. Quien vuelve
  ve primero sus equipos recordados (y sus partidas recientes con el bloque 16), sin tener que pasar
  por la explicación.
- **No depende de la API.** Es estática para que cargue al instante aunque Render esté dormido, y
  aprovecha para despertar la API en silencio (bloque 14).
- **Solo anuncia lo que existe.** El contenido es un fichero de datos que cada bloque actualiza al
  entregar algo visible; la página no promete funcionalidades futuras.
- **Mismo sistema visual (Nocturne) y mismo flujo de diseño**: se pide en Claude Design
  (`04-brief-diseno.md` §5.7) y entra por handoff a `design-system/`. La imagen de cabecera usa los
  componentes reales, no capturas.
- **`noindex` por defecto.** Sigue siendo una herramienta interna; la página explica la app a quien
  llega con la URL, no busca tráfico. Quitarlo es una línea en `index.html` si algún día se quiere.

## Consecuencias

- Quien tenía guardada la URL raíz para crear partidas ve ahora la página principal y llega al
  formulario con un clic más.
- `04-brief-diseno.md` se actualiza: §2 ya no dice que no hay landing, §6 la quita de la lista de lo
  que no se pide y §5.7 trae el encargo para Claude Design.
- Se añade una obligación a los bloques siguientes: actualizar `features/landing/content.ts` cuando
  entreguen algo visible.
