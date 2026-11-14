# 0031 — Endurecimiento: límites de peticiones, de tamaño y cabeceras de seguridad

## Contexto

`docs/01-especificacion.md` §8.5 pedía limitación de peticiones en `vote` y `join`, validación de
esquema en el borde y saneado de nombres y tareas. Se construyó la validación con zod, pero nada
más: la API es pública y sin cuentas, y a fecha del bloque 21 cualquiera con el enlace de una
partida podía:

- mandar miles de `vote`/`join`/`emoji_thrown` por segundo: cada uno lee y escribe la partida, y
  `PostgresGameRepository.save()` reescribe todo el agregado;
- meter un nombre, un título, una carta o un identificador de megabytes: acaba en la base de datos,
  en el `state_sync` de toda la sala y en los webhooks;
- disparar importaciones de 200 tareas en bucle, o el envío de webhooks salientes (que hace
  peticiones HTTP a un tercero) tantas veces como quisiera.

Tampoco había ninguna cabecera de seguridad ni en la API ni en la web. Las URLs de partida
(`/games/:id`) y de equipo (`/t/:slug?k=token`) son credenciales: no deben viajar en `Referer`.

## Decisión

### 1. Limitación de peticiones, en memoria y de ventana fija

`RateLimiter` (`infrastructure/security/`): un contador por clave dentro de una ventana, sin
temporizadores (los vencidos se barren de forma perezosa) y con el instante recibido por parámetro,
como `LoginThrottle`, para probarlo sin esperar. Una sola implementación sirve a HTTP y a Socket.IO.
No se usa `@fastify/rate-limit`: Socket.IO no pasa por Fastify, y dos mecanismos distintos para lo
mismo valdrían más en mantenimiento que las ~50 líneas propias.

Con una sola instancia no hace falta estado compartido; un reinicio que vacíe los contadores solo
regala una ventana. Si algún día hay varias instancias, el contador pasa a un almacén compartido
detrás de la misma interfaz (mismo criterio que `RealtimeBroadcaster`).

| Ámbito (por IP salvo que se diga)                                           | Límite       |
| --------------------------------------------------------------------------- | ------------ |
| Cualquier ruta `/api/*`                                                     | 600 / minuto |
| `POST /api/games`                                                           | 30 / hora    |
| `POST /api/teams`                                                           | 10 / hora    |
| `POST /api/games/:id/participants` (unirse)                                 | 60 / minuto  |
| `POST /api/games/:id/issues/batch` (importar)                               | 10 / minuto  |
| `POST /api/games/:id/summary/webhook` y `POST …/webhooks/:id/test` (salida) | 10 / minuto  |
| Conexión nueva de Socket.IO                                                 | 120 / minuto |
| Cualquier evento de un socket                                               | 100 / 10 s   |
| `vote` y `async_vote`, por socket                                           | 20 / 10 s    |
| `vote` y `async_vote`, por participante (suma de todos sus sockets)         | 40 / 10 s    |
| `join`, por socket                                                          | 10 / minuto  |
| `emoji_thrown` y `discussion_timer_control`, por socket                     | 20 / 10 s    |

Las cifras están pensadas para un equipo detrás de una misma salida a internet (una oficina entera
es una IP): los límites por IP más estrictos son de operaciones raras (crear, importar, enviar).
`POST /api/admin/session` conserva su `LoginThrottle` (5 fallos / 15 min).

**Respuesta.** HTTP: `429` con `Retry-After` y el cuerpo `{ error, message }` de siempre, para que
el cliente enseñe el mensaje sin código nuevo. Socket.IO: el paquete se descarta y el socket recibe
el evento `error` con el mismo mensaje, que el front ya muestra; una conexión rechazada recibe
`connect_error` y, como Socket.IO solo reintenta los fallos de transporte y no los rechazos del
servidor, el cliente vuelve a intentarlo a los 15 s (si no, la mesa quedaría muerta hasta recargar). El hook HTTP se registra **después** de `@fastify/cors` para que el `429` lleve
`Access-Control-Allow-Origin`: sin él el navegador lo vería como un error de red sin mensaje.

**Quién es el cliente.** Detrás de Cloudflare y del balanceador de Render, `request.ip` es el del
proxy y todos los clientes compartirían contador. La variable `TRUST_PROXY_HOPS` (por defecto `0`)
dice cuántos proxies de confianza hay delante de la API. A Fastify se le pasa como una función
(`fastifyTrustProxy`) y no como número, porque en Fastify 5 un `trustProxy` numérico no confía en
nadie y `request.ip` seguiría siendo el del proxy sin ningún aviso. `resolveClientIp` aplica la
misma regla a las conexiones de Socket.IO, que no pasan por Fastify; un test comprueba que ambas
dan la misma IP. Presupone que la API solo es alcanzable a través de esos proxies. Se
cuenta desde el final y no se toma la primera entrada de `X-Forwarded-For`, porque el balanceador de
Render **no filtra** lo que el cliente mande, solo añade: la entrada de más a la izquierda la
escribe quien ataca. Con `0` los límites por IP siguen funcionando pero con un contador común para
todos los clientes, y la API avisa al arrancar en producción. Efecto colateral buscado: el
`LoginThrottle` del panel de administración, que usaba `request.ip`, deja de bloquear a todo el
mundo a la vez.

