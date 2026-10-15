# 0016 — Logo: ficha y carta ("Apuesta")

## Contexto

La app no tenía marca: la barra superior pintaba una carta contorneada con un "8" en CSS y no había
favicon. Se exploraron trece propuestas (cartas, mesa, icono, varias fichas) y el equipo eligió
"Apuesta": una ficha de póker con una carta apoyada delante, porque votar una estimación es apostar.

## Decisión

- **Componente `Logo` en `design-system/`**, sin conocimiento de negocio. Pinta la marca sola (sin
  el nombre) y tiene dos niveles de detalle: desde 24 px muescas en el canto y un "8" en la carta;
  por debajo, ficha lisa con hueco y carta sin número, porque el detalle se emborrona.
- **Recortes con `mask`, no trazos del color del fondo.** Muescas, hueco central, separación entre
  ficha y carta y el "8" son transparentes, así que el logo sirve sobre `--color-surface`, sobre la
  mesa o en una pestaña del navegador sin recibir el fondo como prop. Los ids de máscara salen de
  `useId` para que dos logos en la misma página no colisionen.
- **Un segundo color solo para la marca: `--pp-brand-warm`** (ámbar `#f2b86b`, `#f0a84f` en
  claro). Nocturne mantiene un único acento en la interfaz; este token no se usa fuera del logo.
- **El nombre se queda en Inter**: el lockup con Bricolage Grotesque que se exploró no se usa en la
  app, así que no se carga una segunda tipografía.
- **`apps/web/public/favicon.svg`**: la versión simple con colores fijos (un SVG de favicon no lee
  las variables CSS de la página).

## Consecuencias

- La `TopBar` usa `<Logo size={32} />` en lugar de la carta de CSS (`docs/06-handoff-diseno.md`
  describía la carta de 22×30 rotada −8°; queda sustituida por este ADR).
- Si algún día hace falta el logo con nombre (landing, README), es una composición en `features/`
  con `Logo` + texto, no una variante del componente.
- Un favicon PNG o `apple-touch-icon` para navegadores sin SVG queda fuera; se añadirá si alguien lo
  echa de menos.
