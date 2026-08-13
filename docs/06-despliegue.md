# 06 — Despliegue: Render + Cloudflare Pages + Supabase

> Documento vigente para producción. Sustituye a la recomendación de VPS + Dokploy de
> `01-especificacion.md` §10 y a las filas "Despliegue"/"Persistencia" de `02-decisiones-y-plan.md` §1.
> El bloque 9 dejó los cinco workflows de CI/CD cableados contra Dokploy
> (`docs/adr/0007-produccion-ci-cd.md`); el bloque 10 los reemplaza por lo que describe este
> documento — `deploy.yml` reescrito y `heartbeat.yml` nuevo (`03-ci-cd.md` §6), más el borrado de
> `docker-compose.prod.yml` (`docs/adr/0008-despliegue-gestionado.md`).

---

## 1. Por qué este reparto

Con la base de datos fuera del contenedor de la API, esta queda como un único proceso ligero: Node +
Fastify + Socket.IO, sin Postgres al lado. Eso abre plataformas gratuitas de un solo servicio que
antes no encajaban.

| Pieza                 | Servicio                                              | Motivo                                                                       |
| --------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| API (`apps/api`)      | **Render**, free web service, imagen Docker existente | Git push o imagen de GHCR, cero VPS que administrar                          |
| Frontend (`apps/web`) | **Cloudflare Pages**, free                            | Estático, CDN global, nunca se duerme, sin límite práctico de ancho de banda |
| Base de datos         | **Supabase**, free tier                               | Postgres gestionado, 500 MB, sin tarjeta                                     |

Nadie de vosotros administra un servidor. Es el mismo `Dockerfile` de `apps/api` que ya existe de los
bloques 1-5 — Render solo necesita esa imagen, no cambia nada del código.

---

## 2. Los dos avisos operativos (leerlos antes de montar nada)

### 2.1 Supabase pausa el proyecto a los 7 días de inactividad

El equipo se reúne cada dos semanas. Sin nada más, la base de datos estaría pausada en cada sprint y
la primera persona en abrir el enlace se encontraría la app rota, no solo lenta.

**Mitigación:** `heartbeat.yml` (`03-ci-cd.md` §6.2), un cron diario que hace `select 1;` contra
Supabase. Está activo desde el mismo momento en que existe el secreto `SUPABASE_DATABASE_URL`; el
síntoma de olvidarlo tarda dos semanas en aparecer, así que conviene verificarlo a mano una vez con
`workflow_dispatch`.

### 2.2 Render free se duerme por inactividad

El primer request tras un rato sin tráfico tarda en despertar (varios segundos, a veces bastante
más). Una vez hay tráfico — alguien conectado por WebSocket — se mantiene despierto solo.

**Mitigación aceptada, no técnica:** abrir el enlace de la partida un par de minutos antes de empezar
la sesión. Añadir un ping automático que mantenga la API siempre despierta consume horas del cupo
gratis de Render sin necesidad real — no compensa para una app que se usa un rato cada dos semanas.
Si en algún momento molesta de verdad, es la señal de pasar a un plan de pago o volver a la opción de
VPS, no de parchear con más automatismos.

---

## 3. Supabase — configuración

1. Crear proyecto (región Europa/Frankfurt si está disponible, para latencia desde España).
2. Guardar el **connection string** de la sección Database → Connection string → modo `Session`
   (pooler) para uso desde Render — Supabase recomienda el pooler para conexiones desde entornos
   serverless/PaaS en vez de la conexión directa.
3. El pooler exige TLS: el connection string debe llevar **`sslmode=require`**. No hay nada que tocar
   en el código — `apps/api/src/infrastructure/persistence/postgres/db.ts` no configura `ssl` a mano,
   se lo deja a `pg`, que lee ese parámetro del propio string. Si la verificación del certificado
   fallara en Render, la salida es `sslmode=no-verify` en el string (la conexión sigue cifrada), no
   añadir configuración de proveedor al código.
4. Aplicar las migraciones de Kysely (`apps/api/migrations`) contra ese connection string, igual que
   ya se hacía contra el Postgres local. En producción lo hace el job `migrate` de `deploy.yml` antes
   de cada despliegue; para la primera puesta en marcha vale un `pnpm --filter @pp/api migrate:up` en
   local con `DATABASE_URL` apuntando a Supabase.
5. Guardar el mismo connection string como:
   - Variable de entorno `DATABASE_URL` en el servicio de Render (producción).
   - Secreto `SUPABASE_DATABASE_URL` en GitHub Actions (migraciones del deploy y heartbeat).
