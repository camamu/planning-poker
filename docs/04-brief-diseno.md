# 04 — Brief de diseño (para Claude Design)

> Este documento **no** es para Claude Code. Es el material que se le da a Claude Design.
> Los documentos 00-03 son de ingeniería: dominio, hexagonal, CI. Casi nada de ahí le sirve a un diseñador, y pegarlo entero solo diluye el contexto útil.

---

## 1. Cómo usar este documento

Orden recomendado dentro de Claude Design:

1. Crear proyecto y **montar el sistema de diseño primero** (§3). Sin él la salida sale genérica.
2. Pegar el §2 (contexto de producto) como primer mensaje del chat.
3. Pedir **una pantalla por conversación**, empezando por la mesa de votación (§5.2). Es la que fija el lenguaje visual de todo lo demás.
4. Iterar con comentarios en el lienzo para lo puntual y con el chat para lo estructural.
5. Cuando la mesa esté bien, el resto de pantallas se piden pidiendo coherencia con ella.
6. Handoff a Claude Code cuando toque el bloque 6 del plan.

**No pidas "diseña la app entera" de una vez.** Sale un borrador genérico y consume mucho más.

---

## 2. Contexto de producto (pegar tal cual como primer mensaje)

> Estoy diseñando una herramienta interna de **Planning Poker** para un equipo de desarrollo: la usan durante el refinamiento para estimar tareas en conjunto.
>
> **Cómo funciona:** un facilitador abre una tarea a votación. Cada miembro elige una carta con su estimación. **Los votos permanecen ocultos hasta que se revelan todos a la vez**, para que nadie se ancle en la estimación de otro. Al revelar, se ve quién votó qué, la distribución, la media y el porcentaje de acuerdo. Si hay desacuerdo se discute y se vota otra vez.
>
> **Quién la usa:** entre 4 y 12 personas, perfil técnico, en una videollamada de 45 minutos. Aproximadamente la mitad vota desde el móvil mientras tiene la videollamada en el portátil.
>
> **Qué importa:** que el estado de la partida se entienda de un vistazo sin leer nada — quién ha votado ya, si estamos esperando a alguien, si los votos están ocultos o revelados. La sesión es aburrida y se hace cada dos semanas; la interfaz tiene que ser rápida y clara, no impresionante.
>
> **Qué no es:** no es un producto comercial, no hay registro ni onboarding. Se entra por un enlace, se pone un nombre y se juega. Hay una página principal que explica la herramienta a quien llega sin enlace de sala, pero no es marketing: es una portada sobria con un botón para crear la sala.

---

## 3. Sistema de diseño (definirlo antes de pedir pantallas)

No hay marca previa, así que hay que crear una mínima. Pídele a Claude Design que la establezca y la fije antes de nada:

> Antes de diseñar pantallas, define un sistema de diseño mínimo para esta herramienta y muéstramelo como una página de referencia: paleta, tipografía, escala de espaciado, radios, sombras y los componentes base.
>
> Dirección visual: **sobria y funcional, con un acento**. Es una herramienta de trabajo que se usa cada dos semanas, no una app de consumo. Nada de degradados, ilustraciones ni copy jugueton. Referencias de tono: Linear, Height, Raycast.
>
> Requisitos concretos:
>
> - Modo claro y oscuro desde el principio. Mucha gente estima con el IDE en oscuro.
> - Un único color de acento, usado con moderación: acción principal y estado "revelado".
> - Escala tipográfica con **números tabulares** — la mesa está llena de cifras que se alinean en columnas.
> - Densidad media-alta: hay que ver 12 participantes y una lista de tareas sin scroll en escritorio.
> - Contraste AA como mínimo en todo texto.
>
> Componentes base que necesito: `Card` (carta de estimación), `Avatar` con nombre, `Button` (primario, secundario, fantasma), `Badge` de estado, `Input`, `Select`, `Modal`, `Toast`, `Tooltip`, `Tabs`.

