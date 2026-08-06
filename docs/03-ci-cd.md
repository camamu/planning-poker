# 03 — CI/CD con GitHub Actions

> Instrucciones para Claude Code. Depende del bloque `00-setup-entorno.md` (necesita `pnpm verify` y commits convencionales).
> Se implementa en el bloque 1 del plan, no al final: una CI que llega en el bloque 9 no ha protegido nada.

---

## 1. Qué resuelve cada workflow

| Fichero        | Dispara                          | Responsabilidad                                                                           |
| -------------- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| `ci.yml`       | `pull_request` y `push` a `main` | Validar el código: lint, tipos, arquitectura, tests, build de imágenes                    |
| `pr-title.yml` | `pull_request` (título editado)  | Que el título de la PR sea convencional — es lo que acaba en el changelog al hacer squash |
| `release.yml`  | `push` a `main`                  | Calcular versión, generar changelog, crear tag y release                                  |
| `publish.yml`  | `release: published`             | Construir y publicar imágenes Docker en GHCR con la versión                               |
| `deploy.yml`   | manual o tras `publish`          | Avisar al VPS para que despliegue la nueva versión                                        |

Separar release de publish importa: la versión se decide una vez y las imágenes se construyen a partir de un tag inmutable, no de "lo que hubiera en main en ese momento".

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
    branches: [main]

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

Con merges por squash, el título de la PR es el mensaje de commit que llega a `main` y por tanto lo que lee el versionado. Validarlo:

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

## 6. `deploy.yml` — despliegue al VPS

Dokploy expone un webhook por aplicación. Mantenlo **manual al principio** (`workflow_dispatch` con input de tag): un despliegue automático en cada release, con el equipo en mitad de una sesión de estimación, corta la partida.

```yaml
name: Deploy
on:
  workflow_dispatch:
    inputs:
      tag: { description: 'Versión a desplegar (ej. v0.3.0)', required: true }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production # exige aprobación manual si la configuras así
    steps:
      - name: Disparar despliegue en Dokploy
        run: |
          curl -fsSL -X POST "${{ secrets.DOKPLOY_WEBHOOK_URL }}" \
            -H 'Content-Type: application/json' \
            -d '{"tag":"${{ inputs.tag }}"}'
      - name: Verificar versión desplegada
        run: |
          sleep 30
          curl -sf https://${{ vars.APP_HOST }}/health | grep -q "${{ inputs.tag }}"
```

El paso de verificación no es adorno: sin él, un despliegue fallido queda en verde.

---

## 7. Protección de `main` y flujo de trabajo

El flujo es **una rama y una PR por bloque del plan**. Nada llega a `main` sin pasar por ahí.

### 7.1 Reglas de la rama

Configúralo con un **Ruleset** (Settings → Rules → Rulesets; sustituye a la protección clásica):

- Prohibido el push directo a `main`, incluidos administradores.
- **PR obligatoria, con 0 aprobaciones requeridas.**
- Checks requeridos: `quality`, `unit`, `contract`, `e2e`, `docker-build`, `pr-title`.
- Ramas actualizadas antes de mergear.
- Solo squash merge, con el título de la PR como mensaje.
- Conversaciones resueltas antes del merge.

**Por qué 0 aprobaciones:** GitHub no permite aprobar tu propia PR. Con 1 aprobación requerida y un solo mantenedor, toda PR queda bloqueada para siempre. Con 0, la PR sigue siendo obligatoria, los checks siguen siendo bloqueantes y tú decides cuándo mergear — que es justo el control que buscas. Cuando entre otra persona al repo, subes el número a 1 y ya está.

### 7.2 Cómo abre las PRs Claude Code

Para cada bloque del plan:

1. `git switch -c feat/NN-nombre-del-bloque` desde `main` actualizado.
2. Commits convencionales pequeños, uno por unidad de trabajo coherente.
3. `gh pr create --draft` **al empezar**, no al terminar: así ves la CI corriendo mientras se construye.
4. Cuando la checklist del bloque esté completa, `gh pr ready`.
5. **Claude Code nunca mergea.** Deja la PR lista y para. El merge es tuyo.

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
- **PRs apiladas** solo si es imprescindible: si el bloque 3 depende del 2 sin mergear, abre la PR del 3 contra la rama del 2 y cambia la base al mergear. Es incómodo; mejor mergear el 2 primero.

---

## 8. Higiene

- **Dependabot** (`.github/dependabot.yml`) semanal para `npm`, `docker` y `github-actions`, agrupando parches en una sola PR.
- **Fija las actions por versión mayor** (`@v4`); para las de terceros que tocan secretos, considera fijar por SHA.
- `permissions` **explícitos y mínimos** en cada workflow. Por defecto, `contents: read`.
- `GITHUB_TOKEN` es suficiente para todo lo anterior; no crees PATs salvo que aparezca una necesidad concreta.
- Los secretos (`DOKPLOY_WEBHOOK_URL`) van en Secrets del repositorio, nunca en el YAML.

---

## 9. Checklist de salida

- [ ] Una PR con un `console.log` suelto es bloqueada por `quality`
- [ ] Una PR que importe zod dentro de `domain/` es bloqueada por `arch`
- [ ] Una PR con título `arreglos varios` es bloqueada por `pr-title`
- [ ] Un merge con `feat(domain): ...` abre PR de release con bump minor y changelog
- [ ] Mergear esa PR crea el tag y publica las imágenes en GHCR
- [ ] `/health` de la imagen publicada devuelve la versión del tag
- [ ] Los checks aparecen como requeridos en el ruleset de `main`
- [ ] Puedes mergear tu propia PR sin que GitHub pida una aprobación ajena
- [ ] Un push directo a `main` es rechazado
