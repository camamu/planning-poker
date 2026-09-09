# 03 — CI/CD con GitHub Actions

> Instrucciones para Claude Code. Depende del bloque `00-setup-entorno.md` (necesita `pnpm verify` y commits convencionales).
> Se implementa en el bloque 1 del plan, no al final: una CI que llega en el bloque 9 no ha protegido nada.

---

## 1. Qué resuelve cada workflow

| Fichero         | Dispara                                    | Responsabilidad                                                                                            |
| --------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `ci.yml`        | `pull_request` y `push` a `develop`/`main` | Validar el código: lint, tipos, arquitectura, tests, build de imágenes                                     |
| `pr-title.yml`  | `pull_request` (título editado)            | Que el título de la PR sea convencional — es lo que acaba en el changelog al hacer squash                  |
| `release.yml`   | `push` a `main`                            | Calcular versión, generar changelog, crear tag y release                                                   |
| `publish.yml`   | `release: published`                       | Construir y publicar imágenes Docker en GHCR con la versión                                                |
| `deploy.yml`    | manual, elige un tag                       | Migrar la BD y decirle a Render qué imagen desplegar; el front en Cloudflare Pages va en el mismo workflow |
| `heartbeat.yml` | `schedule` diario + manual                 | Hacer una consulta trivial a Supabase para que no pause el proyecto por inactividad                        |

Separar release de publish importa: la versión se decide una vez y las imágenes se construyen a partir de un tag inmutable, no de "lo que hubiera en main en ese momento".

`release.yml` solo dispara con `push` a `main`, y a `main` solo llega código por el merge de `develop` (ver §7): cada release es, literalmente, "lo que hay acumulado en `develop`" en el momento de mergear.

> **Nota:** este documento asumía originalmente un VPS con Dokploy. Tras el cambio a Render + Cloudflare Pages + Supabase (ver `06-despliegue.md`), solo cambia el §6 (`deploy.yml`) y se añade el §6.2 (`heartbeat.yml`); el resto — `ci.yml`, `pr-title.yml`, `release.yml`, `publish.yml` — sigue exactamente igual, porque siguen sin saber nada de dónde se despliega.

---

## 2. `ci.yml` — validación de PRs

Requisitos de diseño:

- **Cancelar ejecuciones antiguas** de la misma rama (`concurrency` con `cancel-in-progress`), o cada push encola trabajo muerto.
- **Cachear pnpm** por hash del lockfile.
- **Un job por tipo de coste.** Los tests unitarios de dominio no necesitan Postgres y deben dar feedback en menos de un minuto; los de contrato sí lo necesitan.
- **`fail-fast` desactivado** entre jobs independientes: quieres ver lint y tests fallando a la vez, no de uno en uno.

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [develop, main]

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '22'

jobs:
  quality:
    name: Lint · Tipos · Arquitectura
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - name: Barrera arquitectónica
        run: pnpm arch

  unit:
    name: Tests de dominio y casos de uso
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @pp/api test:unit -- --coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-domain
          path: apps/api/coverage

  contract:
    name: Tests de contrato (Postgres real)
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: planningpoker_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/planningpoker_test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @pp/api migrate:up
      - run: pnpm --filter @pp/api test:contract

  e2e:
    name: E2E sobre el stack real
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d --build
      - name: Esperar a que la API esté lista
        run: timeout 90s bash -c 'until curl -sf localhost:3000/ready; do sleep 2; done'
      - run: docker compose exec -T api pnpm test:e2e
      - name: Logs si falla
        if: failure()
        run: docker compose logs --no-color
      - if: always()
        run: docker compose down -v

  docker-build:
    name: Build de imágenes (sin publicar)
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [api, web]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/${{ matrix.app }}/Dockerfile
          target: production
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Test e2e obligatorio en esta suite:** el que verifica la invariante 7. Conecta dos clientes WebSocket, uno vota, y el segundo comprueba que en el payload **crudo** que recibe no aparece el valor de la carta ajena antes del reveal. Es la única regla del sistema cuyo fallo es invisible en la UI y grave.

---

## 3. `pr-title.yml`

Con merges por squash, el título de la PR es el mensaje de commit que llega a `develop` — y de ahí, al mergear `develop` en `main` para una release, lo que lee el versionado. Validarlo:

```yaml
name: PR title
on:
  pull_request:
    types: [opened, edited, synchronize]
permissions:
  pull-requests: read
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          types: feat,fix,docs,refactor,perf,test,build,ci,chore,revert
          scopes: domain,app,infra,web,contracts,ci,docker,deps
```

Configura el repositorio con **squash merge como única opción** y "usar el título de la PR" como mensaje por defecto.

---

## 4. `release.yml` — versionado automático

