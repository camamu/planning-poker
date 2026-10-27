# 0026 — Exportación a CSV y Markdown en el cliente

_Borrador escrito al planificar el bloque 18 (`docs/07-plan-v2.md` §10). Actualizar en la PR del
bloque si la implementación se desvía._

## Contexto

El resultado de la sesión acaba en el gestor de tareas o en un documento. F7 y F16 pedían
exportarlo. El resumen del bloque 17 ya trae todos los datos necesarios.

## Decisión

- **Se genera en el navegador** a partir de `GameSummaryView`, con funciones puras `toCsv` y
  `toMarkdown`. El servidor sigue hablando solo JSON: no gana dependencias, cabeceras de descarga ni
  formatos que versionar, y la exportación funciona con lo que ya se ha cargado.
- **CSV compatible con la importación**: columnas `summary, key, description, link, estimate`
  (más `rounds` y `agreement`), RFC 4180, BOM UTF-8. `key` sale de `issueKeyFromUrl`, la misma
  función que usa el bloque 15, y un test de ida y vuelta lo fija.
- **Separador `;` por defecto**: Excel con configuración regional española espera `;` y abre mal un
  CSV con comas. Se ofrece `,` como opción para otras herramientas.
- **Markdown** como tabla con enlaces, para pegar en un documento, Confluence o un PR.

## Consecuencias

- Sin cambios en api ni en contratos.
- Si algún día hace falta exportar sin abrir la app (p. ej. desde una integración), habrá que mover
  estas funciones a `packages/contracts` o a la api; son puras, así que el cambio es mecánico.
