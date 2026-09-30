import { z } from 'zod';
import { isAdminPasswordHash } from '../security/ScryptAdminCredentials.js';

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    CORS_ORIGIN: z.string().min(1),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    SESSION_SECRET: z.string().min(1),
    APP_VERSION: z.string().default('dev'),
    // Opcionales a la vez: sin ninguno de los dos, el panel de gestión queda desactivado (ADR 0015).
    ADMIN_USERNAME: z.string().min(1).optional(),
    ADMIN_PASSWORD_HASH: z
      .string()
      .refine(isAdminPasswordHash, 'debe salir de `pnpm --filter @pp/api admin:hash-password`')
      .optional(),
  })
  .refine((env) => (env.ADMIN_USERNAME === undefined) === (env.ADMIN_PASSWORD_HASH === undefined), {
    message: 'ADMIN_USERNAME y ADMIN_PASSWORD_HASH van juntos: o los dos o ninguno.',
    path: ['ADMIN_PASSWORD_HASH'],
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Configuración de entorno inválida: ${result.error.message}`);
  }
  return result.data;
}