**Herramienta: `release-please`.** Frente a `semantic-release`, no publica en cada push: abre una **PR de release** con el `CHANGELOG.md` y el bump de versión ya calculados, y la release solo ocurre cuando la mergeas. Para una herramienta interna que despliega a un único VPS, esa pausa vale mucho: decides tú cuándo hay versión nueva.

Reglas de bump, derivadas de los commits desde el último tag:

| Commits                                    | Bump                  |
| ------------------------------------------ | --------------------- |
| `fix:`                                     | patch (0.1.0 → 0.1.1) |
| `feat:`                                    | minor (0.1.0 → 0.2.0) |
| `feat!:` o `BREAKING CHANGE:` en el cuerpo | major                 |
| `docs:`, `chore:`, `ci:`, `test:`          | ninguno               |

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          release-type: node
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
    outputs:
      released: ${{ steps.release.outputs.release_created }}
      tag: ${{ steps.release.outputs.tag_name }}
```

`release-please-config.json`: **versiona el repositorio entero como una unidad** (`"separate-pull-requests": false`, un solo componente raíz). API y front se despliegan juntos y comparten el contrato de `packages/contracts`; versionarlos por separado solo crearía matrices de compatibilidad que nadie va a mantener.

Arranca el manifiesto en `0.1.0`. No pases a `1.0.0` hasta que el equipo lo use en un sprint real.

---

## 5. `publish.yml` — imágenes Docker versionadas

```yaml
name: Publish images

on:
  release:
    types: [published]
  workflow_dispatch:

permissions:
  contents: read
  packages: write

