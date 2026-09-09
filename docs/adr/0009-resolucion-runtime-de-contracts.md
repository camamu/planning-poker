# 0009 — Resolución en runtime de `@pp/contracts`: `exports` condicional

## Contexto

`packages/contracts/package.json` apuntaba `main`/`types` a `./src/index.ts` a propósito
(ver ADR `0002`/`0007`): así `apps/api` y `apps/web` importan `@pp/contracts` sin necesitar un
build previo, tanto en tests (`vitest`, sobre Vite) como en `pnpm dev` (`tsx watch`). El precio de
esa elección es que Node, en producción, resuelve el mismo `main` — y un `.ts` crudo no es un
módulo ES válido para el `node` de la imagen `production`.

El smoke test añadido a `ci.yml` (ver `03-ci-cd.md` §2.1) lo detectó justo después de que
`fix/api-dockerfile-workspace-node-modules` (#14) corrigiera el bug de `node_modules` que
crasheaba `@fastify/cors` en Render: con ese fix aplicado, el contenedor `production` seguía sin
levantar, ahora con `Cannot find package '.../node_modules/@pp/contracts/src/index.ts'` —
exactamente la clase de bug para la que se construyó el smoke test.

## Decisión

`packages/contracts/package.json` pasa a `exports` condicional en vez de un `main` fijo:

```json
"main": "./dist/index.js",
"types": "./dist/index.d.ts",
"exports": {
  ".": {
    "development": "./src/index.ts",
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  }
}
```

Vite/Vitest (>=5, aquí Vite 8) resuelven automáticamente la condición especial
`development|production` según el modo (`serve`/`test` → `development`; `build` → `production`),
así que `apps/web` y los tests de ambos workspaces siguen leyendo `src/index.ts` sin build previo,
sin tocar `vite.config.ts` ni `vitest.config.ts`. `tsx` (usado por `pnpm --filter @pp/api dev`)
también respeta esa condición — verificado con `import.meta.resolve('@pp/contracts')` antes de
aplicar el cambio: resuelve a `src/index.ts` bajo `tsx`, a `dist/index.js` bajo `node` plano, sin
ninguna flag `--conditions` explícita. El `node` de la imagen `production` no declara esa
condición, así que cae a `default` → `dist/index.js`, que el Dockerfile ya construye
(`pnpm --filter @pp/contracts build` en el stage `build`).

Los `paths` de `apps/api/tsconfig.json`/`apps/web/tsconfig.json` (alias a `src/index.ts`, para
type-checking) y de `apps/api/tsconfig.build.json` (alias a `dist/index.d.ts`, para el build real)
no cambian — son un mecanismo aparte, de TypeScript, no de resolución de módulos en runtime.

## Consecuencias

- El smoke test de `apps/api` (`ci.yml`) pasa a validar el arranque real de la imagen
  `production` sin depender de que nadie recuerde construir `packages/contracts` antes.
- Cualquier paquete interno futuro que use este mismo patrón (`src/index.ts` para dev, `dist/`
  para producción) debe usar `exports` condicional igual que `@pp/contracts`, no un `main` fijo.
- Si algún día se sustituye Vite por otra herramienta de build, hay que confirmar que también
  soporta la condición `development|production` — si no, `apps/web`/`apps/api` en dev volverían a
  necesitar `packages/contracts/dist` construido de antemano.
