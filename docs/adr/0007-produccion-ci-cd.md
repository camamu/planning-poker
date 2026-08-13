# 0007 — Producción: CI/CD y despliegue (bloque 9)

## Contexto

`docs/00-setup-entorno.md` y `docs/03-ci-cd.md` prescriben los cinco workflows de GitHub
Actions (`ci`, `pr-title`, `release`, `publish`, `deploy`) como parte del **bloque 1**: "una CI
que llega en el bloque 9 no ha protegido nada". En la práctica, `.github/` no existía hasta este
bloque — los bloques 2-7 se construyeron sin CI automatizada, validados solo con `pnpm verify`
en local. Este ADR documenta esa desviación y las decisiones tomadas al cerrarla aquí, junto con
el resto de la entrega de "Producción" de la tabla de `docs/02-decisiones-y-plan.md` §5
(Dockerfile multi-stage y healthchecks — ya existían desde el esqueleto — más Dokploy, dominio y
SSL).

## Decisiones

- **Los cinco workflows se implementan tal cual los especifica `docs/03-ci-cd.md`**, con un único
  ajuste deliberado: `NODE_VERSION` no es `22` como dice el documento, sino que cada job lee
  `.nvmrc` (`node-version-file: .nvmrc`, actualmente `26`). El entorno real diverge del asumido
  por los docs (ver "Known local-environment gotchas" de `CLAUDE.md`: Node 26, pnpm vía Homebrew,
  Dockerfiles en `node:26-alpine`) y una CI que instala Node 22 para construir imágenes `node:26`
  no detectaría nada real.
- **`pnpm/action-setup` fija la versión mayor en `10`**, la misma con la que se generó
  `pnpm-lock.yaml` (`lockfileVersion: '9.0'`) y con la que pasa `pnpm verify` en local. Los
  Dockerfiles instalan `pnpm@11.20.0` vía `npm install -g` dentro de la imagen — es una elección
  independiente de bloque 1 para el runtime de la imagen, no la tocamos aquí.
- **`docker-compose.ci.yml` limpia los bind mounts de `api`/`web`** con la etiqueta de merge
  `!reset null` de la Compose Specification (soportada desde Compose v2.24). La CI debe validar
  la imagen tal como se construye (`COPY . .` en el target `development`), no el árbol de
  fuentes del runner superpuesto encima — y evita además la inestabilidad conocida de
  `tsx watch`/`chokidar` sobre bind mounts sin `inotify` nativo en algunos runners.
- **`APP_VERSION` viaja como build-arg → `ENV` en la imagen → campo `version` de `GET /health`.**
  `env.ts` lo valida como string opcional (`default('dev')`, para `docker compose up` local y
  para cualquier build sin el arg); `publish.yml` lo inyecta con el tag de la release
  (`build-args: APP_VERSION=${{ github.event.release.tag_name }}`). `deploy.yml` verifica el
  despliegue haciendo `grep` de ese mismo tag contra `/health` — sin ese paso, un despliegue roto
  queda en verde.
- **`release-please-config.json` versiona el repo como una sola unidad** (`separate-pull-requests:
false`, componente único en `.`). Se añade `"version": "0.1.0"` a la raíz de `package.json`
  (no lo tenía) porque `release-type: node` de release-please necesita un `package.json` con
  versión en la ruta del componente. Los `package.json` de `apps/*`/`packages/*` siguen en
  `0.0.0`: son privados y no se versionan por separado, tal como fija `docs/03-ci-cd.md` §4.
- **`docker-compose.prod.yml` es nuevo — no estaba especificado literalmente en los docs — y es
  el fichero que se sube a Dokploy como aplicación "Docker Compose".** Usa las imágenes ya
  publicadas en GHCR (`ghcr.io/camamu/planning-poker/{api,web}:${IMAGE_TAG}`), sin `build:`, y
  **sin publicar puertos al host** (`expose`, no `ports`): Dokploy conecta los contenedores a su
  propia red (`dokploy-network`) y su Traefik habla con ellos por el puerto interno. Todos los
  secretos (`DATABASE_URL`, `CORS_ORIGIN`, `PUBLIC_API_URL`, `SESSION_SECRET`,
  `POSTGRES_PASSWORD`) se inyectan como variables de entorno desde el panel de Dokploy, nunca
  hardcodeados — a diferencia de `docker-compose.yml` de desarrollo, que sí lleva un
  `SESSION_SECRET` de broma a propósito.
- **Dominio y SSL no son un fichero en este repo.** Dokploy los resuelve él mismo: cada
  aplicación se asocia a un dominio desde su UI y Dokploy emite el certificado con Let's Encrypt
  automáticamente vía su Traefik interno. No hay labels de Traefik en `docker-compose.prod.yml`
  porque Dokploy los genera él mismo a partir de esa configuración — añadirlos a mano duplicaría
  una fuente de verdad que ya vive en el panel.
- **`deploy.yml` sigue siendo manual** (`workflow_dispatch`), tal como pide el documento: un
  despliegue automático en cada release cortaría una sesión de estimación en curso si coincide
  con el equipo usando la herramienta.

## Fuera de alcance de este bloque (deliberado, y por qué)

- **El Ruleset de `develop`/`main`** (`docs/03-ci-cd.md` §7.1: PR obligatoria, checks
  requeridos, 0 aprobaciones) no es un fichero versionable — vive en la configuración del
  repositorio de GitHub (Settings → Rules → Rulesets) y requiere permisos de administrador que
  esta sesión no tiene. Queda pendiente de un paso manual humano; los nombres de los checks a
  marcar como requeridos son los `name:` de los jobs de `ci.yml` (`quality`, `unit`, `contract`,
  `e2e`, `docker-build`) más `pr-title`.
- **Aprovisionar el VPS de Hetzner, instalar Dokploy, crear la aplicación "Docker Compose" y
  apuntar el dominio** — infraestructura real fuera del repositorio. `docker-compose.prod.yml`
  y este ADR son la documentación de qué esperar cuando ese paso se haga.
- **Los secretos de GitHub Actions** (`DOKPLOY_WEBHOOK_URL`) y las variables de entorno
  (`APP_HOST`) que usa `deploy.yml` — se crean en Settings → Secrets and variables del
  repositorio, nunca en el YAML ni en este ADR.
- **`CHANGELOG.md`** no se crea a mano: lo genera `release-please` en su primera PR de release.

## Consecuencias

- `.github/workflows/{ci,pr-title,release,publish,deploy}.yml`, `.github/dependabot.yml`,
  `.github/pull_request_template.md`, `release-please-config.json` y
  `.release-please-manifest.json` entran al repo en este bloque, no en el 1.
- `GET /health` cambia de forma: `{ status: 'ok' }` → `{ status: 'ok', version: string }`. No
  hay ningún test que fijara la forma anterior, así que no hay migración de tests que hacer.
- `.env.example` gana `APP_VERSION=dev`.
- Hasta que un humano complete los pasos de infraestructura de la sección anterior, `publish.yml`
  y `deploy.yml` están operativos pero inertes: no hay VPS ni dominio contra los que desplegar.
