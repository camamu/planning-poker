# Handoff: Planning Poker — partida en tiempo real

## Overview

App web de planning poker para refinamientos de equipo remoto. El equipo se sienta a una mesa
virtual, cada persona elige una carta en secreto, y al revelar se giran todas a la vez y se
calcula media, acuerdo y distribución. El tono es desenfadado: mesa de casino, avatares
monstruo, confeti en unanimidad, plumas de gallina para quien infla la estimación, capa de
superhéroe para quien la corta, y emojis que se lanzan de un asiento a otro con sonido.

Cubre: escritorio (mesa completa + panel lateral), móvil (mesa compacta, mano fija abajo),
creación y entrada a partida, editor de barajas, cola de tareas, ajustes de partida y los
estados de error/vacío.

## About the Design Files

Los ficheros de este paquete son **referencias de diseño hechas en HTML** — prototipos que
muestran el aspecto y el comportamiento previstos, no código de producción para copiar.

El trabajo consiste en **recrear estos diseños en el entorno del codebase destino** (React,
Vue, Svelte, lo que ya exista) usando sus patrones y librerías establecidos. Si aún no hay
entorno, elige el framework más apropiado e impleméntalos allí. No hay que portar el HTML
tal cual: el prototipo usa un runtime de plantillas propio y estilos inline por razones de
la herramienta de diseño, no por decisión de arquitectura.

## Fidelity

**Alta fidelidad.** Colores, tipografía, espaciados, radios, animaciones y copys son
definitivos. La UI debe reproducirse fielmente usando las librerías del codebase.
El sistema visual es **Nocturne** (dark por defecto, con tema claro): fondo azul-gris casi
neutro, Inter, radios de 8px, un único acento blurple usado como línea y como brillo, nunca
como relleno masivo. Los botones primarios son **contorneados**, nunca rellenos.

---

## Screens / Views

### 1. Mesa de votación — escritorio (1440×900)

**Propósito:** la pantalla principal. Se vota, se revela y se discute.

**Layout:** columna vertical.

- Barra superior fija, 58px, `background: --color-surface`, borde inferior 1px `--color-divider`.
  Contiene: logo (carta 22×30 rotada -8°, borde 1.5px acento, "8" dentro), nombre de partida
  (14px/600), meta separado por borde izquierdo ("Fibonacci · 9 votantes · 2 mirones"), y a la
  derecha: cronómetro (píldora tintada acento 12%), botón mute, "Copiar enlace", avatar propio
  32×32 radio 10px.
- Cuerpo: `grid-template-columns: 1fr 316px` — mesa a la izquierda, panel a la derecha.

**Mesa (izquierda):** fondo `--pp-felt`. Contenedor relativo de 900px de ancho, máx 520px alto.
Capas apiladas, todas `border-radius: 50%`:

1. Base: `linear-gradient(180deg, --color-neutral-800, --color-neutral-900)`, sombra
   `0 26px 60px rgba(0,0,0,.55)` + inset highlight superior.
2. Tapete (inset 18px): `radial-gradient(120% 100% at 50% 32%, --color-accent-800 0%,
--color-accent-900 55%, #1b1d2c 100%)`, inset ring 1px `--color-accent-700`.
3. Textura (inset 18px): rayas 45° a 2.8% de opacidad, opacidad global .5.
4. Aro interior (inset 44px): borde 1px `rgba(145,132,217,.28)`.

**Centro de la mesa:** kicker mono 11px uppercase letter-spacing .14em en `--color-accent-300`,
título de tarea 20px/500 con `-webkit-line-clamp: 3`, píldora de ronda (borde acento-400),
y el "bote": tres fichas solapadas -11px (30px, radio completo, inset ring 3px) + contador
"N fichas en el bote".

**Asientos:** 9 (o 12 en el estado de mesa llena) repartidos en elipse. Posición del asiento i
sobre n:

```
a = (90 + (i - 4) * 360 / n) * PI / 180
left = 50 + 44 * cos(a)   // %
top  = 50 + 46 * sin(a)   // %
transform: translate(-50%, -50%)
```

El índice 4 es siempre "Tú", y por la fórmula cae abajo del centro. Cada asiento: 112px de
ancho, radio 14px, fondo `rgba(22,24,38,.42)` (el propio `rgba(145,132,217,.14)` + inset ring
acento).

Dentro del asiento, de arriba abajo:

