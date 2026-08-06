# 00 — Preparación del entorno de desarrollo

> Instrucciones para Claude Code. Este documento se ejecuta **antes** de escribir una sola línea de dominio.
> No avances al bloque siguiente hasta que la checklist de la §11 esté entera en verde.

---

## 1. Objetivo

Dejar el repositorio con: monorepo pnpm, TypeScript estricto, linter, formateador, tests, **barrera arquitectónica automatizada**, hooks de commit y un `docker compose up` que levante API y base de datos. Cero lógica de negocio en este bloque.

**Criterio de aceptación:** un `pnpm verify` en limpio pasa, y `docker compose up` deja la API respondiendo en `/health` contra un Postgres sano.

---

## 2. Prerrequisitos de la máquina

| Herramienta         | Versión    | Comprobación                                                 |
| ------------------- | ---------- | ------------------------------------------------------------ |
| Node                | 22 LTS     | `node -v`                                                    |
| pnpm                | 10.x       | `corepack enable && corepack prepare pnpm@latest --activate` |
| Docker + Compose v2 | reciente   | `docker compose version`                                     |
| Git                 | cualquiera | `git --version`                                              |

Si falta alguna, **para y avisa**. No instales nada a nivel de sistema sin preguntar.

Fija la versión de Node en el repo:

```
.nvmrc          →  22
package.json    →  "engines": { "node": ">=22", "pnpm": ">=10" }
```

---

## 3. Estructura inicial

