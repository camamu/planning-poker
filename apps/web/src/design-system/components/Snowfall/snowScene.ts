/**
 * Física de la nieve sin DOM: copos que caen, montón que cuaja en el suelo, capas sobre otras
 * superficies y el muñeco que se hace rodando bolas por el montón. `Snowfall` la pinta.
 * Todas las medidas en píxeles CSS, con el origen arriba a la izquierda del lienzo.
 */

/** Ancho de cada columna del mapa de alturas. */
export const COL = 3;
/** Altura máxima del montón del suelo: más tapa la fila de mirones. */
export const FLOOR_MAX = 30;
/** Por debajo de este radio la bola se deshace al soltarla. */
export const MIN_BALL_RADIUS = 8;

export interface Span {
  readonly x0: number;
  readonly x1: number;
  readonly y: number;
}

export interface CapSpan extends Span {
  /** Identidad estable de la superficie (el elemento del DOM) para conservar su nieve al medir. */
  readonly key: object;
}

export interface SnowGeometry {
  readonly width: number;
  readonly height: number;
  readonly floor: Span;
  readonly caps: ReadonlyArray<CapSpan>;
}

export interface Surface {
  x0: number;
  x1: number;
  y: number;
  h: Float32Array;
  readonly max: number;
  readonly tapered: boolean;
}

export interface Flake {
  x: number;
  y: number;
  py: number;
  r: number;
  vy: number;
  sway: number;
  freq: number;
  phase: number;
  t: number;
  stick: number;
}

interface BallAnimation {
  readonly fx: number;
  readonly fy: number;
  readonly tx: number;
  readonly ty: number;
  readonly dur: number;
  readonly arc: number;
  t: number;
}

export interface Ball {
  x: number;
  y: number;
  r: number;
  rot: number;
  anim: BallAnimation | null;
}

interface RollingBall extends Ball {
  area: number;
}

interface Melting {
  readonly radii: ReadonlyArray<number>;
  readonly area: number;
  t: number;
}

export type SnowmanStage = 'none' | 'building' | 'complete';
export type ReleaseResult = 'too-small' | 'placed' | 'complete';
export type RollCheck = 'ok' | 'outside' | 'empty' | 'complete';

const at = (h: Float32Array, i: number): number => h[i] ?? 0;
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function resample(old: Float32Array | null, n: number, init: (i: number) => number): Float32Array {
  const h = new Float32Array(n);
  if (old && old.length > 1) {
    for (let i = 0; i < n; i += 1) {
      const p = (i / Math.max(1, n - 1)) * (old.length - 1);
      const a = Math.floor(p);
      const b = Math.min(old.length - 1, a + 1);
      h[i] = lerp(at(old, a), at(old, b), p - a);
    }
  } else {
    for (let i = 0; i < n; i += 1) h[i] = init(i);
  }
  return h;
}

/** Una capa sobre un elemento estrecho se redondea en los extremos, como la nieve de verdad. */
export function allowedHeight(surface: Surface, i: number): number {
  if (!surface.tapered) return surface.max;
  const edge = Math.min(i, surface.h.length - 1 - i) * COL + COL / 2;
  return Math.min(surface.max, 0.6 + edge * 0.45);
}

function deposit(surface: Surface, i: number, area: number): void {
  const add = (j: number, weight: number): void => {
    if (j < 0 || j >= surface.h.length) return;
    surface.h[j] = Math.min(allowedHeight(surface, j), at(surface.h, j) + (area / COL) * weight);
  };
  add(i - 1, 0.25);
  add(i, 0.5);
  add(i + 1, 0.25);
}

/** Desliza la nieve de las pendientes demasiado empinadas hacia la columna vecina. */
export function relax(h: Float32Array, slope: number): void {
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < h.length - 1; i += 1) {
      const d = at(h, i) - at(h, i + 1);
      if (Math.abs(d) <= slope) continue;
      const move = (d - Math.sign(d) * slope) * 0.25;
      h[i] = at(h, i) - move;
      h[i + 1] = at(h, i + 1) + move;
    }
  }
}

export function totalSnow(surface: Surface): number {
  let sum = 0;
  for (let i = 0; i < surface.h.length; i += 1) sum += at(surface.h, i);
  return sum * COL;
}

const ballArea = (r: number): number => Math.PI * r * r;