6. **No** uséis el cliente JS de Supabase ni su Realtime — la API sigue hablando con Postgres vía
   `pg`/Kysely, tal como se decidió en `02-decisiones-y-plan.md`. Supabase aquí es solo "Postgres
   gestionado", nada más; conectar el SDK de Supabase en cualquier punto del código sería colar un
   acoplamiento que la arquitectura hexagonal existe justo para evitar.

---

## 4. Render — configuración

1. Crear un **Web Service**, tipo "Existing image" (imagen preconstruida), apuntando a
   `ghcr.io/<owner>/<repo>/api:latest` como imagen por defecto — el tag real en cada despliegue lo
   decide `deploy.yml` (`03-ci-cd.md` §6.1).
2. Si el repositorio de GHCR es privado, añadir las credenciales del registro en Settings del
   servicio antes del primer deploy.
3. Variables de entorno del servicio (coinciden con `apps/api/src/infrastructure/config/env.ts`):
   ```
   DATABASE_URL       → connection string de Supabase
   PORT               → 3000 (o el que exponga Render)
   NODE_ENV           → production
   CORS_ORIGIN        → https://<dominio-de-cloudflare-pages>
   LOG_LEVEL          → info
   SESSION_SECRET     → generado, guardado como secreto de Render
   ```
   `APP_VERSION` no se define aquí: viaja dentro de la imagen, inyectada por `publish.yml` con el tag
   de la release, y es lo que `deploy.yml` comprueba contra `/health`.
4. Copiar la **Deploy Hook URL** de Settings y guardarla como secreto `RENDER_DEPLOY_HOOK_URL` en
   GitHub.
5. Health check configurado contra `/health` en el propio Render (además del que ya usa `deploy.yml`
   para verificar).
6. Anotar el dominio asignado (`*.onrender.com` o el custom domain) como variable `API_HOST` en
   GitHub Actions (Settings → Variables, no Secrets), **sin esquema**: los workflows le anteponen
   `https://`.

---

## 5. Cloudflare Pages — configuración

1. Crear el proyecto en el dashboard de Cloudflare, sin conectarlo al repositorio en modo "deploy
   automático en cada push" — el despliegue lo dispara `deploy-web` en `deploy.yml`, para que el
   front se versione junto a la API en vez de ir por libre en cada commit a `develop`.
2. Generar un **API Token** con permiso de Cloudflare Pages (Edit) y guardarlo como secreto
   `CLOUDFLARE_API_TOKEN`; el `Account ID` como `CLOUDFLARE_ACCOUNT_ID`.
3. `VITE_API_URL` y `VITE_WS_URL` (el cliente de Socket.IO usa la segunda) son variables **de build**:
   Vite las congela dentro del bundle. Como el bundle lo construye `deploy-web` en GitHub Actions y
   Cloudflare recibe `apps/web/dist` ya construido vía Wrangler, se definen en el paso de build del
   workflow a partir de `vars.API_HOST` — **definirlas en el dashboard de Cloudflare no tendría
   ningún efecto**.
4. Dominio: el que da Cloudflare Pages por defecto sirve para el MVP; un dominio propio es opcional y
   no urgente para una herramienta interna.

---

## 6. CORS y el WebSocket entre dominios distintos

Al vivir la API y el front en dominios diferentes (`*.onrender.com` y `*.pages.dev`), hace falta:

- `CORS_ORIGIN` en la API apuntando exactamente al dominio de Cloudflare Pages (no `*`).
- Socket.IO configurado con ese mismo origen permitido en el handshake — es un punto de
  configuración aparte del CORS de Fastify, se olvida con facilidad y el síntoma es "funciona en
  local, no en producción". En este repo ya está resuelto: `main.ts` pasa `env.CORS_ORIGIN` tanto a
  `@fastify/cors` como al `Server` de Socket.IO.
- Cookies de sesión de participante (si se usan) con `SameSite=None; Secure`, porque son dominios
  distintos. Hoy no se usan: la identidad del participante vive en `localStorage` del navegador.

---

## 7. Checklist de salida del bloque 10

- [ ] Migraciones aplicadas contra Supabase, no contra un Postgres local
- [ ] `deploy.yml` despliega un tag concreto y `/health` de Render confirma esa versión
- [ ] El front en Cloudflare Pages consume la API de Render sin errores de CORS
- [ ] Voto de un participante llega por WebSocket a otro participante con la API y el front en
      dominios distintos
- [ ] `heartbeat.yml` corriendo en cron, verificado manualmente una vez con `workflow_dispatch`
- [ ] Simulado un "despertar en frío": cerrar toda pestaña, esperar 20+ minutos, abrir el enlace y
      confirmar que carga (aunque tarde) en vez de dar error
- [ ] Documentado en el README dónde vive cada pieza y cómo se despliega, para quien no haya seguido
      esta conversación