- **Carta 50×70px** con volteo 3D: contenedor `perspective: 700px`, hijo con
  `transform-style: preserve-3d`, `transition: transform .6s cubic-bezier(.2,.85,.3,1)`.
  Cara trasera: borde 1px `--color-accent-600`, fondo `--color-accent-800`, con un check ✓ en
  círculo 24px borde acento-400 si ya votó, o "···" pulsante (`ppPulse` 1.8s) si no.
  Cara frontal (`rotateY(180deg)`): borde 1px acento, fondo `--color-surface`, número 24px/600
  tabular, `box-shadow: 0 0 18px rgba(145,132,217,.28)`.
  Regla: la carta se muestra girada si `voted && (revealed || isMe)`.
- **Fila de nombre:** avatar monstruo 24px radio 8px (color `oklch(0.73 0.125 H)`, H del array
  de hues) con dos ojos 5px y boca 8×3px, animación `ppFloat` 4s; nombre 12px/500 con
  ellipsis; ficha "D" del dealer (17px, círculo neutral-200, texto oscuro) cuando aplica.
- **Insignias post-reveal** (ver Interacciones).

**Barra inferior de la mesa:** "Mirando desde la barrera" + chips punteados de espectadores.

**Mano fija (parte baja de la columna izquierda):** borde superior, fondo `--color-bg`,
padding 16px 28px 20px.

- Fila superior: pista de estado a la izquierda; a la derecha, segmentado **Lanzar / Reaccionar**
  (padding 3px, radio 9px, borde `--pp-line`; opción activa tintada acento 18%) seguido de 5
  botones de emoji 32×32 radio 9px.
- Fila de cartas: 9 botones 74×104px, radio 10px, borde 1.5px, número 26px/600 tabular.
  Seleccionada: borde acento, fondo acento 16%, texto acento, `translateY(-14px)`,
  `box-shadow: 0 10px 26px rgba(145,132,217,.32)`.
  Hover: `translateY(-12px) rotate(-2deg)`, transición .18s cubic-bezier(.2,.85,.3,1).
  Las cartas `?` y `☕` van con borde punteado y no cuentan para la media.

**Panel lateral (316px):** dos contenidos excluyentes.

- _Antes del reveal:_ título "Quién ha votado" + contador "N de M"; barra de progreso 6px con
  `transition: width .4s`; nota que nombra a quien falta; caja punteada de cuenta atrás
  (00:47, 30px/600 tabular); y abajo del todo (`margin-top: auto`) el botón **Revelar las
  cartas** (contorno acento 1.5px, 13px de padding, 15px/600), su nota, y un botón secundario
  de temporizador de discusión.
- _Tras el reveal:_ cabecera "Resultado" + píldora "Revelada"; dos tarjetas (Media, Acuerdo)
  en grid 1fr 1fr, número 26px/600 tabular; distribución en barras horizontales de 22px
  (la más votada en `--color-accent`, el resto en `--color-accent-700`); veredicto en prosa;
  y las acciones: "Aceptar N y pasar página" (primario), "Volver a votar" / "Siguiente tarea".

### 2. Mesa antes de abrir la ronda (1440×520)

Mesa vacía: cuatro cartas punteadas 56×80, kicker "Siguiente · PP-142", título 22px/500,
línea de recordatorio, chips de quién está dentro ("+6 más"), y botón "Abrir votación".

### 3. Panel de resultados — tres variantes (340px cada una)

- **Con media (Fibonacci):** media + acuerdo + distribución de 4 filas.
- **Sin media (Tallas):** en barajas no numéricas no hay media; se muestra "Carta más votada".
- **Unanimidad:** borde acento en la tarjeta, badge "🎉 9 de 9", acuerdo al 100% en acento, y
  confeti cayendo (7 tiras de 6-7×10-12px, `ppConfeti` 2.6-3.4s linear, delays escalonados).

### 4. Unirse / Crear partida / Enlace listo

- **Unirse (400px):** tres cartas decorativas rotadas, título "Te esperan para estimar", campo
  de nombre, segmentado "🃏 Voto / 👀 Miro", botón "Sentarme a la mesa".
- **Crear (420px):** nombre de partida, selector de baraja como lista de radios (Fibonacci,
  Tallas, baraja del equipo — cada una con su secuencia debajo en 11px tabular), fila plegable
  "Ajustes finos" (ver pantalla 9), botón "Crear y repartir".
