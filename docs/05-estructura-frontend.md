# 05 — Estructura de `apps/web` y del diseño en el repo

> Para Claude Code, se usa a partir del bloque 6 (frontend) del plan, pero el esqueleto de carpetas se crea ya, en el bloque 1, junto al resto de `apps/`.
> Este documento explica el "por qué" para quien viene del backend. La versión operativa y corta de estas reglas, la que Claude Code carga automáticamente al tocar `apps/web/`, vive en `apps/web/CLAUDE.md` — ese fichero remite aquí para el detalle, no lo dupliques.

---

## 1. La idea central, explicada con lo que ya conoces

En el backend separasteis dominio de infraestructura para que el negocio no dependiera de Fastify ni de Postgres. En el frontend hay una separación equivalente, con otros nombres:

| Backend                       | Frontend                      | Qué es                                                                                                                |
| ----------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `domain/`                     | `design-system/`              | Piezas puras. Un `Button` no sabe qué es una partida, igual que `CardValue` no sabe qué es HTTP                       |
| `application/` (casos de uso) | `features/`                   | Conectan las piezas puras con datos reales: "la mesa de votación usa `Card` y la rellena con el estado de la partida" |
| `infrastructure/` (repos, WS) | `shared/api`, `shared/socket` | Habla con el mundo exterior: el cliente REST, el socket, el store                                                     |
| `packages/contracts`          | (el mismo)                    | Los tipos de eventos y DTOs, compartidos tal cual por API y web                                                       |

La regla que ya aplicáis en `domain/` — "no importa nada de fuera" — se traduce aquí en: **`design-system/` no importa nada de `features/`**. Un botón no puede saber que existe una partida. Si algún día cambiáis el ritual de estimación pero no el estilo visual, no tocáis `design-system/`; si cambiáis el estilo pero no el ritual, no tocáis `features/`. Es la misma ganancia que ya conocéis, aplicada al otro lado.

---

## 2. Por qué esto importa especialmente aquí

Porque el diseño **no lo escribís vosotros**: lo genera Claude Design y llega por handoff. Si el diseño y la lógica de negocio están mezclados en las mismas carpetas, cada vez que iteréis el diseño (que pasará muchas veces — es lo normal en ese flujo) arriesgáis con pisar código de negocio, o al revés, que un cambio de lógica rompa por accidente el diseño.

Con la frontera puesta, el handoff de Claude Design **solo toca `design-system/`**. Nunca `features/`, nunca `shared/`. Eso convierte "voy a repetir el diseño de la mesa" en una operación segura en vez de en un merge conflictivo.

---

## 3. Árbol de carpetas

```
apps/web/
├── Dockerfile
├── vite.config.ts
├── tailwind.config.ts
├── index.html
├── public/
├── tests/
└── src/
    ├── main.tsx                    # composition root del front: monta App, provee el store
    ├── app/
    │   ├── App.tsx
    │   └── routes.tsx               # qué URL muestra qué feature
    │
    ├── design-system/               # ← AQUÍ ATERRIZA EL HANDOFF DE CLAUDE DESIGN
    │   ├── tokens/
    │   │   ├── colors.css           # custom properties, modo claro/oscuro
    │   │   ├── spacing.ts
    │   │   └── typography.ts
    │   ├── components/
    │   │   ├── Card/                # la carta de estimación — el componente más importante
    │   │   │   ├── Card.tsx
    │   │   │   ├── Card.test.tsx
    │   │   │   └── Card.stories.tsx
    │   │   ├── Avatar/
    │   │   ├── Button/
    │   │   ├── Badge/
    │   │   ├── Modal/
    │   │   └── ...
    │   └── index.ts                 # única puerta de entrada: `import { Card, Button } from '@/design-system'`
    │
    ├── features/                    # una carpeta por pantalla del brief (04-brief-diseno.md §5)
    │   ├── game-table/               # F1: mesa de votación
    │   │   ├── GameTablePage.tsx
    │   │   ├── components/           # compone piezas de design-system, específicas de esta pantalla
    │   │   │   ├── VotingCardGrid.tsx
    │   │   │   └── ParticipantSeat.tsx
    │   │   └── hooks/
    │   │       └── useGameTable.ts   # conecta con shared/socket y shared/store
    │   ├── join-game/
    │   ├── create-game/
    │   ├── issue-list/
    │   ├── results-panel/
    │   └── deck-settings/
    │
    ├── shared/                      # equivalente a vuestra infraestructura
    │   ├── api/
    │   │   └── gamesClient.ts        # fetch tipado con packages/contracts
    │   ├── socket/
    │   │   ├── connection.ts
    │   │   └── gameEventsReducer.ts  # traduce eventos del contrato a cambios de estado
    │   ├── store/
    │   │   └── gameStore.ts          # zustand, un único store de partida
    │   └── viewer/
    │       └── ParticipantIdProvider.tsx
    │
    └── styles/
        └── globals.css               # tailwind base + import de tokens
```

