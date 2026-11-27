# 0033 — Selector de emojis propio

## Contexto

El «+» de la barra de reacciones abre un selector con todos los emojis, hecho con `frimousse`
(ADR 0005). Es una librería sin estilos: tal cual, pintaba los emojis diminutos y apelotonados en un
tercio del diálogo, con las categorías en inglés («Smileys & emotion») y sin el aspecto de los
botones de la barra. Parecía de otra web. Además, cada vez que alguien lo abría, frimousse pedía los
datos (nombres, categorías, etiquetas) a `cdn.jsdelivr.net`: una petición a un tercero desde una
herramienta interna, y un selector que se queda en «Cargando…» en una red que bloquee ese CDN.

## Decisión

- **Datos servidos por la propia web.** `emojibase-data` (el paquete que frimousse descargaba del
  CDN) es una dependencia de desarrollo de `@pp/web`, y el plugin `pp-emojibase` de
  `vite.config.ts` sirve `es/data.json` y `es/messages.json` en `/emojibase/`: como middleware en
  desarrollo y como ficheros del build en producción (Cloudflare Workers los sirve como cualquier
  otro de `dist/`). El selector apunta ahí con `emojibaseUrl`. Solo se sirve el español: unos 780 KB
  sin comprimir, que se piden al abrir el selector, no al cargar la sala. Se descartó copiarlos a
  `public/`: serían ficheros de terceros en el repositorio, sin versión que los actualice.
- **En español** (`locale="es"`): categorías («Emoticonos y emociones»), nombres y búsqueda.
  «fuego» encuentra 🔥, «aplauso» encuentra 👏.
- **Con el aspecto de Nocturne** (`design-system/components/EmojiPicker`):
  - La cabecera de cada categoría usa `pp-kicker`, como «Mirando desde la barrera», y se queda fija
    arriba al hacer scroll.
  - Las celdas miden unos 45 px, como los botones de la barra de reacciones: radio de 9 px y el
    acento al pasar por encima. Son 9 columnas en el diálogo de 440 px y 7 en un móvil en vertical,
    por encima del mínimo táctil.
  - Al pie, el emoji activo con su nombre.
- **Dos detalles de frimousse:**
  - Pone `display: flex` en el `style` de cada fila, así que el ancho de cada celda se fija con
    `calc()`, y no con `flex: 1` (en los resultados de una búsqueda la última fila no se llena) ni
    con una rejilla.
  - La cabecera de categoría recibe su `position: sticky` por `style`: el componente propio añade el
    fondo encima en lugar de sustituirlo.

## Consecuencias

- Los emojis siguen siendo los del sistema de cada uno: Apple en iPhone y Mac, Segoe en Windows,
  Noto en Android. Es lo mismo que en la barra de reacciones, en los lanzamientos y en los botones
  con emoji de toda la web, así que deja de haber dos estilos.
- **Dibujar un juego propio, como los sombreros (ADR 0017), se descartó.** Son unos 1.900 emojis, y
  los que se lanzan viajan como texto en `emoji_thrown`, así que cada cliente los pintaría con su
  fuente salvo que se dibujen todos.
- **Un juego abierto servido como SVG (Twemoji, Noto, Fluent).** Igualaría el aspecto entre
  dispositivos, pero solo si lo usa toda la web. Se hizo después con Fluent plano: ADR 0034.
- Actualizar los emojis es subir `emojibase-data`, que vigila Dependabot. frimousse ya esconde los
  que el navegador no sabe pintar.
