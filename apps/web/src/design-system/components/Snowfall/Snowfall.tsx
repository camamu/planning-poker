import type { HatIdView } from '@pp/contracts';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { JSX, Ref, RefObject } from 'react';
import { Hat } from '../Hat/Hat.js';
import { paintSnow, readSnowColors } from './snowPainter.js';
import { SnowScene } from './snowScene.js';
import type { SnowGeometry, SnowmanStage } from './snowScene.js';

export interface SnowfallHandle {
  /** Derrite el muñeco; su nieve vuelve al suelo. */
  readonly melt: () => void;
}

export interface SnowfallProps {
  /** Elemento cuyo borde de abajo hace de suelo: ahí cuaja la nieve y se ruedan las bolas. */
  readonly floorRef: RefObject<HTMLElement | null>;
  /** Elementos, dentro del mismo contenedor, sobre los que se posa una capa de nieve. */
  readonly capSelector?: string;
  /** El muñeco lleva el sombrero y el color de quien lo hace. Sin sombrero, chistera. */
  readonly snowmanHat: HatIdView | null;
  readonly snowmanHue: number;
  readonly onSnowmanChange?: (complete: boolean) => void;
  readonly ref?: Ref<SnowfallHandle>;
}

const MIN_WIDTH_FOR_CAPS = 640;

/** Lo que nunca empieza una bola aunque esté encima del montón. */
const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [data-snow-cap]';

const HINTS = {
  intro: 'Arrastra sobre la nieve para hacer una bola',
  base: 'Base hecha: rueda otra bola y se subirá sola',
  body: 'Ahora la cabeza, un poco más pequeña',
  done: '¡Muñeco listo!',
  tooSmall: 'Esa bola es muy pequeña: rueda un poco más antes de soltar',
  empty: 'Aquí ya no queda nieve: prueba en otro tramo',
  already: 'Ya tienes muñeco. Derrítelo para hacer otro',
} as const;

interface Hint {
  readonly text: string;
  readonly top: number;
}

