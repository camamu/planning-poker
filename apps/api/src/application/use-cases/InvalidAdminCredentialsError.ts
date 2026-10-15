/** Mismo mensaje para usuario y contraseña incorrectos: distinguirlos permitiría enumerar el usuario. */
export class InvalidAdminCredentialsError extends Error {
  constructor() {
    super('Usuario o contraseña incorrectos.');
    this.name = 'InvalidAdminCredentialsError';
  }
}