**La `Card` es el componente más importante del producto.** Necesita cuatro estados visuales bien diferenciados: _disponible_, _seleccionada por mí_, _boca abajo (alguien votó, valor oculto)_ y _revelada_. Pídelos explícitamente.

---

## 4. Restricciones que vienen del producto y no son negociables

Estas hay que dárselas; son las que hacen que el diseño sirva o no sirva.

| #   | Restricción                                                   | Consecuencia de diseño                                                                                                                  |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Los votos ajenos **no se ven hasta el reveal**                | La mesa tiene dos estados radicalmente distintos. El de "oculto" debe comunicar _quién ya votó_ sin filtrar _qué votó_                  |
| 2   | Mi propio voto sí lo veo siempre                              | Mi carta se distingue de las de los demás                                                                                               |
| 3   | Hay **espectadores** que no votan                             | Se muestran en la mesa, visiblemente aparte, sin hueco de carta y sin contar para "faltan 3 por votar"                                  |
| 4   | Dos barajas: `0.5 1 2 3 5 8 13 ? ☕` y `XS S M L XL XXL ? ☕` | Nueve y ocho cartas. Tienen que caber en una fila en móvil sin scroll horizontal incómodo                                               |
| 5   | `?` y `☕` son especiales                                     | Distintas visualmente del resto; no entran en la media                                                                                  |
| 6   | Con la baraja de tallas **no hay media**                      | El panel de resultados tiene una variante sin media. No puede quedar un hueco raro ni un `NaN`                                          |
| 7   | La mitad vota desde el móvil                                  | **Móvil primero** en la mesa de votación. La cuadrícula de cartas y el botón de revelar son lo único imprescindible en pantalla pequeña |
| 8   | El estado no puede depender solo del color                    | "Ha votado" necesita forma o icono además de color. Hay daltonismo en cualquier equipo de 12                                            |
| 9   | Se conecta y desconecta gente                                 | Hace falta un estado visible de "reconectando" que no bloquee la pantalla                                                               |

---

## 5. Pantallas

### 5.1 Crear partida y unirse

- **Crear:** nombre de la partida, selector de baraja (las dos de sistema + las del equipo), ajustes plegados por defecto (auto-revelar, cuenta atrás, mostrar media, quién puede revelar). Al crear, pantalla de enlace con botón de copiar y QR.
- **Unirse:** una sola caja — nombre y un conmutador "votar / observar". Sin contraseña ni registro. Es la primera pantalla que ve la mitad del equipo; tiene que resolverse en cinco segundos.

### 5.2 Mesa de votación (la pantalla principal)

Tres estados. Pídelos en este orden y en la misma conversación:

**A — Esperando a que se abra una ronda.** Tarea actual visible, participantes en la mesa, mensaje claro de que aún no se puede votar.

**B — Votación abierta, votos ocultos.** Es el estado en el que la gente pasa más tiempo.

- Cartas seleccionables abajo (móvil: fila fija inferior; escritorio: centradas bajo la mesa).
- Cada participante con su carta **boca abajo** si ya votó, o un hueco vacío si no.
- Contador de progreso: _7 de 9 han votado_.
- Cuenta atrás si está activada.
- Botón de revelar, solo para quien tiene permiso, deshabilitado con motivo si nadie ha votado.
- Temporizador de discusión, arrancable en cualquier momento.

**C — Revelada.** Todas las cartas se giran **a la vez**. Pide explícitamente esa animación simultánea: es el momento con más carga del ritual y merece cuidado.

- Valores visibles junto a cada persona.
- Panel de resultados (§5.3).
- Acciones: aceptar estimación · volver a votar · siguiente tarea.

### 5.3 Panel de resultados

Distribución de votos como gráfico compacto, media (oculta si la baraja no es numérica o si el ajuste lo dice), porcentaje de acuerdo, carta más votada. **Unanimidad = confeti**; no es adorno, es la señal de que se puede pasar a la siguiente sin discutir.

