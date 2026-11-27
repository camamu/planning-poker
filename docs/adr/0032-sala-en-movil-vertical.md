# 0032 — La sala en un móvil en vertical

## Contexto

La mesa se maquetó para escritorio: elipse de 900×520 con asientos de 112 px que no encogen. En un
móvil en vertical (390 px) la elipse se queda en unos 200 px de alto, los asientos se pisan entre
ellos y tapan la tarea, la cabecera se sale por la derecha (la página entera hace scroll lateral), las
cartas de la mano se aplastan y el botón de revelar queda debajo de todo. La mitad del equipo vota
desde el móvil (`docs/04-brief-diseno.md`), y el handoff ya traía la sala móvil en
`docs/06-handoff-diseno.md` §8, sin implementar.

## Decisión

- **Sala compacta por debajo de 640 px** (`sm` de Tailwind), decidida con `matchMedia` en
  `GameTablePage` (`useMediaQuery`, `COMPACT_ROOM_QUERY`) porque los asientos se colocan en JS. Sin
  `matchMedia` (jsdom) la sala es la de escritorio. Al girar el móvil cambia sola.
- **Mesa en rejilla de cuatro columnas**, como en el handoff: la tarea va encima de la mesa (sin
  repetirla en el kicker), el tapete es un óvalo `border-radius: 44%/26%` y los asientos van en el
  orden en que entraron, con la última fila centrada. Asiento sin caja, carta de 38×52 (`Card` gana
  el tamaño `xs`) y nombre a 10 px. Las posiciones salen de `compactSeatPosition` en `%`, igual que
  las de la elipse, así que los lanzamientos de emojis no cambian.
- **Guirnalda de invierno por el borde del óvalo** (`compactLightsLayout`). En la rejilla hay
  asientos en el centro sin borde delante, así que el borde se reparte en tramos iguales, uno por
  asiento en el orden en que caen alrededor del centro: cada uno sigue encendiendo el suyo al votar.
- **Mano pegada abajo mientras se vota**: cartas de 56×80 (tamaño `md`) que se deslizan en
  horizontal y, debajo, «Revelar las cartas · N de M» a 52 px para quien puede revelar. El botón
  no se mueve nunca, como pide el handoff; el panel de resultados no lo repite
  (`revealShownElsewhere`). Revelada la ronda, la mano deja de estar fija y vuelve a su sitio, al
  final de la página. Los emojis salen de la mano y van debajo de la mesa (`EmojiControls`).
- **Cabecera con menú ☰ por debajo de 768 px**: logo, nombre con el meta debajo, cuenta atrás,
  sonido y ☰. Tareas, Resumen, Ajustes, nieve, Sombrero, Invitar y Salir van en el menú, con filas
  de 44 px. El aviso de tareas en diferido por votar se ve en el ☰ y dentro del menú. Entre 640 y
  768 px la mesa sigue en elipse pero los botones ya no caben en la cabecera.
- **Tablet en vertical**: por debajo de `lg` la mesa en elipse gana hueco arriba y abajo para los
  asientos que sobresalen, que pisaban la cabecera y la fila de espectadores.

## Consecuencias

- Desviaciones del handoff: el resultado no sube como hoja inferior sino que sigue en el panel,
  debajo de la mesa (con la mano ya suelta, se llega con un scroll); y en el menú ☰ hay más cosas que
  la cola de tareas, porque la sala tiene más acciones que la maqueta.
- La rejilla no tiene «tu» asiento abajo del centro como la elipse: con cuatro columnas el orden de
  entrada es más fácil de seguir que una rotación.
- Por debajo de 640 px la nieve ya no cuajaba sobre los asientos (`Snowfall`), así que quitarles la
  caja no cambia nada en invierno.
- La mesa de la portada (`DemoTable`, ADR 0029) sigue escalando la de escritorio; podría usar la
  compacta, pero no forma parte de este cambio.
