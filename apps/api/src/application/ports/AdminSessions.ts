export interface AdminSession {
  readonly token: string;
  readonly expiresAt: Date;
}

export interface AdminSessions {
  issue(now: Date): AdminSession;
  isValid(token: string, now: Date): boolean;
}
