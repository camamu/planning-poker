# 0031 — Ambientación navideña (Nochebuena)

## Contexto

El equipo quería que en Navidad la sala tuviera un aspecto invernal: que nevara y que con esa nieve
se pudiera hacer un muñeco. De la propuesta con tres intensidades (Sutil, Nochebuena y Postal) se
eligió **Nochebuena**: la paleta de Nocturne no cambia, porque la noche azul y el violeta ya son de
Nochebuena, y se añaden nieve, luces cálidas y detalles de temporada. Del catálogo de ideas se
eligieron los **gorros nuevos** y la **baraja de invierno**. En una segunda entrega (1.11.0) se
añadieron la **bola de nieve**, la **nieve en la portada**, el **consenso nevado** y el **cascabel al
revelar**. El resumen anual se queda fuera.

## Decisión

- **Temporada en el cliente.** Del 1 de diciembre al 6 de enero, los dos incluidos, con la fecha
  local de cada navegador (`isWinterSeason`, `shared/season/season.ts`). `App.tsx` pone
  `data-season="winter"` en `<html>`, igual que `data-theme`; los tokens de
  `design-system/tokens/season.css` y las piezas `.pp-winter-only` cuelgan de ese atributo.
  `?temporada=invierno` la fuerza fuera de fechas y `?temporada=no` la quita; se recuerda en
  `sessionStorage` para que la vista previa sobreviva a la navegación dentro de la app.
- **Nieve.** `Snowfall` (`design-system/`) pinta en un único lienzo que no recibe clics. Los copos
  cuajan en el borde de abajo de la escena de la mesa, justo encima de la mano, y en capas sobre los
  asientos (`data-snow-cap`), salvo por debajo de 640 px, donde los asientos ya se solapan. No sabe
  qué es una partida: solo mide elementos. La física vive aparte, en `snowScene.ts`, sin DOM.
- **Muñeco de cada uno, sin API.** Se arrastra sobre el montón para rodar una bola que crece con lo
  que recoge; tres bolas se apilan solas de mayor a menor. Lleva el sombrero de quien lo hace (o una
  chistera) y una bufanda del color de su avatar, y aparece como «⛄ Copito» en «Mirando desde la
  barrera», con un ✕ para derretirlo. Solo lo ve quien lo ha hecho y se pierde al recargar. Un muñeco
  compartido necesitaría decidir entre evento efímero (como los emojis: quien entra tarde no lo ve) o
  dato de la partida (como los sombreros, ADR 0017); se deja para cuando se vea si se usa.
- **Apagar la nieve.** Ajuste de sala `snow` («Nieve en la sala»), activado por defecto, que solo
  cambia quien puede cambiar el resto de ajustes, igual que «Fiesta». Es dato de `GameSettings`
  (migración `0011_games_snow`); el formulario solo lo enseña en temporada. Además, cada uno puede
  quitársela solo para sí con el botón ❄️ de la barra superior; se recuerda en `localStorage`.
- **Luces.** Una guirnalda en el borde de la mesa (`TableLights`): las bombillas de cada asiento se
  encienden cuando esa persona ha votado, titilan cuando ha votado la mesa entera y hacen una ola al
  revelar. Solo usan quién ha votado, que ya es público antes de revelar (invariante 7 intacta).
- **Gorros de temporada.** `santa`, `beanie`, `reindeer` y `elf` entran en el catálogo cerrado de
  sombreros (dominio, `HAT_IDS` y `HatIdView`; sin migración, como dice el ADR 0017). El dominio los
  acepta todo el año, porque no sabe de fechas; el selector los ofrece primero en temporada y fuera
  de ella solo enseña el que ya lleves puesto (`WINTER_HAT_IDS`).
- **Baraja de invierno y logo.** `Card` lleva un copo en el reverso, un copo pequeño en la esquina
  de las cartas de la mano y una ramita de acebo en la carta revelada; el `Logo` lleva nieve encima
  de la ficha. Los valores de las cartas no cambian.
- **Bola de nieve.** ❄️ abre la barra de lanzar en temporada si la sala no ha apagado la nieve. Viaja
  como un emoji más por `emoji_thrown`, que ya acepta cualquiera, así que no toca la API ni el ajuste
  «Emojis lanzados». `EmojiThrowLayer` la dibuja como bola blanca y deja un pegote sobre el asiento de
  destino que se escurre antes de que el lanzamiento se retire (2,5 s). No hay devolución automática.
- **Nieve en la portada.** `DemoTable` monta `Snowfall` sobre la mesa de ejemplo, con el mismo
  muñeco. Lee la preferencia «sin nieve» del navegador directamente: la portada no carga el store
  de la partida.
- **Consenso nevado y cascabel.** Con unanimidad y «Fiesta» activada, el confeti del panel de
  resultados pasa a copos dorados y blancos (`Confetti variant="snow"`). Al revelar suena un
  cascabel de trineo (`playSleighBellReveal`, solo osciladores) en vez del arpegio; respeta el
  silencio. Los dos dependen solo de la temporada, no del ajuste de nieve de la sala.
- **Movimiento reducido.** Con `prefers-reduced-motion` no caen copos y las luces no titilan; el
  suelo aparece ya nevado y el muñeco se puede hacer igual, porque solo se mueve cuando arrastras.
  Tampoco hay pegote de la bola de nieve ni copos de consenso.

## Consecuencias

- `GameSettingsView` y el esquema de ajustes ganan `snow` (por defecto `true`); las partidas que ya
  existen lo reciben activado por la migración.
- Las piezas de temporada están en el DOM todo el año y se ocultan por CSS: no hay que pasar la
  temporada por props a `Card` ni a `Logo`. Por eso no deben llevar clases de `display` de Tailwind
  encima, porque `display: revert` las desharía.
- Una sesión abierta que cruce la medianoche del 6 de enero no cambia hasta recargar.
- Una temporada nueva (por ejemplo, otra fecha) sería otro valor de `Season` con sus tokens y su
  rango de fechas, sin tocar los componentes que ya cuelgan de `data-season`.
