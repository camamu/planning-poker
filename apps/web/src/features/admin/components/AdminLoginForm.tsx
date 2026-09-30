import type { AdminSessionView } from '@pp/contracts';
import { useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { Button, Input } from '../../../design-system/index.js';
import { logInAdmin } from '../../../shared/api/adminClient.js';

export interface AdminLoginFormProps {
  readonly onLoggedIn: (session: AdminSessionView) => void;
}

export function AdminLoginForm({ onLoggedIn }: AdminLoginFormProps): JSX.Element {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      onLoggedIn(await logInAdmin({ username, password }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.');
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-[380px] max-w-full flex-col gap-4 px-4 py-16">
      <h1 className="text-[22px]">Panel de gestión</h1>
      <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
        Acceso restringido a quien administra esta instancia de Planning Poker.
      </p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <Input
          label="Usuario"
          autoComplete="username"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
          }}
          required
        />
        <Input
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          required
        />
        {error ? (
          <p role="alert" style={{ color: '#e5484d' }}>
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" block disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  );
}