export class SnowScene {
  width = 0;
  height = 0;
  floor: Surface = { x0: 0, x1: 0, y: 0, h: new Float32Array(0), max: FLOOR_MAX, tapered: false };
  caps: Surface[] = [];
  readonly flakes: Flake[] = [];
  balls: Ball[] = [];
  rolling: RollingBall | null = null;
  /** 0→1 mientras aparecen la cara, la ropa y los brazos del muñeco terminado. */
  deco = 0;
  melting: Melting | null = null;
  time = 0;
  private snowmanX = 0;
  /** Posición del muñeco relativa al ancho del suelo: sobrevive a un cambio de tamaño. */
  private snowmanRatio = 0.2;
  private readonly capsByKey = new WeakMap<object, Surface>();

  constructor(private readonly random: () => number = Math.random) {}

  get stage(): SnowmanStage {
    if (this.balls.length === 0) return 'none';
    return this.balls.length >= 3 && !this.melting ? 'complete' : 'building';
  }

  setGeometry(geometry: SnowGeometry): void {
    const previous = this.floor;
    this.width = geometry.width;
    this.height = geometry.height;
    const { x0, x1, y } = geometry.floor;
    const n = Math.max(4, Math.ceil((x1 - x0) / COL));
    const fresh = this.floor.h.length === 0;
    this.floor = {
      x0,
      x1,
      y,
      max: FLOOR_MAX,
      tapered: false,
      h: resample(
        fresh ? null : this.floor.h,
        n,
        (i) => 12 + 3.5 * Math.sin(i * 0.045) + 2.2 * Math.sin(i * 0.13 + 1.3),
      ),
    };
    this.caps = geometry.caps.map((cap) => {
      const cn = Math.max(4, Math.ceil((cap.x1 - cap.x0) / COL));
      const old = this.capsByKey.get(cap.key);
      const surface: Surface = {
        x0: cap.x0,
        x1: cap.x1,
        y: cap.y,
        max: 5,
        tapered: true,
        h: resample(old ? old.h : null, cn, () => 0),
      };
      if (!old) {
        const seed = this.random() * 10;
        for (let i = 0; i < cn; i += 1) {
          surface.h[i] = allowedHeight(surface, i) * (0.72 + 0.18 * Math.sin(i * 0.7 + seed));
        }
      }
      this.capsByKey.set(cap.key, surface);
      return surface;
    });
    const floorMoved =
      Math.abs(previous.x0 - x0) > 0.5 ||
      Math.abs(previous.x1 - x1) > 0.5 ||
      Math.abs(previous.y - y) > 0.5;
    if (this.balls.length > 0 && !fresh && floorMoved) this.layoutSnowman(true);
  }

  setFlakeCount(count: number, spreadOverHeight: boolean): void {
    while (this.flakes.length < count) this.flakes.push(this.newFlake(spreadOverHeight));
    if (this.flakes.length > count) this.flakes.length = count;
  }

  private newFlake(spreadOverHeight: boolean): Flake {
    const flake: Flake = {
      x: 0,
      y: 0,
      py: 0,
      r: 0,
      vy: 0,
      sway: 0,
      freq: 0,
      phase: 0,
      t: 0,
      stick: 0,
    };
    this.respawn(flake);
    if (spreadOverHeight) {
      flake.y = this.random() * Math.max(10, Math.min(this.height, this.floor.y));
      flake.py = flake.y;
    }
    return flake;
  }

  private respawn(flake: Flake): void {
    flake.r = 0.8 + Math.pow(this.random(), 2) * 2.2;
    flake.x = this.random() * (this.width + 40) - 20;
    flake.y = -4 - this.random() * 30;
    flake.py = flake.y;
    flake.vy = 16 + flake.r * 13 + this.random() * 8;
    flake.sway = 6 + this.random() * 14;
    flake.freq = 0.5 + this.random() * 0.9;
    flake.phase = this.random() * Math.PI * 2;
    flake.t = 0;
    flake.stick = this.random();
  }

  column(x: number): number {
    return clamp(Math.floor((x - this.floor.x0) / COL), 0, Math.max(0, this.floor.h.length - 1));
  }

  heightAt(x: number): number {
    return at(this.floor.h, this.column(x));
  }

  /** Lo que mide el muñeco se ajusta al hueco entre el borde de arriba y el suelo. */
  maxBallRadius(): number {
    return clamp((this.floor.y - 60) * 0.055, 14, 28);
  }

