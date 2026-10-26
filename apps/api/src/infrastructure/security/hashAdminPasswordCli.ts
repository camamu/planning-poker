import { createInterface } from 'node:readline/promises';
import { hashAdminPassword } from './ScryptAdminCredentials.js';

/** `pnpm --filter @pp/api admin:hash-password` — genera el valor de `ADMIN_PASSWORD_HASH`. */
const readline = createInterface({ input: process.stdin, output: process.stderr });
const password = await readline.question('Contraseña del panel de gestión: ');
readline.close();

if (password.length < 12) {
  console.error('La contraseña debe tener al menos 12 caracteres.');
  process.exitCode = 1;
} else {
  console.log(await hashAdminPassword(password));
}
