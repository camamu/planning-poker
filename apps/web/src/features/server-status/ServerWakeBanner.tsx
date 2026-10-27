import type { JSX } from 'react';
import { Banner } from '../../design-system/index.js';
import { useServerStatusStore } from '../../shared/store/serverStatusStore.js';

/**
 * Flota sobre la página para no empujar el layout (la mesa ocupa `h-screen`) y solo aparece cuando
 * la API tarda: con la API despierta nunca llega a verse (ADR 0022).
 */
export function ServerWakeBanner(): JSX.Element | null {
  const status = useServerStatusStore((state) => state.status);
  const retry = useServerStatusStore((state) => state.retry);

  if (status !== 'waking' && status !== 'unreachable') return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center p-3">
      <div className="pointer-events-auto max-w-full">
        {status === 'waking' ? (
          <Banner message="Despertando el servidor… el primer arranque puede tardar hasta un minuto." />
        ) : (
          <Banner
            variant="error"
            message="No se puede conectar con el servidor."
            action={{ label: 'Reintentar', onClick: retry }}
          />
        )}
      </div>
    </div>
  );
}