  step(dt: number): void {
    this.time += dt;
    for (const flake of this.flakes) this.moveFlake(flake, dt);
    relax(this.floor.h, 1.1);
    for (const cap of this.caps) {
      relax(cap.h, 0.9);
      for (let i = 0; i < cap.h.length; i += 1) {
        cap.h[i] = Math.min(at(cap.h, i), allowedHeight(cap, i));
      }
    }
    for (const ball of this.balls) this.animateBall(ball, dt);
    if (this.stage === 'complete') this.deco = Math.min(1, this.deco + dt / 0.6);
    if (this.melting) this.stepMelt(dt);
  }

  private moveFlake(flake: Flake, dt: number): void {
    flake.py = flake.y;
    flake.t += dt;
    flake.y += flake.vy * dt;
    flake.x += Math.cos(flake.t * flake.freq + flake.phase) * flake.sway * dt;
    if (flake.x < -12) flake.x += this.width + 24;
    else if (flake.x > this.width + 12) flake.x -= this.width + 24;

    // Dos superficies superpuestas en 2D: la mayoría de copos pasan de largo sobre los asientos.
    if (flake.stick < 0.32) {
      for (const cap of this.caps) {
        if (flake.x < cap.x0 || flake.x >= cap.x1) continue;
        const i = Math.min(cap.h.length - 1, Math.floor((flake.x - cap.x0) / COL));
        const top = cap.y - at(cap.h, i);
        if (flake.py <= top && flake.y >= top) {
          deposit(cap, i, ballArea(flake.r) * 0.9);
          this.respawn(flake);
          return;
        }
      }
    }
    if (flake.x >= this.floor.x0 && flake.x < this.floor.x1) {
      const i = this.column(flake.x);
      if (flake.y >= this.floor.y - at(this.floor.h, i)) {
        deposit(this.floor, i, ballArea(flake.r) * 1.2);
        this.respawn(flake);
      }
    } else if (flake.y > this.height + 6) {
      this.respawn(flake);
    }
  }

  canStartRollAt(x: number, y: number): RollCheck {
    if (x < this.floor.x0 || x > this.floor.x1) return 'outside';
    const h = this.heightAt(x);
    if (y < this.floor.y - h - 16 || y > this.floor.y + 4) return 'outside';
    if (this.balls.length >= 3 || this.melting) return 'complete';
    if (h < 2.5) return 'empty';
    return 'ok';
  }

  startRoll(x: number): void {
    const start = clamp(x, this.floor.x0 + 7, this.floor.x1 - 7);
    const area = ballArea(5);
    this.rolling = { x: start, y: 0, r: 5, rot: 0, anim: null, area };
    const i0 = this.column(start - 6);
    const i1 = this.column(start + 6);
    const take = area / COL / (i1 - i0 + 1);
    for (let i = i0; i <= i1; i += 1) this.floor.h[i] = Math.max(0, at(this.floor.h, i) - take);
    this.rolling.y = this.rollingY(this.rolling);
  }

  private rollingY(ball: Ball): number {
    return this.floor.y - this.heightAt(ball.x) - ball.r * 0.85;
  }

  /** Mueve la bola hasta `x`: recoge parte de la nieve que pisa y deja un surco detrás. */
  rollTo(x: number): void {
    const ball = this.rolling;
    if (!ball) return;
    const rMax = this.maxBallRadius();
    const target = clamp(x, this.floor.x0 + ball.r + 2, this.floor.x1 - ball.r - 2);
    const dx = target - ball.x;
    const steps = Math.max(1, Math.ceil(Math.abs(dx) / 2));
    const stepX = dx / steps;
    for (let s = 0; s < steps; s += 1) {
      ball.x += stepX;
      ball.rot += stepX / ball.r;
      if (ball.r >= rMax) continue;
      const span = ball.r * 0.7;
      const i0 = this.column(ball.x - span);
      const i1 = this.column(ball.x + span);
      const fraction = Math.min(0.3, (Math.abs(stepX) / ball.r) * 0.45);
      let gathered = 0;
      for (let i = i0; i <= i1; i += 1) {
        const taken = at(this.floor.h, i) * fraction;
        this.floor.h[i] = at(this.floor.h, i) - taken;
        gathered += taken;
      }
      ball.area += gathered * COL;
      ball.r = Math.min(rMax, Math.sqrt(ball.area / Math.PI));
    }
    ball.y = this.rollingY(ball);
  }

