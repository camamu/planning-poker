# 0034 — Emojis de Fluent en toda la web

## Contexto

Los emojis de la web eran los de la fuente de cada dispositivo: Apple en iPhone y Mac, Segoe en
Windows, Noto en Android. La sala no se veía igual para todos, y junto al estilo Nocturne quedaban
como de otra app. El ADR 0033 dejó como siguiente paso usar un juego abierto en toda la web. Se
probaron Fluent plano, Twemoji, Noto y OpenMoji en una maqueta de la sala, y el equipo eligió
**Fluent Emoji plano** de Microsoft: tiene licencia MIT (sin pagar ni citar), unos 3.100 dibujos y un
trazo limpio que encaja con los sombreros y los avatares.

## Decisión

- **Un SVG por emoji, servido por la propia web.** El plugin `pp-fluent-emoji`
  (`apps/web/build/emojiAssets.ts`) lee `@iconify-json/fluent-emoji-flat`, una dependencia de
  desarrollo, y publica cada dibujo en `/emoji/<clave>.svg`. En desarrollo lo hace como middleware y
  en el build como ficheros de `dist/`. La clave es la que usa Iconify en `chars.json`: los puntos de
  código en hexadecimal, de al menos cuatro cifras y sin U+FE0F (`❤️‍🔥` → `2764-200d-1f525`).
  - El navegador solo pide los que se ven y los guarda en caché.
  - Todos pesan unos 9 MB, cada uno entre 1 y 3 KB. Workers admite 20.000 ficheros.
  - Un sprite o un JSON con todos se descartaron: obligarían a descargar todo para pintar cuatro.
- **👉 se añade a mano.** Iconify lo dibuja como espejo de 👈 (`hFlip`) y no lo pone en
  `chars.json`.
- **`Emoji` y `EmojiText`** (`design-system/components/Emoji`):
  - `Emoji` pinta un emoji con su `<img>`, del tamaño del texto que lo rodea (`.pp-emoji`, 1,2 em) y
    con el propio emoji como texto alternativo. Si el dibujo no existe o no carga, se queda el de la
    fuente del sistema.
  - `EmojiText` trocea un texto por grafemas y solo dibuja los que la fuente ya pintaría como emoji:
    los de presentación de emoji, o los que llevan U+FE0F o forman un keycap. ✓, ✕, →, ↗ o ☰ siguen
    siendo texto.
- **Dónde se usa.** En todo lo que la web escribe con emoji:
  - la cabecera y el menú ☰, la barra de reacciones y los emojis lanzados;
  - las insignias 👑, 🔑, 🐔 y 🦸, y ⛄ Copito;
  - los ⏱️ de la cuenta atrás y del temporizador, y «🎉 Revelada»;
  - el rol 🃏 / 👀 al entrar, mediante `SegmentedControl`;
  - el selector de emojis;
  - y todos los sitios que enseñan valores de carta, porque ☕ es una carta: `Card`, la
    distribución, la comparación de rondas, la estimación de cada tarea, el resumen de sesión y las
    vistas previas de baraja.
- **El selector solo ofrece lo que Fluent dibuja.** El build publica también `/emoji/index.json`, la
  lista de claves. `resolveFluentEmojiData` filtra con ella los datos de emojibase (ADR 0033). Como
  frimousse ya no filtra por lo que soporta el navegador, en un dispositivo antiguo también se ven y
  se pueden lanzar los emojis más nuevos. Si el índice no carga, se ofrecen todos.

## Consecuencias

- La sala se ve igual en cualquier dispositivo, y los emojis lanzados también: viajan como texto en
  `emoji_thrown` y cada cliente los dibuja con Fluent.
- Fluent no tiene banderas ni los emojis más recientes que él. El selector no los ofrece, y si
  llegan por otro lado (un cliente antiguo, un texto) se ven con la fuente del sistema.
- Lo que escribe la gente (títulos de tareas, nombres, el nombre de la partida) se queda con la
  fuente del sistema. Pasarlo por `EmojiText` es posible, pero toca muchos sitios y no se ha pedido.
- Los `aria-label`, los `title` y las `<option>` de los `<select>` no admiten imágenes y siguen con el
  emoji en texto.
- Actualizar los dibujos es subir `@iconify-json/fluent-emoji-flat`.
