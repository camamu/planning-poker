import { createContext, useContext } from 'react';
import type { JSX, ReactNode } from 'react';

export interface ParticipantIdentity {
  readonly participantId: string;
  readonly displayName: string;
}

const ParticipantIdContext = createContext<ParticipantIdentity | null>(null);

function storageKey(gameId: string): string {
  return `pp:participant:${gameId}`;
}

/** Sin cuentas: la identidad del participante se recuerda por partida en localStorage. */
export function saveParticipantIdentity(gameId: string, identity: ParticipantIdentity): void {
  localStorage.setItem(storageKey(gameId), JSON.stringify(identity));
}

export function loadParticipantIdentity(gameId: string): ParticipantIdentity | null {
  const raw = localStorage.getItem(storageKey(gameId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ParticipantIdentity;
  } catch {
    return null;
  }
}

export function clearParticipantIdentity(gameId: string): void {
  localStorage.removeItem(storageKey(gameId));
}

export interface ParticipantIdProviderProps {
  readonly gameId: string;
  readonly children: ReactNode;
}

export function ParticipantIdProvider({
  gameId,
  children,
}: ParticipantIdProviderProps): JSX.Element {
  return (
    <ParticipantIdContext.Provider value={loadParticipantIdentity(gameId)}>
      {children}
    </ParticipantIdContext.Provider>
  );
}

export function useParticipantIdentity(): ParticipantIdentity | null {
  return useContext(ParticipantIdContext);
}
