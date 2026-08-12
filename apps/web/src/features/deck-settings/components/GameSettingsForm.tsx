import type { WhoCanRevealView } from '@pp/contracts';
import type { JSX } from 'react';
import { SegmentedControl, Select, Switch } from '../../../design-system/index.js';

export interface GameSettingsFormValue {
  readonly autoReveal: boolean;
  readonly whoCanReveal: WhoCanRevealView;
  readonly allowVoteChange: boolean;
  readonly celebrate: boolean;
  readonly throwEmojis: boolean;
  readonly countdownSeconds: number | null;
  readonly revealOnTimeout: boolean;
}

export const DEFAULT_SETTINGS: GameSettingsFormValue = {
  autoReveal: true,
  whoCanReveal: 'ANYONE',
  allowVoteChange: true,
  celebrate: true,
  throwEmojis: false,
  countdownSeconds: null,
  revealOnTimeout: false,
};

export interface GameSettingsFormProps {
  readonly value: GameSettingsFormValue;
  readonly onChange: (value: GameSettingsFormValue) => void;
}

const COUNTDOWN_OPTIONS = [
  { value: 'none', label: 'Sin límite' },
  { value: '45', label: '0:45' },
  { value: '90', label: '1:30' },
  { value: '180', label: '3:00' },
];

const WHO_CAN_REVEAL_OPTIONS: ReadonlyArray<{ value: WhoCanRevealView; label: string }> = [
  { value: 'ANYONE', label: 'Cualquiera' },
  { value: 'DEALER', label: 'Solo el dealer' },
  { value: 'FACILITATOR_ONLY', label: 'Quien creó' },
];

/** Reutilizado por create-game (colapsado) y por la pantalla de ajustes de deck-settings. */
export function GameSettingsForm({ value, onChange }: GameSettingsFormProps): JSX.Element {
  function set<K extends keyof GameSettingsFormValue>(
    key: K,
    fieldValue: GameSettingsFormValue[K],
  ): void {
    onChange({ ...value, [key]: fieldValue });
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingRow label="Auto-revelar">
        <Switch
          checked={value.autoReveal}
          onChange={(checked) => {
            set('autoReveal', checked);
          }}
          aria-label="Auto-revelar"
        />
      </SettingRow>
      <SettingRow label="Cambiar el voto tras votar">
        <Switch
          checked={value.allowVoteChange}
          onChange={(checked) => {
            set('allowVoteChange', checked);
          }}
          aria-label="Cambiar el voto tras votar"
        />
      </SettingRow>
      <SettingRow label="Fiesta al haber unanimidad">
        <Switch
          checked={value.celebrate}
          onChange={(checked) => {
            set('celebrate', checked);
          }}
          aria-label="Fiesta al haber unanimidad"
        />
      </SettingRow>
      <SettingRow label="Emojis lanzados">
        <Switch
          checked={value.throwEmojis}
          onChange={(checked) => {
            set('throwEmojis', checked);
          }}
          aria-label="Emojis lanzados"
        />
      </SettingRow>

      <div className="field">
        <label>¿Quién puede revelar?</label>
        <SegmentedControl<WhoCanRevealView>
          name="whoCanReveal"
          value={value.whoCanReveal}
          onChange={(next) => {
            set('whoCanReveal', next);
          }}
          options={WHO_CAN_REVEAL_OPTIONS}
        />
      </div>

      <Select
        label="Cuenta atrás por tarea"
        options={COUNTDOWN_OPTIONS}
        value={value.countdownSeconds === null ? 'none' : value.countdownSeconds.toString()}
        onChange={(event) => {
          const raw = event.target.value;
          set('countdownSeconds', raw === 'none' ? null : Number(raw));
        }}
      />

      {value.countdownSeconds !== null ? (
        <SettingRow label="Al llegar a cero, revelar igualmente">
          <Switch
            checked={value.revealOnTimeout}
            onChange={(checked) => {
              set('revealOnTimeout', checked);
            }}
            aria-label="Al llegar a cero, revelar igualmente"
          />
        </SettingRow>
      ) : null}
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}