### 2. Límites de tamaño en el borde

`packages/contracts/src/limits.ts` fija los máximos y `commands.ts`/`webhooks.ts` los aplican con
zod: nombre de participante 40, partida y equipo 80, baraja 60; título de tarea 200, descripción
2000, enlace 2048; carta 32 (amplio a propósito: las barajas ya creadas no tenían tope y sus cartas
tienen que seguir votándose), 40 cartas por baraja; emoji 32; identificadores 64; cuenta atrás y
temporizador 3600 s; 50 personas autorizadas a revelar. Con todos los campos de una importación al
máximo, el cuerpo sigue por debajo del 1 MiB de `bodyLimit` de Fastify (hay un test).

Viven en los contratos y no en el dominio por lo mismo que `MAX_IMPORTED_ISSUES`: son higiene de
entrada, no reglas de negocio, y el agregado no debe decidir qué tamaño de texto acepta cada
transporte. Socket.IO recibe además `maxHttpBufferSize` de 32 KiB: ningún evento del cliente se
acerca. El front toma las mismas constantes para el `maxLength` de sus campos y el importador
recorta lo que excede en vez de rechazar el lote entero («todas o ninguna», ADR 0023).

### 3. Cabeceras de seguridad

- **API** (`onSend`): `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src
'none'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` (la
  respuesta de una partida es distinta para cada espectador: invariante 7) y, en producción,
  `Strict-Transport-Security`.
- **Web** (Cloudflare Workers con assets): un `_headers` que genera el build
  (`apps/web/build/securityHeaders.ts`, enchufado como plugin de Vite) y no un fichero estático,
  porque el `connect-src` de la CSP necesita el origen de la API, que es una variable de despliegue
  (`VITE_API_URL`, ADR 0011). CSP con `script-src 'self'` sin `unsafe-inline`; `style-src` admite
  `unsafe-inline` por los `style=` de React y Google Fonts, que la web carga desde
  `fonts.googleapis.com`/`fonts.gstatic.com`. `Referrer-Policy: no-referrer`, porque un enlace de
  tarea hacia Jira no debe llevarse el `?k=` del equipo. `connect-src` lista `https://` y `wss://`
  de la API por separado: una fuente `https:` no cubre `wss:`.
- **Zod bajo la CSP.** Zod 4 comprueba si puede compilar validadores probando `new Function` dentro
  de un `try/catch`; el error se captura, pero una CSP sin `unsafe-eval` lo anota como violación en
  cada visita (se vio al probar en Chromium). `z.config({ jitless: true })` se salta la prueba, y
  tiene que ejecutarse antes de importar `@pp/contracts` porque zod decide al construir cada
  esquema: `main.tsx` importa primero `shared/zodConfig.ts`. Por eso `zod` es ahora dependencia
  directa de la web (misma versión que `contracts`, una única instancia).

## Fuera de alcance (deliberado)

- **Topes por partida** (participantes y tareas). Son reglas de negocio y van en el agregado, con
  su error de dominio y su test, no en el borde. Sin ellos, el volumen que cabe en una partida lo
  acota solo la limitación de peticiones.
- **Retención y borrado automático de partidas inactivas** y el aviso de privacidad de §8.4: el
  ADR 0030 dejó el borrado manual desde `/admin`, y el aviso necesita texto legal que no es nuestro.
- **Limitador compartido entre instancias** (Redis): solo hace falta con más de una.
- **Cabeceras en la imagen `web` autoalojada** (`sirv`): no admite cabeceras propias. En Cloudflare,
  que es el despliegue real, sí se aplican; quien autoaloje debe ponerlas en su proxy.
- **Autoalojar la tipografía** para quitar la dependencia de Google Fonts (y la IP del visitante que
  recibe Google): es una decisión de diseño y de privacidad, aparte.

## Consecuencias

- Variable nueva `TRUST_PROXY_HOPS` (`config/env.ts`, `.env.example`, `docs/06-despliegue.md` §4).
  En Render con Cloudflare por delante se espera `2` (Cloudflare y el balanceador); **hay que
  comprobarlo en el primer despliegue** mirando el `remoteAddress` de los logs de la API: debe ser
  la IP pública de quien hace la petición, no la de un proxy.
- Una ráfaga legítima por encima de los límites (alguien que pulsa cartas como una ametralladora)
  recibe el mensaje de límite en lugar de que se registre el voto. No se ha visto un uso normal que
  se acerque.
- `registerSocketGateway` gana una dependencia (`rateLimits`) y `main.ts` y `testServer.ts` cablean
  la misma política, con los umbrales sustituibles en los tests e2e.
- El front gana `apps/web/build/` (fuera de `src/`, porque es una pieza del build y no de la
  aplicación) y el `maxLength` en sus campos de texto.
