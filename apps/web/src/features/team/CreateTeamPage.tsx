import { useState } from 'react';
import type { JSX, SubmitEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '../../design-system/index.js';
import { createTeam } from '../../shared/api/teamsClient.js';
import { rememberTeam } from '../../shared/team/rememberedTeams.js';

interface CreatedTeam {
  readonly slug: string;
  readonly token: string;
}

export function CreateTeamPage(): JSX.Element {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedTeam | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await createTeam({ name });
      rememberTeam({ slug: result.slug, name: result.name, token: result.token });
      setCreated({ slug: result.slug, token: result.token });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el equipo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const link = `${window.location.origin}/t/${created.slug}?k=${created.token}`;
    return (
      <div className="mx-auto flex w-[420px] max-w-full flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-lg">Equipo creado</h1>
        <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
          Este enlace es el único acceso a las barajas del equipo: no hay cuenta ni forma de
          recuperarlo si se pierde. Guárdalo donde lo encuentre el equipo.
        </p>
        <div className="pp-input flex items-center justify-between gap-2 font-mono text-xs">
          <span className="truncate">{link}</span>
        </div>
        <Button
          variant="secondary"
          block
          onClick={() => {
            void navigator.clipboard.writeText(link);
          }}
        >
          Copiar enlace
        </Button>
        <Link to={`/t/${created.slug}?k=${created.token}`} className="w-full">
          <Button variant="primary" block>
            Ir a mi equipo
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-[380px] max-w-full flex-col gap-4 py-16">
      <h1 className="text-[22px]">Crear equipo</h1>
      <p className="text-sm" style={{ color: 'var(--pp-muted)' }}>
        Un equipo guarda barajas personalizadas para reutilizarlas en varias partidas. No hace falta
        cuenta: el enlace que recibas al crearlo es tu acceso.
      </p>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <Input
          label="Nombre del equipo"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          required
        />
        {error ? <p style={{ color: '#e5484d' }}>{error}</p> : null}
        <Button type="submit" variant="primary" block disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear equipo'}
        </Button>
      </form>
    </div>
  );
}