Pide dos variantes: con media y sin media.

### 5.4 Lista de tareas

Panel lateral en escritorio, hoja deslizante en móvil. Añadir, editar, reordenar arrastrando, marcar la actual. Cada tarea muestra su estimación final cuando la tiene. Estado vacío con la acción de añadir la primera.

### 5.5 Barajas del equipo

Listado con las dos de sistema (no editables, marcadas como tal) y las personalizadas. Editor: nombre, cartas en orden, arrastrables, con `?` y `☕` mostradas como añadidas automáticamente y no borrables. Vista previa de cómo quedará la mesa.

### 5.6 Estados que se olvidan siempre

Pídelos explícitamente o no aparecerán: partida vacía sin participantes · reconectando · partida no encontrada o caducada · un solo votante en la mesa · doce participantes con nombres largos · nombre de tarea muy largo · error al votar.

### 5.7 Página principal

Añadida en el plan v2 (bloque 21, `ADR 0029`). Pídela en una conversación propia, **después** de tener la mesa y con el sistema Nocturne ya cargado, pegando esto:

> Diseña la página principal de la herramienta, la que ve quien abre la URL sin un enlace de sala. Su trabajo es explicar en un minuto qué es y llevar a crear una sala en un clic. Usa el sistema de diseño existente (Nocturne) y la misma dirección sobria: nada de degradados, ilustraciones de stock ni copy de marketing.
>
> Secciones, en este orden:
>
> 1. **Cabecera**: logo, nombre, una frase de qué es, botón principal «Crear sala» y secundario «Crear equipo». Como imagen, una mesa en miniatura compuesta con los componentes reales: unas cuantas cartas reveladas, avatares y el porcentaje de acuerdo. Nada de capturas de pantalla.
> 2. **Volver a lo tuyo**: solo aparece si el navegador recuerda equipos o partidas. Una fila compacta con accesos directos. Diséñala con datos y vacía (ausente).
> 3. **Cómo funciona**: tres pasos numerados — crear la sala y compartir enlace o QR · cada uno elige su carta, oculta · se revelan a la vez y se acuerda.
> 4. **Funcionalidades**: tarjetas agrupadas en Votación, Resultados, Sala y Equipos, con un icono sencillo, un título y una línea cada una. Tienen que admitir crecer: se irán añadiendo más con el tiempo.
> 5. **Sin cuentas**: un bloque corto que lo explique.
> 6. **Pie** mínimo con la versión.
>
> Requisitos: móvil primero (el botón «Crear sala» visible sin scroll en un móvil), tema claro y oscuro, contraste AA. Pídeme también la variante de escritorio ancho.

Cuando quede aprobada, el handoff solo trae los componentes de presentación a `design-system/`; la página y su contenido los monta Claude Code en `features/landing/`.

---

## 6. Qué **no** pedirle

Página de precios, onboarding, pantallas de registro, dashboard de administración, e integraciones. Nada de eso existe en este producto. La página principal (§5.7) sí existe, pero como portada sobria, no como landing de marketing.

---

## 7. Del diseño al código

Cuando el diseño esté aprobado, se hace **handoff a Claude Code** desde Claude Design; el bundle conserva la intención de diseño mucho mejor que una captura de pantalla. Encaja exactamente en el bloque 6 del plan (`02-decisiones-y-plan.md`).

Dos cosas a vigilar al recibirlo en el repo:

1. **La estructura de `apps/web` la manda el proyecto, no el bundle.** Lo que llega es UI; el store, el socket y el contrato de eventos ya están definidos.
2. **Ningún adaptador de diseño toca `domain/`.** Sigue aplicando la barrera de `pnpm arch`.

Si el sistema de diseño acaba viviendo en el repo, se puede sincronizar en ambos sentidos con `/design-sync` desde Claude Code, de modo que futuras pantallas partan de los componentes reales y no de una aproximación.
