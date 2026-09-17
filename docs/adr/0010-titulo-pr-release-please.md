# 0010 — Título de la PR de release-please: `release-type` bloqueaba `release-please-config.json`

## Contexto

Las tres releases automáticas hasta ahora (#11 v1.0.0, #18 v1.0.1, #23 v1.1.0) salieron tituladas
`chore(main): release X.Y.Z` — el patrón *por defecto* de `release-please`, con el scope `main`
que `pr-title.yml` no admite (ver `docs/adr/0007-produccion-ci-cd.md`, `commitlint.config.js`).
El check fallaba en cada release y había que renombrar la PR a mano.

Se probaron dos arreglos en `release-please-config.json` sin ningún efecto:

1. `"pull-request-title-pattern"` (PR #13) — sin efecto en #18.
2. `"group-pull-request-title-pattern"` (PR #19, con la hipótesis correcta de que
   `separate-pull-requests: false` usa el patrón de *grupo*, no el individual) — tampoco tuvo
   efecto en #23.

Verificado localmente instalando `release-please@17.11.2` (la versión que fija
`googleapis/release-please-action@v4` en su `package.json`) y llamando directamente a
`PullRequestTitle.ofComponentTargetBranchVersion(...)` con el patrón de este repo: el propio
motor de `release-please` sí aplica `group-pull-request-title-pattern` correctamente — no era un
problema de versión de la librería ni de caché del tag flotante `@v4`.

El bug real estaba en el wrapper, no en la librería: `googleapis/release-please-action`
(`src/index.ts`, función `loadOrBuildManifest`) decide entre dos modos completamente distintos
según si el input `release-type` está presente:

```ts
if (inputs.releaseType) {
  return Manifest.fromConfig(...)  // ignora config-file y manifest-file por completo
}
return Manifest.fromManifest(github, ..., inputs.configFile, inputs.manifestFile, ...)
```

`release.yml` pasaba **a la vez** `release-type: node` y `config-file`/`manifest-file`. Con
`release-type` presente, la acción tomaba la rama `fromConfig` — que solo lee los pocos inputs
explícitos de la acción (`releaseType`, `includeComponentInTag`, `changelogHost`,
`versioningStrategy`, `releaseAs`) y nunca abre `release-please-config.json`. Cualquier clave del
fichero (`group-pull-request-title-pattern`, `pull-request-title-pattern`, `package-name`,
`changelog-path`...) era, por tanto, letra muerta desde el bloque 9 — de ahí que los intentos de
PR #13 y #19 no cambiaran nada: el fichero que editaban nunca se leía.

Confirmado además contra el propio commit de la rama de release (no el título editable de la
PR): el commit `cf34cd3` de la rama de PR #23 lleva el mensaje `chore(main): release 1.1.0`, el
patrón por defecto exacto — el título de PR que sí aparece correcto en el histórico es el que se
renombró a mano después.

## Decisión

Quitar `release-type: node` del `with:` del step `googleapis/release-please-action@v4` en
`release.yml`. `release-please-config.json` ya declara `"release-type": "node"` dentro de
`packages["."]` — es la ubicación correcta para ese campo en modo manifest — así que no se pierde
información, solo se deja de pasar el input que activaba la rama `fromConfig`.

No se fija `googleapis/release-please-action` a un SHA exacto (a diferencia de lo que se planteó
investigar): el resto de `uses:` del repo usa tags de versión mayor flotantes
(`actions/checkout@v4`, `docker/build-push-action@v6`...) gestionados por el grupo
`github-actions-dependencies` de Dependabot, y la causa del bug no tenía relación con qué versión
de la acción se resolviera — era el propio `with:` de este repo, en cualquier versión de la acción
que implemente esta misma lógica de `loadOrBuildManifest` (verificada: presente en la rama `main`
de `release-please-action`, la misma que resuelve el tag `v4`).

## Consecuencias

- La próxima release automática debe abrir la PR ya titulada con
  `group-pull-request-title-pattern` (`chore(ci): release${component} ${version}`), sin
  necesidad de renombrarla a mano.
- Si en el futuro se necesita fijar `release-type` explícitamente vía input de la acción (en vez
  de en `release-please-config.json`), hay que quitar `config-file`/`manifest-file` a la vez —
  son mutuamente excluyentes en `loadOrBuildManifest`, no aditivos.
- No hay migración de datos ni cambio de comportamiento fuera de este workflow: el propio
  `release-please-config.json` no cambia en este ADR.
