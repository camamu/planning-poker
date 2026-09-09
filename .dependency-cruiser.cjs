const path = require('path');

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
      to: {
        path: '^apps/api/src/infrastructure/(persistence|realtime)/.+(Repository|Broadcaster)',
      },
    },
    {
      name: 'design-system-no-depende-de-features',
      severity: 'error',
      comment: 'Una pieza de design-system no puede saber que existe una partida.',
      from: { path: '^apps/web/src/design-system' },
      to: { path: '^apps/web/src/(features|shared)' },
    },
    {
      name: 'shared-no-depende-de-features',
      severity: 'error',
      from: { path: '^apps/web/src/shared' },
      to: { path: '^apps/web/src/features' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    { name: 'no-huerfanos', severity: 'warn', from: { orphan: true }, to: {} },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: path.join(__dirname, 'apps/api/tsconfig.json') },
    doNotFollow: { path: 'node_modules' },
  },
};