jobs:
  publish:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [api, web]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/${{ matrix.app }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,format=long
            type=raw,value=latest,enable={{is_default_branch}}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/${{ matrix.app }}/Dockerfile
          target: production
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: APP_VERSION=${{ github.event.release.tag_name }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

GHCR es gratis para repos privados dentro de la cuota de la cuenta y no requiere registro externo. La etiqueta `sha` permite rastrear cualquier imagen desplegada hasta su commit exacto.

Inyecta `APP_VERSION` en la imagen y expónla en `/health`. Cuando alguien diga "en producción no funciona", lo primero que quieres saber es qué versión hay corriendo.

---

## 6. Despliegue: `deploy.yml` y `heartbeat.yml`

Detalle completo de la arquitectura de hosting (Render + Cloudflare Pages + Supabase) en `06-despliegue.md`. Aquí solo los workflows.

### 6.1 `deploy.yml` — migraciones, API en Render, front en Cloudflare Pages

Sigue **manual** (`workflow_dispatch` con input de tag): un despliegue automático en cada release, con el equipo en mitad de una sesión de estimación, corta la partida.

Render, para servicios que despliegan una imagen ya construida, expone un **deploy hook** por servicio: una URL secreta a la que le añades `?imgURL=<imagen>:<tag>` para decirle exactamente qué versión pulear, sin necesidad de API key. Es casi el mismo mecanismo que teníamos con el webhook de Dokploy.

Tres jobs encadenados, porque el orden importa: migrar → desplegar la API → publicar el front.

```yaml
name: Deploy

on:
  workflow_dispatch:
    inputs:
      tag:
        description: 'Versión a desplegar (ej. v0.3.0)'
        required: true

permissions:
  contents: read

env:
  PNPM_VERSION: '10'

jobs:
  migrate:
    name: Migraciones contra Supabase
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
        with: { ref: '${{ inputs.tag }}' }
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      # Render solo arranca una imagen: si las migraciones no se aplican aquí, nadie lo hace.
      - name: Aplicar migraciones pendientes
        env:
          DATABASE_URL: ${{ secrets.SUPABASE_DATABASE_URL }}
        run: pnpm --filter @pp/api migrate:up

  deploy-api:
    name: API en Render
    runs-on: ubuntu-latest
    needs: migrate
    environment: production # exige aprobación manual si la configuras así
    steps:
      - name: Disparar despliegue en Render con la imagen versionada
        env:
          TAG: ${{ inputs.tag }}
          HOOK_URL: ${{ secrets.RENDER_DEPLOY_HOOK_URL }}
        run: |
          # publish.yml etiqueta con `{{version}}` de docker/metadata-action, que quita la `v` inicial:
          # el tag de entrada es v0.3.0 y la imagen publicada es :0.3.0.
          image_tag="${TAG#v}"
          curl -fsSL -G "$HOOK_URL" \
            --data-urlencode "imgURL=ghcr.io/${{ github.repository }}/api:${image_tag}"
      # Sin esta verificación, un despliegue fallido queda en verde. `APP_VERSION` se inyecta en
      # publish.yml con el tag de la release, así que /health devuelve el tag con la `v`.
      - name: Verificar versión desplegada
        env:
          TAG: ${{ inputs.tag }}
          API_HOST: ${{ vars.API_HOST }}
        run: |
          # El plan gratuito de Render arranca en frío: se espera a que responda, no un rato fijo.
          timeout 300 bash -c 'until curl -sf "https://$API_HOST/health" | grep -q "$TAG"; do sleep 10; done'

  deploy-web:
    name: Front en Cloudflare Pages
    runs-on: ubuntu-latest
    # A propósito: si la API falla, no publiques un front que hablaría con una versión vieja del contrato.
    needs: deploy-api
    environment: production
    steps:
      - uses: actions/checkout@v4
        with: { ref: '${{ inputs.tag }}' }
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      # Vite congela las VITE_* en el bundle: definirlas en el dashboard de Cloudflare no tendría
      # efecto, porque allí llega `dist/` ya construido.
      - name: Construir el front contra la API de producción
        env:
          VITE_API_URL: https://${{ vars.API_HOST }}
          VITE_WS_URL: https://${{ vars.API_HOST }}
        run: pnpm --filter @pp/web build
      - name: Publicar en Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy apps/web/dist --project-name=planning-poker
```

Cuatro detalles que no son adorno:

- **El tag de la imagen pierde la `v`.** `publish.yml` etiqueta con `type=semver,pattern={{version}}`, que publica `…/api:0.3.0`; pedirle a Render `…/api:v0.3.0` sería pedirle una imagen que no existe. El `/health`, en cambio, sí devuelve el tag con `v`: `APP_VERSION` se inyecta con `github.event.release.tag_name` tal cual.
- **La verificación espera en bucle, no `sleep 40`.** El plan gratuito de Render arranca en frío y un tiempo fijo deja en rojo despliegues que solo eran lentos. Lo que no puede pasar es que no haya verificación: sin ella un despliegue fallido queda en verde.
- **`VITE_API_URL`/`VITE_WS_URL` se definen en el paso de build**, no en el dashboard de Cloudflare: Vite las congela en el bundle y a Cloudflare llega `dist/` ya construido.
- **`deploy-web` depende de `deploy-api`** (`needs:`) a propósito: si la API falla, no publiques un front que hablaría con una versión vieja del contrato.

Si el repositorio de imágenes es privado (lo normal en GHCR), Render necesita credenciales de ese registro configuradas una vez en el dashboard del servicio — no en este workflow.

### 6.2 `heartbeat.yml` — que Supabase no pause el proyecto

El free tier de Supabase pausa un proyecto tras 7 días sin peticiones a la API. El equipo se reúne cada dos semanas, así que sin esto la base de datos estaría dormida en cada sprint. Basta una consulta trivial diaria:

```yaml
name: Supabase heartbeat

on:
  schedule:
    # Diario, a una hora suelta y no en punto, para no competir con el resto de crons de GitHub.
    - cron: '17 6 * * *'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  ping:
    name: Consulta trivial contra Supabase
    runs-on: ubuntu-latest
    steps:
      - name: Instalar psql si el runner no lo trae
        run: command -v psql || (sudo apt-get update && sudo apt-get install -y postgresql-client)
      # El free tier de Supabase pausa el proyecto tras 7 días sin peticiones y el equipo se reúne
      # cada dos semanas: sin esto, la BD estaría dormida en cada sprint.
      - name: Resetear el contador de inactividad
        env:
          DATABASE_URL: ${{ secrets.SUPABASE_DATABASE_URL }}
        run: psql "$DATABASE_URL" -c 'select 1;'
```

`SUPABASE_DATABASE_URL` puede ser el mismo connection string que usa la API en producción; no hace falta un usuario aparte para esto en un proyecto interno.

---

## 7. Protección de ramas y flujo de trabajo

Git-flow simplificado, dos ramas largas:

- **`develop`** es la rama de integración. Todo bloque del plan nace de `develop` actualizado y su PR se mergea **contra `develop`**.
- **`main`** solo se mueve por releases: cuando `develop` está en un punto que se quiere publicar, se mergea `develop` → `main` y ese `push` a `main` es lo que dispara `release.yml` (§4). Nunca se rama directamente desde `main`, y nunca se le hace push salvo ese merge de release.

El flujo por bloque es **una rama y una PR por bloque del plan**. Nada llega a `develop` sin pasar por ahí, y nada llega a `main` salvo el merge de `develop` para una release.

### 7.1 Reglas de la rama

Configúralo con un **Ruleset** (Settings → Rules → Rulesets; sustituye a la protección clásica) aplicado a **`develop` y `main`**:

- Prohibido el push directo a `develop` y a `main`, incluidos administradores (la única excepción real es el merge `develop` → `main` para cortar una release, que también pasa por PR).
- **PR obligatoria, con 0 aprobaciones requeridas.**
- Checks requeridos: `quality`, `unit`, `contract`, `e2e`, `docker-build`, `pr-title`.
- Ramas actualizadas antes de mergear.
- Solo squash merge en las PRs de bloque contra `develop`, con el título de la PR como mensaje.
- Conversaciones resueltas antes del merge.

**Por qué 0 aprobaciones:** GitHub no permite aprobar tu propia PR. Con 1 aprobación requerida y un solo mantenedor, toda PR queda bloqueada para siempre. Con 0, la PR sigue siendo obligatoria, los checks siguen siendo bloqueantes y tú decides cuándo mergear — que es justo el control que buscas. Cuando entre otra persona al repo, subes el número a 1 y ya está.

### 7.2 Cómo abre las PRs Claude Code

Para cada bloque del plan:

1. `git switch -c feat/NN-nombre-del-bloque` desde `develop` actualizado.
2. Commits convencionales pequeños, uno por unidad de trabajo coherente.
3. `gh pr create --draft --base develop` **al empezar**, no al terminar: así ves la CI corriendo mientras se construye.
4. Cuando la checklist del bloque esté completa, `gh pr ready`.
5. **Claude Code nunca mergea.** Deja la PR lista y para. El merge es tuyo. Tampoco mergea `develop` en `main`: cortar una release es una decisión humana.

Si un bloque crece más de ~600 líneas de diff, pártelo. Una PR que no puedes revisar en una sentada no la estás revisando.

### 7.3 Plantilla de PR

`.github/pull_request_template.md`:

```markdown
## Qué hace

<!-- Una frase. Si necesitas tres, probablemente sean tres PRs. -->

## Bloque del plan

Bloque N — <nombre>

## Decisiones tomadas

<!-- Cualquier cosa que sorprenda al leer el diff. Si hay ADR, enlázalo. -->

## Checklist

- [ ] `pnpm verify` verde en local
- [ ] Invariantes nuevas cubiertas por test con nombre descriptivo
- [ ] Sin `any` ni `as` añadidos
- [ ] `domain/` sigue sin importar framework
- [ ] ADR creado si hay decisión estructural

## Cómo probarlo

<!-- Pasos concretos, no "levantar el compose". -->
```

### 7.4 Cosas que ayudan sin estorbar

- **Auto-merge** (`gh pr merge --auto --squash`) para las PRs que ya has revisado: mergea sola en cuanto la CI acabe, sin que estés esperando.
- **Labels por bloque** (`bloque-2`, `dominio`, `infra`) para filtrar el histórico luego.
- **PRs apiladas** solo si es imprescindible: si el bloque 3 depende del 2 sin mergear, abre la PR del 3 contra la rama del 2 (no contra `develop`) y cambia la base a `develop` al mergear. Es incómodo; mejor mergear el 2 primero.

---

## 8. Higiene

- **Dependabot** (`.github/dependabot.yml`) semanal para `npm`, `docker` y `github-actions`, agrupando parches en una sola PR.
- **Fija las actions por versión mayor** (`@v4`); para las de terceros que tocan secretos, considera fijar por SHA.
- `permissions` **explícitos y mínimos** en cada workflow. Por defecto, `contents: read`.
- `GITHUB_TOKEN` es suficiente para `ci.yml`, `pr-title.yml`, `release.yml` y `publish.yml`; no crees PATs salvo que aparezca una necesidad concreta.
- Secretos de despliegue, todos en Settings → Secrets del repositorio, nunca en el YAML: `RENDER_DEPLOY_HOOK_URL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_DATABASE_URL`. Variables no sensibles (`API_HOST`, el dominio de Render sin esquema) van en Settings → Variables, no en Secrets.

---

## 9. Checklist de salida

- [ ] Una PR con un `console.log` suelto es bloqueada por `quality`
- [ ] Una PR que importe zod dentro de `domain/` es bloqueada por `arch`
- [ ] Una PR con título `arreglos varios` es bloqueada por `pr-title`
- [ ] Un merge con `feat(domain): ...` abre PR de release con bump minor y changelog
- [ ] Mergear esa PR crea el tag y publica las imágenes en GHCR
- [ ] `/health` de la imagen publicada devuelve la versión del tag
- [ ] Los checks aparecen como requeridos en el ruleset de `develop` y de `main`
- [ ] Puedes mergear tu propia PR sin que GitHub pida una aprobación ajena
- [ ] Un push directo a `develop` es rechazado
- [ ] Un push directo a `main` es rechazado salvo el merge `develop` → `main` de una release
- [ ] `heartbeat.yml` lanzado a mano (`workflow_dispatch`) termina en verde
- [ ] Un `deploy.yml` a un tag real aplica las migraciones, y `/health` de la API y el front en Cloudflare Pages coinciden en versión
