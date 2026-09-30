/** Única cuenta del panel de gestión, configurada por entorno (ADR 0015) — no hay tabla de usuarios. */
export interface AdminCredentials {
  matches(username: string, password: string): Promise<boolean>;
}
