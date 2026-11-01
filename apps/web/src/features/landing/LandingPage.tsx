import type { JSX, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FeatureCard, Logo, Step } from '../../design-system/index.js';
import { FEATURE_GROUPS, NO_ACCOUNTS, STEPS, SUBTITLE, TAGLINE } from './content.js';
import { DemoTable } from './DemoTable.js';
import { RememberedShortcuts } from './RememberedShortcuts.js';

const APP_VERSION = import.meta.env.VITE_APP_VERSION;
// `.btn` vive fuera de las capas de Tailwind y ganaría a `px-*`/`text-*`: el tamaño grande va en línea.
const CTA_STYLE = { padding: '12px 20px', fontSize: 15 };

/*
 * Página principal en `/` (ADR 0029). No llama a la API para pintarse: la carga al instante aunque
 * Render esté dormido, y el calentamiento que arranca `main.tsx` va despertándola en segundo plano.
 */
export function LandingPage(): JSX.Element {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--color-bg)',
        backgroundImage: [
          'radial-gradient(80% 720px at 50% -160px, color-mix(in srgb, var(--color-accent) 26%, var(--color-bg)) 0%, transparent 72%)',
          'linear-gradient(180deg, var(--color-bg) 0%, var(--color-bg) 35%, color-mix(in srgb, var(--color-accent) 10%, var(--color-bg)) 100%)',
        ].join(', '),
      }}
    >
      <div className="mx-auto flex max-w-[1200px] flex-col px-[18px] lg:px-14">
        <header className="flex items-center justify-between py-3.5 lg:py-[22px]">
          <div className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
            <Logo size={26} />
            <span>Planning Poker</span>
          </div>
          <Link to="/teams/new" className="btn btn-ghost">
            Crear equipo
          </Link>
        </header>

        <main className="flex flex-col">
          <section className="grid items-center gap-[22px] pb-[30px] pt-[18px] lg:grid-cols-2 lg:gap-12 lg:pb-16 lg:pt-12">
            <div className="flex flex-col gap-3.5">
              <h1 className="text-balance text-[30px] lg:text-[44px]">{TAGLINE}</h1>
              <p className="m-0 max-w-[46ch] text-[15px]" style={{ color: 'var(--pp-muted)' }}>
                {SUBTITLE}
              </p>
              <div className="flex flex-wrap gap-2.5">
                <Link to="/games/new" className="btn btn-solid" style={CTA_STYLE}>
                  Crear sala
                </Link>
                <Link to="/teams/new" className="btn btn-secondary" style={CTA_STYLE}>
                  Crear equipo
                </Link>
              </div>
            </div>
            <DemoTable />
          </section>

          <div className="pb-[30px]">
            <RememberedShortcuts />
          </div>

          <LandingSection title="Cómo funciona">
            <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3 md:gap-7">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <Step number={index + 1} title={step.title} description={step.description} />
                </li>
              ))}
            </ol>
          </LandingSection>

          <LandingSection title="Qué puedes hacer">
            <div className="grid gap-[22px] md:grid-cols-2 md:gap-x-10 md:gap-y-8">
              {FEATURE_GROUPS.map((group) => (
                <section key={group.name} className="flex flex-col gap-3">
                  <h3 className="pp-kicker">{group.name}</h3>
                  <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
                    {group.features.map((feature) => (
                      <li key={feature.title} className="flex">
                        <FeatureCard
                          icon={feature.icon}
                          title={feature.title}
                          description={feature.description}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </LandingSection>

          <section
            className="grid gap-2.5 border-t py-7 md:grid-cols-[1fr_2fr] md:items-baseline lg:py-12"
            style={{ borderColor: 'var(--pp-line)' }}
          >
            <h2 className="text-[21px] lg:text-[26px]">Sin cuentas</h2>
            <p className="m-0 max-w-[60ch]" style={{ color: 'var(--pp-muted)' }}>
              {NO_ACCOUNTS}
            </p>
          </section>
        </main>

        <footer
          className="flex justify-between gap-3 border-t pb-[22px] pt-[18px] font-mono text-[11px] font-medium"
          style={{ borderColor: 'var(--pp-line)', color: 'var(--pp-muted)' }}
        >
          <span>Planning Poker · uso interno</span>
          {APP_VERSION ? <span>v{APP_VERSION}</span> : null}
        </footer>
      </div>
    </div>
  );
}

function LandingSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section
      className="flex flex-col gap-4 border-t py-7 lg:gap-[22px] lg:py-12"
      style={{ borderColor: 'var(--pp-line)' }}
    >
      <h2 className="text-[21px] lg:text-[26px]">{title}</h2>
      {children}
    </section>
  );
}
