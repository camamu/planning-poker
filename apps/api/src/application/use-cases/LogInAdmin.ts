import type { AdminSessionView } from '@pp/contracts';
import type { Clock } from '../../domain/shared/Clock.js';
import type { AdminCredentials } from '../ports/AdminCredentials.js';
import type { AdminSessions } from '../ports/AdminSessions.js';
import { InvalidAdminCredentialsError } from './InvalidAdminCredentialsError.js';

export interface LogInAdminCommand {
  readonly username: string;
  readonly password: string;
}

export class LogInAdmin {
  constructor(
    private readonly credentials: AdminCredentials,
    private readonly sessions: AdminSessions,
    private readonly clock: Clock,
  ) {}

  async execute(command: LogInAdminCommand): Promise<AdminSessionView> {
    if (!(await this.credentials.matches(command.username, command.password))) {
      throw new InvalidAdminCredentialsError();
    }
    const session = this.sessions.issue(this.clock.now());
    return { token: session.token, expiresAt: session.expiresAt.toISOString() };
  }
}
