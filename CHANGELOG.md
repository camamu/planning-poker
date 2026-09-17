# Changelog

## [1.1.0](https://github.com/camamu/planning-poker/compare/v1.0.1...v1.1.0) (2026-09-09)


### Features

* **ci:** smoke test de las imágenes production de API y front ([b2bcce7](https://github.com/camamu/planning-poker/commit/b2bcce7509da2144d60aadf1a09ba499fc85eb2b))


### Bug Fixes

* **contracts:** resuelve @pp/contracts a dist/ en runtime de producción ([3483a90](https://github.com/camamu/planning-poker/commit/3483a90025d21d9e6c22b8d91536e7e0409e8421))

## [1.0.1](https://github.com/camamu/planning-poker/compare/v1.0.0...v1.0.1) (2026-09-09)


### Bug Fixes

* **ci:** excluye typescript de dependabot y corrige el título de release-please ([4b5f136](https://github.com/camamu/planning-poker/commit/4b5f136e5550a68231c0f6dcb1d27e27383140fe))
* **ci:** publica las imágenes desde release.yml en vez de depender de un segundo evento ([a481273](https://github.com/camamu/planning-poker/commit/a481273cbaaa3e28f04a38e2eef50d22da59cf69))
* **ci:** publica las imágenes desde release.yml en vez de un segundo evento ([2441d08](https://github.com/camamu/planning-poker/commit/2441d08f76db76246d89ce5075cd9ec01fa7f28b))
* **docker:** copia node_modules por paquete en la imagen de producción de la API ([61a5e2f](https://github.com/camamu/planning-poker/commit/61a5e2fb7d7f942e78e9d3023410b52ab3b765e0))
* **docker:** copia node_modules por paquete en la imagen de producción de la API ([2c83e7c](https://github.com/camamu/planning-poker/commit/2c83e7c10f6fae91e31656e29eb05463f20130a0))

## 1.0.0 (2026-09-09)


### Features

* **app:** asocia la partida al equipo del que sale su baraja ([084157b](https://github.com/camamu/planning-poker/commit/084157bf7fd9e695f5b8bc815f532cee74706d42))
* **app:** casos de uso de crear partida, unirse, votar y revelar ([e29f1f4](https://github.com/camamu/planning-poker/commit/e29f1f449db3f62e16e83a59bc0e8b2512530d89))
* **app:** casos de uso TimeoutReveal y UpdateGameSettings ([bfdac10](https://github.com/camamu/planning-poker/commit/bfdac107b4a3c9083ba5f285d17b93815510e3a9))
* **app:** cierra la issue con la estimación acordada (invariante 10) ([1af60fe](https://github.com/camamu/planning-poker/commit/1af60fe2c58f6684821f877cd45a3c3dff5ca136))
* **app:** equipos y barajas personalizadas (bloque 7) ([8f3cea7](https://github.com/camamu/planning-poker/commit/8f3cea7275d99490b79f380d02001ae050704796))
* **app:** proyección de lectura filtrada y caso de uso GetGameState ([848970a](https://github.com/camamu/planning-poker/commit/848970a4fdbf93146ed8d82a1986f1e19f446c8e))
* **app:** puertos de aplicación y helper de carga de partida ([4259712](https://github.com/camamu/planning-poker/commit/4259712e436bb870f9d3dd4778930312bc840bf4))
* **ci:** añade el pipeline de CI/CD y el versionado automático (bloque 9) ([4f4815c](https://github.com/camamu/planning-poker/commit/4f4815c7d78ce31a6a626fc044c2d24743ef16f2))
* **ci:** despliega en Render + Cloudflare Pages + Supabase ([566d5ef](https://github.com/camamu/planning-poker/commit/566d5efc60daa5963d828685a1e247389b5493ca))
* **ci:** despliegue gestionado en Render + Cloudflare Pages + Supabase ([4acad31](https://github.com/camamu/planning-poker/commit/4acad31523cb8f2bf559590fd5396d61637fec2c))
* **contracts:** extiende settings, vistas y comandos para el bloque 6 ([ad4234e](https://github.com/camamu/planning-poker/commit/ad4234e7f3a25c531dd152a8dc190e93d3c6021c))
* **contracts:** views, events y commands del contrato HTTP+WS ([040ae6d](https://github.com/camamu/planning-poker/commit/040ae6d8af70ec3467a655741cb1c62ccc254da6))
* **docker:** expone APP_VERSION en /health y añade el compose de producción ([97c176a](https://github.com/camamu/planning-poker/commit/97c176a6c3fab0d457a50e7af0e0220b1bd27719))
* **domain:** agregado Game y objetos de valor del dominio de estimación ([3acea05](https://github.com/camamu/planning-poker/commit/3acea054514bb0f674fd64f2f3105729ea1a6912))
* **domain:** agregado Game y objetos de valor del dominio de estimación ([7b19920](https://github.com/camamu/planning-poker/commit/7b19920adb0683982f6962671ccb8946b8d1970c))
* **domain:** añade reconstitución del agregado para persistencia ([d02fbbd](https://github.com/camamu/planning-poker/commit/d02fbbd3ccf4a68743d1fee1cc70b6aa446d8f96))
* **domain:** dealer calculado, cuenta atrás y ajustes mutables ([45879bc](https://github.com/camamu/planning-poker/commit/45879bcdb83dc5fe31a935325936c83ff7fb4686))
* **infra:** cablea Fastify y Socket.IO en el composition root ([1a7ba5e](https://github.com/camamu/planning-poker/commit/1a7ba5e46df78f3bd504256783b7b537e6466d53))
* **infra:** HTTP + WebSocket gateway with filtered state projection ([27a8e8a](https://github.com/camamu/planning-poker/commit/27a8e8a9d78b9bee7614723e58018822363da05a))
* **infra:** repositorio de partidas en memoria ([d42030b](https://github.com/camamu/planning-poker/commit/d42030b81639b3802c423bc950f0630eb5fb319f))
* **infra:** repositorio Postgres de partidas con migraciones Kysely ([b73445a](https://github.com/camamu/planning-poker/commit/b73445ace420a7bf341c4cc9e4935d9474e7ee6d))
* **infra:** ruta de ajustes, timeout_reveal, emoji y temporizador de discusión ([326aaa5](https://github.com/camamu/planning-poker/commit/326aaa5a157ae8531b9d655d4d5a9fd536f29870))
* **web:** ajustes finos en caliente y editor de barajas de solo lectura ([a32661b](https://github.com/camamu/planning-poker/commit/a32661bf7b499038ac7138d98aa1b893dbf27c0b))
* **web:** arranca el tooling de apps/web (Vite + React + Tailwind v4) ([2be2144](https://github.com/camamu/planning-poker/commit/2be2144b095c12d017856f3b40432c3da72995d2))
* **web:** capa shared — socket, store, reducer, API REST, identidad, audio ([193164d](https://github.com/camamu/planning-poker/commit/193164d29f1ec9c7407f31faac627ab559b21e2e))
* **web:** cola de tareas — añadir issues y abrir ronda desde la UI ([6c9c6a4](https://github.com/camamu/planning-poker/commit/6c9c6a456d4a281a3a5637dda98b704cb7ceb7db))
* **web:** comparte el enlace de la partida con un código QR (F13) ([4558aa4](https://github.com/camamu/planning-poker/commit/4558aa4b1ff1fb8897c72e396ea123d31386006c))
* **web:** crear/unirse/votar/revelar de punta a punta — el bucle central del bloque 6 ([9b9aa74](https://github.com/camamu/planning-poker/commit/9b9aa74e3ddd8a6fd22f502ea2adb3299ffc7bb8))
* **web:** design-system Nocturne — tokens y componentes base ([0c48470](https://github.com/camamu/planning-poker/commit/0c48470492ef056bc0e94a306ae976fb7e74574e))
* **web:** estados vacíos/error, banda de reconectando y paso móvil ([78203b1](https://github.com/camamu/planning-poker/commit/78203b1499064ed0042a3f498b0be9adecf3487b))
* **web:** lanzar y reaccionar con emojis + temporizador de discusión (F8) ([930f787](https://github.com/camamu/planning-poker/commit/930f787f2200026b30a242c302cf3dfbff248315))
* **web:** recuerda tus equipos para poder volver a ellos ([9ceaf48](https://github.com/camamu/planning-poker/commit/9ceaf4802b00d99cd3a319ffae4211f33d1361d6))


### Bug Fixes

* **app:** resuelve @pp/contracts contra su dist en el build de producción ([12c26e0](https://github.com/camamu/planning-poker/commit/12c26e0cf0bb0964dc691586579e917afda48b3e))
* **ci:** corrige pr-title.yml y el build de producción de la API ([5c9e413](https://github.com/camamu/planning-poker/commit/5c9e4138149bc84404927359fb066ad890158c3b))
* **docker:** publica el puerto de Postgres en el compose de desarrollo ([c716b64](https://github.com/camamu/planning-poker/commit/c716b6405e3d6cc5100ace1339f6b6b2564708be))
* **infra:** separa el tsconfig de build del de tipos para tests/migrations ([fbef30b](https://github.com/camamu/planning-poker/commit/fbef30b92f7640c1f5d42f98c93fdd9771fffe7d))
* **web:** el voto propio deja de desincronizarse de la ronda ([15de41c](https://github.com/camamu/planning-poker/commit/15de41c5270a6917100a36f96abf074987e78bfd))
* **web:** hace el segmented control genérico sobre el valor de la opción ([33a883c](https://github.com/camamu/planning-poker/commit/33a883c57b6b6a4b176d47b1dbc831ab61cb378d))
* **web:** la carta seleccionada ya no se corta ni el segmento se ve biselado ([3abb496](https://github.com/camamu/planning-poker/commit/3abb4961665b871fd61205ae4fc62d5e9c4be794))