  release(): ReleaseResult | null {
    const ball = this.rolling;
    if (!ball) return null;
    this.rolling = null;
    if (ball.r < MIN_BALL_RADIUS) {
      this.returnSnow(ball.x, ball.area, 12);
      return 'too-small';
    }
    if (this.balls.length === 0) this.snowmanX = ball.x;
    this.balls.push({ x: ball.x, y: ball.y, r: ball.r, rot: ball.rot, anim: null });
    this.balls.sort((a, b) => b.r - a.r);
    this.layoutSnowman(false);
    if (this.balls.length < 3) return 'placed';
    this.deco = 0;
    return 'complete';
  }

  /** Las bolas se apilan de mayor a menor sobre la primera que se soltó. */
  private layoutSnowman(instant: boolean): void {
    const base = this.balls[0];
    if (!base) return;
    const { x0, x1 } = this.floor;
    if (instant) this.snowmanX = lerp(x0, x1, this.snowmanRatio);
    this.snowmanX = clamp(this.snowmanX, x0 + base.r * 2.1 + 4, x1 - base.r * 2.1 - 4);
    this.snowmanRatio = (this.snowmanX - x0) / Math.max(1, x1 - x0);
    let y =
      this.floor.y - Math.min(this.heightAt(this.snowmanX), base.r * 0.6) * 0.6 - base.r * 0.9;
    let below: Ball | null = null;
    for (const ball of this.balls) {
      if (below) y -= (below.r + ball.r) * 0.8;
      below = ball;
      if (instant) {
        ball.x = this.snowmanX;
        ball.y = y;
        ball.anim = null;
        continue;
      }
      const distance = Math.hypot(this.snowmanX - ball.x, y - ball.y);
      ball.anim =
        distance < 0.5
          ? null
          : {
              fx: ball.x,
              fy: ball.y,
              tx: this.snowmanX,
              ty: y,
              t: 0,
              dur: clamp(distance / 420, 0.35, 0.9),
              arc: Math.min(46, distance * 0.35),
            };
    }
  }

  private animateBall(ball: Ball, dt: number): void {
    const anim = ball.anim;
    if (!anim) return;
    anim.t = Math.min(1, anim.t + dt / anim.dur);
    const e = ease(anim.t);
    ball.x = lerp(anim.fx, anim.tx, e);
    ball.y = lerp(anim.fy, anim.ty, e) - Math.sin(Math.PI * anim.t) * anim.arc;
    ball.rot += ((anim.tx - anim.fx) / Math.max(1, ball.r)) * (dt / anim.dur);
    if (anim.t >= 1) {
      ball.x = anim.tx;
      ball.y = anim.ty;
      ball.anim = null;
    }
  }

  /** La cabeza ya en su sitio, para colocar encima el sombrero. `null` si aún no hay muñeco. */
  head(): { readonly x: number; readonly y: number; readonly r: number } | null {
    if (this.stage !== 'complete') return null;
    if (this.balls.some((ball) => ball.anim)) return null;
    const head = this.balls[2];
    return head ? { x: head.x, y: head.y, r: head.r } : null;
  }

  melt(): boolean {
    if (this.balls.length === 0 || this.melting) return false;
    this.melting = {
      radii: this.balls.map((ball) => ball.r),
      area: this.balls.reduce((sum, ball) => sum + ballArea(ball.r), 0),
      t: 0,
    };
    return true;
  }

  private stepMelt(dt: number): void {
    const melting = this.melting;
    if (!melting) return;
    melting.t = Math.min(1, melting.t + dt / 1.5);
    this.deco = Math.max(0, 1 - melting.t * 3);
    this.balls.forEach((ball, index) => {
      ball.r = Math.max(0.5, (melting.radii[index] ?? 0) * Math.pow(1 - melting.t, 0.8));
    });
    this.layoutSnowman(true);
    if (melting.t < 1) return;
    this.returnSnow(this.snowmanX, melting.area * 0.85, (melting.radii[0] ?? 10) * 2.4);
    this.balls = [];
    this.melting = null;
    this.deco = 0;
  }

  /** Devuelve nieve al suelo repartida en campana alrededor de `x`. */
  returnSnow(x: number, area: number, spread: number): void {
    const h = this.floor.h;
    const center = this.column(x);
    const sigma = Math.max(4, spread / COL);
    const weights: number[] = [];
    let sum = 0;
    for (let i = 0; i < h.length; i += 1) {
      const d = i - center;
      const w = Math.exp(-(d * d) / (2 * sigma * sigma));
      weights.push(w);
      sum += w;
    }
    if (sum === 0) return;
    weights.forEach((w, i) => {
      h[i] = at(h, i) + ((area / COL) * w) / sum;
    });
  }
}