```bash
mkdir -p apps/api/src apps/web/src packages/contracts/src docs/adr .github/workflows
git init
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

`package.json` raíz (privado, sin dependencias de producción):

```json
{
  "name": "planning-poker",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22", "pnpm": ">=10" },
  "scripts": {
    "dev": "docker compose up",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:unit": "pnpm --filter @pp/api test:unit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "pnpm -r typecheck",
    "arch": "depcruise apps/api/src --config .dependency-cruiser.cjs",
    "verify": "pnpm lint && pnpm typecheck && pnpm arch && pnpm test"
  }
}
```

`pnpm verify` es el comando que ejecutará también la CI. Si algo no está ahí dentro, no se valida.

Nombres de paquete: `@pp/api`, `@pp/web`, `@pp/contracts`.

---

## 4. TypeScript

`tsconfig.base.json` en la raíz:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

`noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` son incómodos al principio y evitan justo la clase de bug que aparece manejando mapas de votos. No los quites.

Cada workspace extiende de este base con su `outDir` y sus `paths`.

---

## 5. ESLint + Prettier

ESLint 9 con flat config (`eslint.config.js` en la raíz), `typescript-eslint` en modo `strictTypeChecked`, plus:

```js
rules: {
  '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/consistent-type-imports': 'error',
  'no-restricted-syntax': [
    'error',
    { selector: 'TSEnumDeclaration', message: 'Usa union types o clases de VO, no enums.' }
  ],
  'max-lines-per-function': ['warn', 40],
  'complexity': ['warn', 8]
}
```

Prettier con `printWidth: 100`, `singleQuote: true`, `semi: true`. `.editorconfig` acorde. Añade `eslint-config-prettier` al final de la cadena para que no peleen.

---

## 6. Vitest

Vitest en la raíz con proyectos por workspace. En `apps/api`, tres scripts separados porque tienen coste muy distinto:

```json
"test:unit":     "vitest run tests/domain tests/use-cases",
"test:contract": "vitest run tests/contract",
"test:e2e":      "vitest run tests/e2e",
"test":          "vitest run"
```

Cobertura con `@vitest/coverage-v8`. **Umbral obligatorio del 90% solo en `src/domain/**`**; el resto sin umbral. Poner un mínimo global invita a escribir tests de adaptadores sin valor para subir un número.

---

## 7. Barrera arquitectónica (lo más importante de este bloque)

`.dependency-cruiser.cjs`:

```js
module.exports = {
  forbidden: [
    {
      name: 'domain-no-depende-de-nada',
      severity: 'error',
      comment: 'El dominio no puede importar aplicación, infraestructura ni librerías externas.',
      from: { path: '^apps/api/src/domain' },
      to: {
        pathNot: '^apps/api/src/domain',
        // node: builtins prohibidos también; el dominio no lee ficheros ni fechas del sistema
      },
    },
    {
      name: 'application-no-depende-de-infra',
      severity: 'error',
      from: { path: '^apps/api/src/application' },
      to: { path: '^apps/api/src/infrastructure' },
    },
    {
      name: 'solo-main-cablea',
      severity: 'error',
      comment: 'Solo el composition root conoce las implementaciones concretas.',
      from: { pathNot: '^apps/api/src/main\\.ts$' },
      to: { path: '^apps/api/src/infrastructure/(persistence|realtime)/.+Repository|Broadcaster' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    { name: 'no-huerfanos', severity: 'warn', from: { orphan: true }, to: {} },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'apps/api/tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
  },
};
```

**Valida la regla antes de seguir:** crea un fichero temporal `apps/api/src/domain/__probe.ts` que haga `import { z } from 'zod'`, ejecuta `pnpm arch`, comprueba que **falla**, y bórralo. Una barrera que nunca has visto saltar no sabes si existe.

---

## 8. Hooks de commit y Conventional Commits

Los necesita el versionado automático del documento `03-ci-cd.md`. Sin commits convencionales no hay releases.

- `husky` + `lint-staged`: en `pre-commit`, ESLint y Prettier solo sobre lo staged.
- `commitlint` con `@commitlint/config-conventional` en `commit-msg`.
- Scopes permitidos: `domain`, `app`, `infra`, `web`, `contracts`, `ci`, `docker`, `deps`.

Ejemplos válidos: `feat(domain): añade invariante de espectador`, `fix(infra): corrige mapper de votos`.

En `pre-commit` **no** metas los tests: el hook debe tardar segundos o la gente usa `--no-verify`. Los tests son cosa de la CI.

---

## 9. Docker

`apps/api/Dockerfile` multi-stage con targets `development`, `build` y `production`:

- Base `node:22-alpine`, `corepack enable`.
- Capa de dependencias separada de la de código (copia `package.json` + `pnpm-lock.yaml`, `pnpm install --frozen-lockfile`, y solo después el código).
- `production`: `pnpm install --prod --frozen-lockfile`, usuario **no root** (`USER node`), sin devDependencies, `HEALTHCHECK` apuntando a `/health`.
- `.dockerignore` con `node_modules`, `dist`, `.git`, `tests`, `*.md`.

`docker-compose.yml` para desarrollo: el del documento `01-especificacion.md` §9.1, con `db` sano antes de arrancar `api` y bind mount del código para hot reload (`tsx watch`).

Sin servicio `redis` en el compose de v1 — no se usa con una sola instancia. Se añade cuando haga falta.

---

## 10. Configuración y secretos

`apps/api/src/infrastructure/config/env.ts`: esquema **zod** que valida `process.env` **al arrancar** y falla ruidosamente si falta algo. El resto del código nunca lee `process.env` directamente.

```
DATABASE_URL, PORT, NODE_ENV, CORS_ORIGIN, LOG_LEVEL, SESSION_SECRET
```

Crea `.env.example` con todas las claves y valores de ejemplo. `.env` va en `.gitignore`. Nunca commitees un secreto real, ni siquiera de desarrollo.

---

## 11. Checklist de salida del bloque

Ejecuta y confirma uno por uno:

- [ ] `pnpm install` termina sin warnings de peer dependencies
- [ ] `pnpm typecheck` verde
- [ ] `pnpm lint` verde
- [ ] `pnpm arch` verde **y** falla con el fichero sonda de la §7
- [ ] `pnpm test` verde (con un test trivial de humo)
- [ ] `pnpm verify` verde de una tacada
- [ ] `docker compose up` levanta `api` y `db`; `curl localhost:3000/health` devuelve 200
- [ ] `curl localhost:3000/ready` devuelve 200 y 503 si paras el contenedor `db`
- [ ] Un commit con mensaje mal formado es rechazado por commitlint
- [ ] `git log` limpio, sin `.env` ni `node_modules` versionados

---

## 12. Reglas permanentes para el resto del proyecto

Aplican a todos los bloques posteriores; no vuelvas a preguntarlas.

1. **Nada de framework en `domain/`.** Ni zod, ni Fastify, ni el driver de Postgres, ni `Date.now()`. El tiempo entra por el puerto `Clock`.
2. **Sin `any`, sin `as` para silenciar el compilador.** Si el tipo no cuadra, el modelo está mal.
3. **Los casos de uso no deciden negocio.** Cargan el agregado, invocan un método, persisten, publican. Si aparece un `if` de reglas, va al agregado.
4. **Un test por invariante**, con nombre que describa la regla, no el método: `no permite votar a un espectador`, no `castVote throws`.
5. **Sin comentarios que expliquen qué hace el código.** Comentarios solo para el porqué de una decisión no obvia.
6. **Nombres del dominio en el dominio.** `revelar`/`reveal`, `facilitador`, `ronda`: elige un idioma y mantenlo. Recomendado: código en inglés, ubiquitous language documentado en `docs/adr`.
7. **Toda decisión estructural genera un ADR** en `docs/adr/NNNN-titulo.md` (contexto, decisión, consecuencias). Corto: media página.
8. **Nunca commitees directamente a `main`.** Rama por bloque, PR, CI en verde.