### 3.1 Reglas de dependencia (la barrera equivalente a `pnpm arch`)

```
design-system/  →  no importa nada de features/ ni de shared/
features/       →  puede importar design-system/ y shared/
shared/         →  no importa nada de features/
```

Añadidlo también a `.dependency-cruiser.cjs`, en la misma regla que ya protege `domain/`:

```js
{
  name: 'design-system-no-depende-de-features',
  severity: 'error',
  from: { path: '^apps/web/src/design-system' },
  to: { path: '^apps/web/src/(features|shared)' }
}
```

Así el mismo `pnpm arch` que ya usáis en el backend protege también el frontend, y el fallo se ve en la misma CI.

---

## 4. Cómo entra el diseño exactamente

1. En Claude Design tenéis el sistema de diseño (paleta, tipografía, componentes) y las pantallas, construidos siguiendo `04-brief-diseno.md`.
2. Al hacer **handoff a Claude Code**, ese bundle se traduce a código y aterriza en `design-system/tokens/` y `design-system/components/`. Nada más.
3. Si más adelante cambiáis algo en Claude Design y queréis traerlo de vuelta, `/design-sync` desde Claude Code vuelve a sincronizar solo esa carpeta.
4. `features/` la escribís vosotros (o se la pedís a Claude Code) importando de `design-system/`, nunca al revés. Ahí es donde vive el conocimiento de "cómo funciona una partida", que Claude Design no tiene ni necesita tener.

Ejemplo de esa frontera en código:

```tsx
// features/game-table/components/VotingCardGrid.tsx
import { Card } from '@/design-system'; // pieza pura, no sabe qué es una partida
import { useGameTable } from '../hooks/useGameTable'; // conocimiento del dominio del front

export function VotingCardGrid() {
  const { deck, myVote, castVote } = useGameTable();
  return (
    <div className="flex gap-2">
      {deck.cards.map((card) => (
        <Card
          key={card.raw}
          label={card.raw}
          selected={myVote === card.raw}
          onClick={() => castVote(card.raw)}
        />
      ))}
    </div>
  );
}
```

`Card` no sabe qué es votar. `VotingCardGrid` sí. Esa línea es la misma que separáis en el backend entre agregado y caso de uso.

---

## 5. Qué NO hacer

- **No metáis lógica de negocio dentro de `design-system/components`.** Si un componente de diseño empieza a preguntar "¿está revelada la ronda?", se ha escapado del cajón que le toca — igual que un `if` de negocio escapado a `application/` en el backend.
- **No dupliquéis tipos.** El `CardValue`, los eventos de socket y los DTOs de vista ya están en `packages/contracts`; el front los importa, no los redefine. Si redefinís `interface GameView` a mano en el front, en cuanto cambie el backend se desincroniza sin que nadie se entere hasta producción.
- **No pongáis el store dentro de `features/`.** Un único `gameStore` en `shared/` que todas las features leen; si cada feature tuviera su propio estado de la partida, tendríais tres versiones de "quién ha votado" desincronizadas.

---

## 6. Orden de trabajo sugerido

Encaja con el bloque 6 del plan (`02-decisiones-y-plan.md`):

1. Crear el esqueleto de carpetas (esto, ya, aunque estén vacías) — bloque 1.
2. Terminar el diseño en Claude Design siguiendo `04-brief-diseno.md`.
3. Handoff → aterriza en `design-system/`.
4. Revisar que `pnpm arch` sigue en verde con el bundle recién llegado.
5. Construir `features/game-table` primero — es la pantalla que ejercita el store, el socket y el design-system a la vez, y si funciona, el resto es repetir el patrón.
