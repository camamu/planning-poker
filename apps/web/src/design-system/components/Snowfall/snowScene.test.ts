import { describe, expect, it } from 'vitest';
import { FLOOR_MAX, MIN_BALL_RADIUS, SnowScene, totalSnow } from './snowScene.js';

function seeded(seed = 7): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function scene(): SnowScene {
  const snow = new SnowScene(seeded());
  snow.setGeometry({ width: 800, height: 600, floor: { x0: 0, x1: 800, y: 560 }, caps: [] });
  return snow;
}

function roll(snow: SnowScene, from: number, to: number): void {
  snow.startRoll(from);
  const step = from < to ? 4 : -4;
  for (let x = from; from < to ? x <= to : x >= to; x += step) snow.rollTo(x);
}

const ballArea = (r: number): number => Math.PI * r * r;

describe('nieve que cae', () => {
  it('se acumula en el suelo sin pasar de la altura máxima', () => {
    const snow = scene();
    snow.setFlakeCount(400, true);
    for (let t = 0; t < 2000; t += 1) snow.step(1 / 30);

    expect(Math.max(...snow.floor.h)).toBeLessThanOrEqual(FLOOR_MAX + 0.001);
  });

  it('empieza con el suelo ya nevado, para poder hacer el muñeco nada más entrar', () => {
    expect(Math.min(...scene().floor.h)).toBeGreaterThan(5);
  });
});

describe('muñeco de nieve', () => {
  it('la bola crece con la nieve que recoge y el suelo pierde exactamente esa nieve', () => {
    const snow = scene();
    const before = totalSnow(snow.floor);

    roll(snow, 500, 300);
    const ball = snow.rolling;

    expect(ball?.r ?? 0).toBeGreaterThan(MIN_BALL_RADIUS);
    expect(before - totalSnow(snow.floor)).toBeCloseTo(ballArea(ball?.r ?? 0), 0);
  });

  it('una bola demasiado pequeña se deshace y devuelve la nieve al suelo', () => {
    const snow = scene();
    const before = totalSnow(snow.floor);

    snow.startRoll(400);
    expect(snow.release()).toBe('too-small');
    expect(snow.balls).toHaveLength(0);
    expect(totalSnow(snow.floor)).toBeCloseTo(before, 0);
  });

  it('tres bolas se apilan solas de mayor a menor, sea cual sea el orden', () => {
    const snow = scene();
    roll(snow, 100, 160);
    expect(snow.release()).toBe('placed');
    roll(snow, 700, 400);
    expect(snow.release()).toBe('placed');
    roll(snow, 300, 220);
    expect(snow.release()).toBe('complete');
    for (let t = 0; t < 60; t += 1) snow.step(1 / 30);

    const [base, body, head] = snow.balls;
    expect(base && body && head).toBeTruthy();
    if (!base || !body || !head) return;
    expect(base.r).toBeGreaterThan(body.r);
    expect(body.r).toBeGreaterThan(head.r);
    expect(body.x).toBeCloseTo(base.x);
    expect(head.x).toBeCloseTo(base.x);
    expect(base.y).toBeGreaterThan(body.y);
    expect(body.y).toBeGreaterThan(head.y);
    expect(snow.stage).toBe('complete');
    expect(snow.head()).not.toBeNull();
  });

  it('con el muñeco hecho no se empieza otra bola', () => {
    const snow = scene();
    for (const [from, to] of [
      [100, 300],
      [450, 600],
      [650, 750],
    ] as const) {
      roll(snow, from, to);
      snow.release();
    }

    expect(snow.canStartRollAt(400, 555)).toBe('complete');
  });

  it('al derretirse vuelve al suelo casi toda su nieve', () => {
    const snow = scene();
    roll(snow, 500, 250);
    snow.release();
    const before = totalSnow(snow.floor) + snow.balls.reduce((s, b) => s + ballArea(b.r), 0);

    expect(snow.melt()).toBe(true);
    for (let t = 0; t < 120; t += 1) snow.step(1 / 30);

    expect(snow.balls).toHaveLength(0);
    expect(snow.stage).toBe('none');
    expect(totalSnow(snow.floor)).toBeGreaterThan(before * 0.85);
  });

  it('solo se empieza a rodar pulsando sobre el montón del suelo', () => {
    const snow = scene();

    expect(snow.canStartRollAt(400, 555)).toBe('ok');
    expect(snow.canStartRollAt(400, 200)).toBe('outside');
  });
});
