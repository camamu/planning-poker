import type { IconName } from '../../design-system/index.js';

/*
 * Lo que anuncia la página principal. Regla (ADR 0029): solo lo que ya existe. Cada bloque que
 * entregue algo visible añade aquí su línea en la misma PR.
 */

export const TAGLINE = 'Estimad tareas en equipo sin anclaros en el voto de nadie';
export const SUBTITLE =
  'Planning poker en tiempo real. Cada uno elige su carta a ciegas y se revelan todas a la vez.';

export interface StepContent {
  readonly title: string;
  readonly description: string;
}

export const STEPS: ReadonlyArray<StepContent> = [
  { title: 'Crea la sala', description: 'Comparte el enlace o el QR con el equipo.' },
  {
    title: 'Cada uno elige su carta',
    description: 'Oculta: nadie se ancla en el voto de otro.',
  },
  { title: 'Se revelan a la vez', description: 'Veis el reparto y acordáis la estimación.' },
];

export interface FeatureContent {
  readonly icon: IconName;
  readonly title: string;
  readonly description: string;
}

export interface FeatureGroupContent {
  readonly name: string;
  readonly features: ReadonlyArray<FeatureContent>;
}

export const FEATURE_GROUPS: ReadonlyArray<FeatureGroupContent> = [
  {
    name: 'Votación',
    features: [
      {
        icon: 'eye',
        title: 'Votos ocultos',
        description: 'Nadie ve tu carta hasta que se revelan todas.',
      },
      {
        icon: 'flip',
        title: 'Revelado a la vez',
        description: 'Todas las cartas se dan la vuelta en el mismo instante.',
      },
      {
        icon: 'bolt',
        title: 'Auto-revelado',
        description: 'Se revela solo cuando han votado todos los presentes.',
      },
      {
        icon: 'timer',
        title: 'Cuenta atrás',
        description: 'Un tiempo límite para votar, si lo queréis.',
      },
      { icon: 'play', title: 'Votar ya', description: 'Abre una ronda sin crear antes la tarea.' },
      {
        icon: 'repeat',
        title: 'Volver a votar',
        description: 'Repite la ronda sobre la misma tarea tras discutir.',
      },
      {
        icon: 'moon',
        title: 'Votación en diferido',
        description: 'Deja tareas abiertas y cada uno vota cuando puede.',
      },
    ],
  },
  {
    name: 'Resultados',
    features: [
      {
        icon: 'bars',
        title: 'Distribución y media',
        description: 'Cuántos votaron cada carta y la media de la ronda.',
      },
      {
        icon: 'percent',
        title: 'Porcentaje de acuerdo',
        description: 'Cuántos coincidieron con la carta más votada.',
      },
      {
        icon: 'spark',
        title: 'Confeti con unanimidad',
        description: 'Si todos coincidís, se celebra.',
      },
      {
        icon: 'feather',
        title: 'Pluma y capa',
        description: 'Señalan el voto más alto y el más bajo.',
      },
      {
        icon: 'compare',
        title: 'Comparar rondas',
        description: 'Al volver a votar, ves cómo se movieron los votos.',
      },
      {
        icon: 'doc',
        title: 'Resumen de sesión',
        description: 'Estimaciones, rondas y tiempos de toda la partida.',
      },
      {
        icon: 'download',
        title: 'CSV y Markdown',
        description: 'Descarga el resumen o cópialo para pegarlo.',
      },
    ],
  },
  {
    name: 'Sala',
    features: [
      { icon: 'glasses', title: 'Espectadores', description: 'Seguir la partida sin votar.' },
      {
        icon: 'hourglass',
        title: 'Temporizador de discusión',
        description: 'Acota el debate entre rondas.',
      },
      {
        icon: 'smile',
        title: 'Emojis',
        description: 'Lánzalos a la mesa o a alguien en concreto.',
      },
      { icon: 'hat', title: 'Sombreros', description: 'Uno para cada avatar.' },
      {
        icon: 'deal',
        title: 'Quién reparte',
        description: 'El turno de presentar la tarea va rotando.',
      },
      {
        icon: 'swap',
        title: 'Cambiar de baraja',
        description: 'Entre rondas, sin salir de la sala.',
      },
      {
        icon: 'presence',
        title: 'Presencia en tiempo real',
        description: 'Ves quién sigue conectado.',
      },
      {
        icon: 'crown',
        title: 'Ceder la facilitación',
        description: 'Pasa el rol, o tómalo si quien facilitaba se fue.',
      },
      { icon: 'list', title: 'Cola de tareas', description: 'Añade, edita, borra y reordena.' },
      {
        icon: 'import',
        title: 'Importar tareas',
        description: 'Pega texto, un CSV o enlaces de tu gestor.',
      },
    ],
  },
  {
    name: 'Equipos',
    features: [
      {
        icon: 'palette',
        title: 'Barajas propias',
        description: 'Crea y edita las barajas del equipo.',
      },
      {
        icon: 'link',
        title: 'Enlace privado',
        description: 'El equipo se guarda en un enlace, sin cuentas.',
      },
      {
        icon: 'history',
        title: 'Histórico de partidas',
        description: 'Las sesiones anteriores del equipo, por fecha.',
      },
      {
        icon: 'webhook',
        title: 'Webhooks',
        description: 'Lleva las estimaciones a Jira, n8n o lo que uséis.',
      },
    ],
  },
];

export const NO_ACCOUNTS =
  'Se entra con un enlace y un nombre. Nada de contraseñas ni registros. Un equipo se guarda con su propio enlace privado: quien lo tiene, gestiona sus barajas y su histórico.';
