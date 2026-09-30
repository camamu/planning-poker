import type { AdminSessionView } from '@pp/contracts';
import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { Button, Input, Tabs } from '../../design-system/index.js';
import {
  clearAdminSession,
  loadAdminSession,
  saveAdminSession,
} from '../../shared/admin/adminSession.js';
import { AdminLoginForm } from './components/AdminLoginForm.js';
import { DecksSection } from './components/DecksSection.js';
import { GamesSection } from './components/GamesSection.js';
import { TeamsSection } from './components/TeamsSection.js';

type Section = 'games' | 'teams' | 'decks';

const SECTIONS: ReadonlyArray<{ readonly value: Section; readonly label: string }> = [
  { value: 'games', label: 'Salas' },
  { value: 'teams', label: 'Equipos' },
  { value: 'decks', label: 'Barajas' },
];

function isSection(value: string): value is Section {
  return SECTIONS.some((section) => section.value === value);
}

/** `/admin` — gestión de salas, equipos y barajas de toda la instancia (ADR 0015). */
export function AdminPage(): JSX.Element {
  const [session, setSession] = useState<AdminSessionView | null>(() => loadAdminSession());
  const [section, setSection] = useState<Section>('games');
  const [query, setQuery] = useState('');

  const logOut = useCallback(() => {
    clearAdminSession();
    setSession(null);
  }, []);

  if (!session) {
    return (
      <AdminLoginForm
        onLoggedIn={(created) => {
          saveAdminSession(created);
          setSession(created);
        }}
      />
    );
  }

  const sectionProps = { token: session.token, query, onUnauthorized: logOut };

  return (
    <div className="mx-auto flex w-[720px] max-w-full flex-col gap-4 px-4 py-12">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-[22px]">Panel de gestión</h1>
        <Button variant="ghost" onClick={logOut}>
          Cerrar sesión
        </Button>
      </header>
      <Tabs
        items={SECTIONS}
        value={section}
        onChange={(value) => {
          if (isSection(value)) setSection(value);
        }}
      />
      <Input
        type="search"
        aria-label="Buscar"
        placeholder="Buscar por nombre…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      {section === 'games' ? <GamesSection {...sectionProps} /> : null}
      {section === 'teams' ? <TeamsSection {...sectionProps} /> : null}
      {section === 'decks' ? <DecksSection {...sectionProps} /> : null}
    </div>
  );
}