- **Enlace listo (340px):** QR 150×150 placeholder, campo de URL en mono + botón "Copiar",
  aviso de caducidad.

### 5. Editor de barajas (1000px, grid 360px / 1fr)

Izquierda: lista de barajas (las del sistema con etiqueta "del sistema", la del equipo en
estado "editando" con borde acento) y "+ Baraja nueva" punteado.
Derecha: nombre, chips de carta arrastrables (asa ⠿; la que se arrastra va rotada -3° con
borde acento), aviso de que `?` y `☕` son fijas, y previsualización "Así quedará la mano"
sobre fondo `--pp-felt` con cartas 52×74.

### 6. Cola de tareas — panel lateral (340×640)

Cabecera con contador "2 de 6 estimadas". Lista scrolleable con tres grupos: **En la mesa**
(tarjeta con borde acento), **Por estimar** (arrastrables; se muestra una en arrastre, rotada
-1.2°, y una línea de inserción de 2px en acento), **Ya estimadas** (opacidad .72, con la carta
resultante 30×38 a la derecha). Pie fijo con input de alta rápida + botón "Añadir".
Variantes: **estado vacío** (dos cartas punteadas, "Aquí no hay nada que estimar", input
resaltado en acento) y **fila en edición en línea** (input + Guardar / Poner en la mesa / 🗑).

### 7. Estados que siempre se olvidan

Reconectando (banda tintada con punto pulsante, mano al 55% y `pointer-events: none`),
partida caducada, único jugador en la mesa, mesa sin nadie sentado, error al registrar el voto
(con Reintentar), y nombre kilométrico recortado con ellipsis.

### 8. Móvil (390×844) — tres pantallas

- **Votando:** barra de estado; cabecera compacta (logo, nombre truncado, mute, ☰); zona de
  mesa con el tapete elíptico (`border-radius: 44%/26%`) y los asientos en **grid de 4
  columnas** en vez de en elipse — carta 38×52, nombre 10px; fila de emojis; y abajo, fijo:
  pista + carrusel horizontal de cartas 56×80 con `overflow-x: auto` (la elegida sube 8px) y el
  **botón de revelar siempre visible**, 52px de alto mínimo.
- **Revelada:** la mesa pasa a grid de 4 columnas con las cartas ya giradas y sus insignias
  (plumas, capa), y el resultado sube como **hoja inferior** (radio 18px arriba, asa de 4×38px,
  `box-shadow: 0 -12px 30px rgba(0,0,0,.4)`) con media, acuerdo, distribución y acciones.
- **Cola de tareas:** a pantalla completa tras el ☰, mismos tres grupos, filas de 56px mínimo.

Regla móvil: todo objetivo táctil ≥44px; los botones principales, 52px.

### 9. Ajustes de partida — desplegados (460px, y variante móvil)

Cabecera "Ajustes finos" + "Se aplican a la ronda siguiente" con chevron ▴.

- **Interruptores** (44×26px, radio completo; encendido = fondo acento 22% + borde acento +
  pomo 20px en acento; apagado = fondo `--color-bg` + borde `--pp-line`):
  Auto-revelar (on), Cambiar el voto tras votar (on), Fiesta al haber unanimidad (on),
  Emojis lanzados (off).
- **¿Quién puede revelar?** segmentado de 3: Cualquiera / Solo el dealer / Quien creó.
  Nota: el dealer rota en cada tarea.
- **Cuenta atrás por tarea:** cuatro opciones (Sin límite / 0:45 / 1:30 / 3:00) + interruptor
  "Al llegar a cero, revelar igualmente".
- Acciones: "Guardar ajustes" / "Volver a los de serie".
  La variante móvil es la misma lista como hoja inferior, con filas de 48px y toggles 48×29.

---

## Interactions & Behavior

**Elegir carta.** Clic en una carta de la mano fija `sel = label`. Se puede cambiar mientras
no se haya revelado (si el ajuste lo permite). Suena un doble clic corto (520Hz + 780Hz,
onda cuadrada, ~50ms).

**Revelar.** Todas las cartas giran **a la vez**, `transform: rotateY(180deg)` con
`transition: transform .6s cubic-bezier(.2,.85,.3,1)`. Sonido: arpegio ascendente
(523/659/784/1047 Hz, triangular) si hay unanimidad; dos notas descendentes (392/294 Hz) si no.
Con auto-revelar activo, se dispara solo cuando vota la última persona.

