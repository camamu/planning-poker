# apps/web — reglas de dependencia

Versión operativa y corta. El porqué y el detalle completo están en `docs/05-estructura-frontend.md` — no lo dupliques aquí ni lo resumas de más; si algo no está claro con esto, lee ese documento antes de suponer.

No hay tooling instalado todavía (Vite/React/Tailwind/Zustand llegan en el bloque 6, ver `docs/02-decisiones-y-plan.md` §5). Lo que existe ahora es solo el esqueleto de carpetas.

## Las tres carpetas y su regla de dependencia

```
design-system/  →  no importa nada de features/ ni de shared/
features/       →  puede importar design-system/ y shared/
shared/         →  no importa nada de features/
```

Es la misma frontera que `domain/` en el backend, aplicada al frontend: `design-system/` son piezas puras (un `Button` no sabe qué es una partida), `features/` conecta esas piezas con datos reales, `shared/` es el equivalente a infraestructura (cliente REST, socket, store). Enforced por las mismas reglas `design-system-no-depende-de-features` y `shared-no-depende-de-features` en `.dependency-cruiser.cjs`, verificadas con `pnpm arch` igual que el backend.

## Por qué la frontera importa aquí en concreto

El diseño llega por handoff desde Claude Design, no lo escribís vosotros. El handoff **solo toca `design-system/`** — nunca `features/`, nunca `shared/`. Si se mezclan, cada iteración de diseño arriesga con pisar lógica de negocio o al revés.

## Qué NO hacer

- No metáis lógica de negocio dentro de `design-system/components` (ej. "¿está revelada la ronda?").
- No dupliquéis tipos: `CardValue`, eventos de socket y DTOs de vista viven en `packages/contracts`; el front los importa, no los redefine.
- No pongáis estado de partida en `features/`: un único `gameStore` en `shared/store/` que todas las features leen.

## Handoff de diseño

`/design-sync` desde Claude Code sincroniza `design-system/` con Claude Design en ambos sentidos. Detalle completo del flujo en `docs/04-brief-diseno.md` §7 y `docs/05-estructura-frontend.md` §4.

Si el handoff trae algo fuera de `design-system/`, no lo aceptes tal cual: sepáralo antes de integrarlo.
