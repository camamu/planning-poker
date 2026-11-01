# 0029 — Página principal en `/`

_Escrito al planificar el bloque 21 (`docs/07-plan-v2.md` §13) y actualizado al implementarlo: ver
«Cómo quedó»._

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

## Cómo quedó (bloque 21)

- **Diseño sin Claude Design.** Se eligió la opción A («mesa a la vista») entre tres maquetas
  hechas con los tokens Nocturne reales y se ajustó por comentarios. No hubo handoff: los componentes
  de presentación nuevos (`Icon`, `FeatureCard`, `Step`) se escribieron directamente en
  `design-system/`.
- **La mesa de la cabecera es la de la sala.** `features/landing/DemoTable` monta `Table` de
  `features/game-table` con una partida fija (cinco votos revelados, quién reparte, facilitador,
  pluma y capa) y la escala para que quepa, más las casillas «Media» y «Acuerdo» de `ResultsPanel`.
  Se descartó una mesa propia en `design-system/` porque divergiría de la real al primer cambio.
  Los asientos de la sala miden 112 px y no encogen, así que en un móvil (menos de 420 px de
  ancho) la mesa de cinco quedaría a un tercio de su tamaño. Ahí se pinta con dos asientos, arriba
  y abajo, sobre una mesa más pequeña: con tres, los laterales tapan el centro de la mesa.
- **«Sin cuentas» como bloque de color sólido** (`accent-700` con texto claro, igual en los dos
  temas): el acento claro del tema oscuro no da contraste AA con texto claro.
- **Dos desviaciones visuales del brief**, pedidas al revisar las maquetas: un fondo con degradado
  suave del acento (el brief decía «nada de degradados») y un botón relleno para «Crear sala», como
  variante nueva `solid` de `Button`. `primary` sigue siendo de contorno en el resto de la app.
- **Accesos de «Volver a lo tuyo»** con un icono por elemento, elegido a partir de su id con
  `iconForSeed` (como el color de `hueForSeed`): equipos y partidas no tienen icono propio y así no
  hay que guardar nada nuevo. Se distinguen por el texto pequeño («equipo» o la fecha).
- **Sin aviso de servidor en la portada.** `main.tsx` ya arranca el calentamiento al cargar; en `/`
  no se enseña `ServerWakeBanner`.
- **Open Graph con URL absoluta opcional.** La imagen (`public/og-image.png`) necesita URL absoluta
  para Slack y Teams; el build la toma de `VITE_PUBLIC_URL`, que `deploy.yml` construye a partir de
  la variable de repositorio `WEB_HOST` si existe (`docs/06-despliegue.md` §5). Sin ella, la URL
  queda relativa.
- **Versión en el pie** inyectada por `vite.config.ts` desde `.release-please-manifest.json`.

## Pendiente

- **Sincronizar `design-system/` con Claude Design.** `Icon`, `FeatureCard`, `Step`, la variante
  `solid` de `Button` y el token `--pp-on-accent` existen solo en el repo, no en el proyecto Nocturne
  de Claude Design. Se hace desde Claude Code en local, sobre `develop` una vez fusionado el bloque:
  `/design-login` una vez y después `/design-sync`. No se pudo hacer desde la sesión en la nube que
  implementó el bloque porque `/design-login` necesita una sesión interactiva. Claude Design como
  aplicación independiente cierra el 14 de diciembre de 2026 y pasa a estar dentro de Claude: si el
  proyecto se mueve antes, sincronizar contra su nueva ubicación. Al terminar, borrar este apartado y
  la nota equivalente de `04-brief-diseno.md` §5.7.