**Insignias post-reveal.** Solo cuando hay dispersión (`max > min` entre votos numéricos):

- Quien votó **más alto** recibe plumas de gallina: 3 plumas absolutas (8-9×13-15px,
  `border-radius: 60% 60% 50% 50% / 80% 80% 35% 35%`) cayendo con `ppPluma` 2.6-3.1s en bucle,
  más la etiqueta "🐔 Cobarde".
- Quien votó **más bajo** recibe capa de superhéroe: polígono
  `polygon(50% 0,100% 8%,86% 100%,50% 84%,14% 100%,0 8%)` de 64×74px oscilando ±7°
  (`ppCapa` 2.4s), aura pulsante en la carta (`ppAura` 1.8s) y etiqueta "🦸 Valiente".
- Ambas etiquetas entran con `ppPop` .4s.

**Unanimidad.** Confeti cayendo sobre el panel de resultado, colores del acento y de la rueda
oklch, `ppConfeti` con rotación de 540° y fade de entrada y salida.

**Emojis — dos modos** (segmentado Lanzar / Reaccionar):

- _Lanzar:_ clic en un emoji lo "arma" (borde acento, se eleva 3px, cursor de la mesa pasa a
  `crosshair` y todos los asientos ganan un anillo acento). El siguiente clic sobre un asiento
  lo lanza: el emoji nace en la posición de tu asiento a `scale(.7)` y viaja a la del destino
  a `scale(1.5) rotate(520deg)` en 620ms, con easing de arco
  (`cubic-bezier(.35,-0.55,.6,1)` en `top`, `cubic-bezier(.35,-0.35,.6,1)` en `left`).
  Al impactar (680ms) suena un golpe grave (180Hz, cuadrada, 90ms), aparece la reacción sobre
  el asiento y el emoji se desvanece a `scale(2.1)`. Silbido de lanzamiento: 720Hz → 420Hz.
- _Reaccionar:_ el emoji sale directamente sobre tu propio asiento, sin armar ni apuntar.
- La reacción flota con `ppReact` 2.2s (sube 58px, escala 1.15 → 1 y se desvanece) y suena a
  880Hz triangular. Un lanzamiento tiene un 60% de probabilidad de contagiar a otro asiento
  700-1300ms después (solo un nivel de contagio, sin cascada infinita).

**Mute.** El botón de la barra superior corta toda la síntesis de audio. Todo el sonido se
genera con WebAudio (osciladores + rampas exponenciales de ganancia), no hay ficheros.

**Tema.** Toggle claro/oscuro; el tema se aplica con `data-theme` en el contenedor raíz y
sobrescribe las variables CSS.

**Arrastres.** Tareas de la cola y cartas del editor de barajas se reordenan arrastrando por el
asa ⠿; en arrastre la fila rota ligeramente y gana sombra, y aparece una línea de inserción de
2px en acento.

**Estados vacíos y de error** según pantalla 7. Los nombres largos siempre se recortan con
ellipsis; nunca rompen la fila ni el asiento.

## State Management

Estado de una partida (servidor, sincronizado por websocket):

- `game`: id, nombre, baraja (id + secuencia de cartas), ajustes.
- `settings`: `autoReveal`, `allowVoteChange`, `celebrate`, `throwEmojis`,
  `whoReveals: 'anyone' | 'dealer' | 'creator'`, `countdownSeconds | null`,
  `revealOnTimeout`.
- `players[]`: id, nombre, hue del avatar, `role: 'voter' | 'spectator'`, `connected`,
  `isDealer`.
- `round`: taskId, número de ronda, `revealed`, `votes: { playerId: cardValue }`
  (el servidor **no** debe emitir los valores ajenos hasta el reveal — solo un booleano
  "ha votado"; si no, cualquiera lee los votos desde la consola).
- `tasks[]`: id, clave, título, `status: 'pending' | 'active' | 'estimated'`, estimación.

Estado local de cliente: carta seleccionada, tema, mute, modo de emoji (lanzar/reaccionar),
emoji armado, emojis en vuelo, reacciones vivas (se limpian con timeout).

Derivados (calcular en cliente a partir de la ronda): media de los votos numéricos
(excluyendo `?` y `☕`), acuerdo = votos de la carta más votada / total votado, distribución
ordenada por frecuencia, y máximo/mínimo para las insignias.

