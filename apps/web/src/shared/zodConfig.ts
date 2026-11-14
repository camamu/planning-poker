import { z } from 'zod';

/**
 * Zod compila los validadores con `new Function` si el entorno lo permite, y para saberlo lo
 * prueba dentro de un `try/catch`. Bajo una CSP sin `unsafe-eval` el navegador lo deja pasar pero
 * lo anota como violación en la consola de cada visita (ADR 0031). Con `jitless` se salta la
 * prueba. Hay que ejecutarlo antes de importar `@pp/contracts`: zod decide al construir cada
 * esquema, no al validar. Por eso `main.tsx` lo importa el primero.
 */
z.config({ jitless: true });
