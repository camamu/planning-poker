/**
 * Sonido sintetizado con WebAudio, sin ficheros de audio (docs/06-handoff-diseno.md
 * "Interactions & Behavior" / "Assets"). Cada función recibe `muted` explícito en vez de leer el
 * store directamente: mantiene este módulo puro-de-infraestructura, sin acoplarse a cómo cada
 * feature guarda su ajuste de sonido.
 */

let sharedContext: AudioContext | undefined;

/** Debe llamarse desde un gesto de usuario (clic) — los navegadores bloquean el audio si no. */
function getContext(): AudioContext {
  sharedContext ??= new AudioContext();
  if (sharedContext.state === 'suspended') void sharedContext.resume();
  return sharedContext;
}

function tone(
  ctx: AudioContext,
  frequency: number,
  type: OscillatorType,
  startOffset: number,
  duration: number,
  peakGain = 0.08,
): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  const startAt = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(peakGain, startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

/** Doble clic corto al elegir carta. */
export function playVoteSound(muted: boolean): void {
  if (muted) return;
  const ctx = getContext();
  tone(ctx, 520, 'square', 0, 0.05);
  tone(ctx, 780, 'square', 0.05, 0.05);
}

/** Arpegio ascendente si hay unanimidad; dos notas descendentes si no. */
export function playRevealSound(unanimous: boolean, muted: boolean): void {
  if (muted) return;
  const ctx = getContext();
  const notes = unanimous ? [523, 659, 784, 1047] : [392, 294];
  const step = unanimous ? 0.09 : 0.12;
  notes.forEach((frequency, index) => {
    tone(ctx, frequency, 'triangle', index * step, 0.15);
  });
}

/** Silbido de lanzamiento: barrido descendente 720 → 420Hz. */
export function playThrowSound(muted: boolean): void {
  if (muted) return;
  const ctx = getContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(720, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.62);
  gain.gain.setValueAtTime(0.07, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.62);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.62);
}

/** Golpe grave al impactar un emoji lanzado. */
export function playImpactSound(muted: boolean): void {
  if (muted) return;
  tone(getContext(), 180, 'square', 0, 0.09, 0.1);
}

/** Nota aguda al lanzar una reacción sobre el propio asiento. */
export function playReactionSound(muted: boolean): void {
  if (muted) return;
  tone(getContext(), 880, 'triangle', 0, 0.18, 0.06);
}