## Design Tokens

Vienen del sistema **Nocturne**; usar sus variables, no hexadecimales sueltos.

Base oscuro: `--color-bg #161826`, `--color-text #e9e9ed`, `--color-accent #9184d9`.
Rampas 100-900 por rol: `--color-neutral-*`, `--color-accent-*`.
Sombras: `--shadow-sm / md / lg`. Radio base 8px. Densidad de espaciado 0.70×.

Tokens propios de esta app:

| Token        | Oscuro  | Claro   |
| ------------ | ------- | ------- |
| `--pp-muted` | #9397ab | #595d6c |
| `--pp-line`  | #3f424d | #cfd3e5 |
| `--pp-felt`  | #1b1d2c | #dbdff1 |
| `--pp-back`  | #2b2741 | #cfd3e5 |

Tema claro (sobrescribe): `--color-bg #e4e7f5`, `--color-surface #f3f5fe`,
`--color-text #292b31`, `--color-accent #5d5294`, `--color-divider rgba(41,43,49,0.16)`.

Tintes de acento recurrentes: `rgba(145,132,217,.10)` fondo de tarjeta activa,
`.14` hover de botón primario, `.16-.18` estado seleccionado, `.22` carta propia.

Avatares: `oklch(0.73 0.125 H)` con H ∈ [289, 250, 200, 330, 30, 150, 100, 350, 60].

Tipografía: **Inter** en todo. Escala usada: 34px/500 título de página, 24px/500 y 22px/500
títulos de tarjeta, 20px/500 título de tarea en mesa, 16px/500 títulos de estado,
15px/600 y 14px/600 cabeceras de panel, 13px/500 cuerpo, 12px/500 secundario, 11px/500 notas.
Kickers y códigos de ticket en mono (ui-monospace/Menlo) a 10-11px, uppercase,
`letter-spacing: .12-.14em`. Números siempre con `font-variant-numeric: tabular-nums`.
Títulos con `letter-spacing: -0.015em` a `-0.02em` y `text-wrap: pretty`; nunca más de 500 de peso.

Radios: 6px chips pequeños, 8-10px controles y cartas, 12px tarjetas de lista,
14px contenedores grandes, 18px hojas móviles, 34px marcos de teléfono, 999px píldoras.

Keyframes (definidos en el prototipo, copiarlos tal cual):
`ppFloat` (avatar, 4s), `ppPulse` (espera, 1.8s), `ppConfeti` (2.6-3.4s),
`ppPop` (entrada .4s), `ppPluma` (2.6-3.1s), `ppCapa` (2.4s), `ppAura` (1.8s),
`ppReact` (2.2s).

## Accesibilidad

Foco de teclado siempre visible: `outline: 2px solid var(--color-accent); outline-offset: 2px`
— nunca el anillo azul del navegador. El acento sobre el fondo cumple 3:1, suficiente para
iconos y texto grande pero **no** para párrafos: para texto pequeño en acento usar
`--color-accent-300`. Los deshabilitados bajan a 45% de opacidad. Las celebraciones (confeti,
plumas, capa) deben respetar `prefers-reduced-motion` y desactivarse con el ajuste "Fiesta".

## Assets

Ninguno externo. Todo es CSS y emoji del sistema:

- Avatares monstruo: divs con `oklch()` y pseudo-ojos, sin imágenes.
- Iconos: el sistema pide **Phosphor Icons**; el prototipo usa emoji y glifos como marcador
  de posición (🔊 🔇 ☰ ⠿ ⚠ ▾ ▴ 🗑 ⏱). Sustituirlos por Phosphor al implementar.
- Emojis lanzables (👏 😂 😱 🤔 🐔) y cartas especiales (? ☕) sí son emoji reales, a propósito.
- QR: placeholder a rayas; generar el real en implementación.
- Sonido: sintetizado con WebAudio, sin ficheros de audio.

## Files

- `Planning Poker.dc.html` — todas las pantallas, en secciones numeradas 01-09.
  La sección 01 es interactiva de verdad (elegir carta, revelar, volver a votar, lanzar
  emojis, cambiar tema, probar mesa de 12 y título largo); el resto son estados estáticos.
- `_ds/nocturne-*/styles.css` — la hoja del sistema Nocturne con todos los tokens.
  Es la fuente de verdad de colores, tipos y espaciados.
- `support.js` — runtime de la herramienta de diseño. **No portar.**