interface HatPlacement {
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

function measureGeometry(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  floorElement: HTMLElement,
  capSelector: string | undefined,
): SnowGeometry | null {
  const box = canvas.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return null;
  const floor = floorElement.getBoundingClientRect();
  // En pantallas estrechas los elementos se solapan y la nieve encima se ve como rayas sueltas.
  const caps =
    capSelector && box.width >= MIN_WIDTH_FOR_CAPS
      ? Array.from(container.querySelectorAll(capSelector)).map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            key: element,
            x0: rect.left - box.left + 3,
            x1: rect.right - box.left - 3,
            y: rect.top - box.top,
          };
        })
      : [];
  return {
    width: box.width,
    height: box.height,
    floor: { x0: floor.left - box.left, x1: floor.right - box.left, y: floor.bottom - box.top },
    caps,
  };
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  geometry: SnowGeometry,
): void {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.round(geometry.width * ratio);
  const height = Math.round(geometry.height * ratio);
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

/** Sombrero encima de la cabeza del muñeco terminado, o `null` mientras no hay cabeza quieta. */
function hatPlacementOf(scene: SnowScene): HatPlacement | null {
  const head = scene.head();
  if (!head || scene.deco < 0.3) return null;
  const width = head.r * 2.3;
  return { left: head.x - width / 2, top: head.y - head.r - width * 0.6 + head.r * 0.4, width };
}

function samePlacement(a: HatPlacement | null, b: HatPlacement | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5;
}

/**
 * Arrastrar sobre el montón rueda una bola. Se escucha en el contenedor, no en el lienzo, para que
 * el lienzo nunca reciba clics y no tape nada de la mesa.
 */
function attachRolling(
  container: HTMLElement,
  canvas: HTMLCanvasElement,
  scene: SnowScene,
  hint: (text: string) => void,
): () => void {
  let pointerId: number | null = null;
  const local = (event: PointerEvent): { x: number; y: number } => {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const overSnow = (event: PointerEvent): boolean => {
    if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return false;
    const point = local(event);
    return scene.canStartRollAt(point.x, point.y) !== 'outside';
  };

  const onDown = (event: PointerEvent): void => {
    if (event.button !== 0 || pointerId !== null || !overSnow(event)) return;
    const point = local(event);
    const check = scene.canStartRollAt(point.x, point.y);
    if (check !== 'ok') {
      hint(check === 'empty' ? HINTS.empty : HINTS.already);
      return;
    }
    event.preventDefault();
    container.setPointerCapture(event.pointerId);
    pointerId = event.pointerId;
    scene.startRoll(point.x);
  };
  const onMove = (event: PointerEvent): void => {
    if (pointerId === event.pointerId) scene.rollTo(local(event).x);
    else if (pointerId === null) container.style.cursor = overSnow(event) ? 'grab' : '';
  };
  const onUp = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    const result = scene.release();
    if (result === 'too-small') hint(HINTS.tooSmall);
    else if (result === 'complete') hint(HINTS.done);
    else if (result === 'placed') hint(scene.balls.length === 1 ? HINTS.base : HINTS.body);
  };

  const previousTouchAction = container.style.touchAction;
  // Arrastrar en horizontal rueda la bola; en vertical sigue haciendo scroll en el móvil.
  container.style.touchAction = 'pan-y';
  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', onUp);
  return () => {
    container.removeEventListener('pointerdown', onDown);
    container.removeEventListener('pointermove', onMove);
    container.removeEventListener('pointerup', onUp);
    container.removeEventListener('pointercancel', onUp);
    container.style.touchAction = previousTouchAction;
    container.style.cursor = '';
  };
}

/**
 * Nieve que cae sobre el contenedor posicionado más cercano, cuaja en el borde de abajo de
 * `floorRef` y deja hacer un muñeco rodando bolas por el montón. No sabe qué es una mesa ni una
 * partida: solo mide elementos. Ver docs/adr/0031-ambientacion-navidena.md.
 */
export function Snowfall({
  floorRef,
  capSelector,
  snowmanHat,
  snowmanHue,
  onSnowmanChange,
  ref,
}: SnowfallProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SnowScene | null>(null);
  // El bucle de animación vive fuera de React: lee los valores del último render por aquí.
  const latest = useRef({ floorRef, capSelector, snowmanHue, onSnowmanChange });
  const [hint, setHint] = useState<Hint | null>(null);
  const [hatPlacement, setHatPlacement] = useState<HatPlacement | null>(null);

  useEffect(() => {
    latest.current = { floorRef, capSelector, snowmanHue, onSnowmanChange };
  });

  useImperativeHandle(ref, () => ({
    melt: () => {
      sceneRef.current?.melt();
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !container || !ctx) return;

    const scene = new SnowScene();
    sceneRef.current = scene;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let colors = readSnowColors(canvas);
    let hintTimeout: ReturnType<typeof setTimeout> | undefined;
    let lastStage: SnowmanStage = 'none';
    let lastHat: HatPlacement | null = null;
    let measured = false;
    let frame = 0;

    const showHint = (text: string, ms = 2800): void => {
      setHint({ text, top: scene.floor.y - 64 });
      clearTimeout(hintTimeout);
      hintTimeout = setTimeout(() => {
        setHint(null);
      }, ms);
    };

    const measure = (): void => {
      const floorElement = latest.current.floorRef.current;
      if (!floorElement) return;
      const geometry = measureGeometry(canvas, container, floorElement, latest.current.capSelector);
      if (!geometry) return;
      resizeCanvas(canvas, ctx, geometry);
      scene.setGeometry(geometry);
      const density = Math.max(0.45, Math.min(1.2, geometry.width / 1000));
      scene.setFlakeCount(reducedMotion ? 0 : Math.round(90 * density), !measured);
      colors = readSnowColors(canvas);
      if (!measured) showHint(HINTS.intro, 9000);
      measured = true;
    };

    const syncSnowman = (): void => {
      const stage = scene.stage;
      if (stage !== lastStage && (stage === 'complete' || lastStage === 'complete')) {
        latest.current.onSnowmanChange?.(stage === 'complete');
      }
      lastStage = stage;
      const next = hatPlacementOf(scene);
      if (!samePlacement(next, lastHat)) {
        lastHat = next;
        setHatPlacement(next);
      }
    };

    let last = performance.now();
    const tick = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        scene.step(dt);
        paintSnow(ctx, scene, colors, latest.current.snowmanHue);
        syncSnowman();
      }
      frame = requestAnimationFrame(tick);
    };

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    // Los asientos se mueven cuando alguien entra o sale: se vuelven a medir cada poco.
    const remeasure = setInterval(measure, 700);
    const detachRolling = attachRolling(container, canvas, scene, (text) => {
      showHint(text);
    });
    measure();
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      clearInterval(remeasure);
      clearTimeout(hintTimeout);
      resizeObserver.disconnect();
      detachRolling();
      sceneRef.current = null;
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      />
      {hatPlacement ? (
        <span
          className="pointer-events-none absolute z-20"
          style={{ left: hatPlacement.left, top: hatPlacement.top }}
          aria-hidden="true"
        >
          <Hat hat={snowmanHat ?? 'top-hat'} width={hatPlacement.width} />
        </span>
      ) : null}
      {hint ? (
        <div
          role="status"
          className="pointer-events-none absolute left-4 z-20 rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{
            top: hint.top,
            background: 'var(--color-accent)',
            color: 'var(--pp-on-accent)',
            boxShadow: '0 6px 18px rgba(0,0,0,.3)',
          }}
        >
          {hint.text}
        </div>
      ) : null}
    </>
  );
}
