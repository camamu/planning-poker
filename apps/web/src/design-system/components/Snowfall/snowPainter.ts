import { COL } from './snowScene.js';
import type { Ball, SnowScene } from './snowScene.js';

export interface SnowColors {
  readonly snow: string;
  readonly shade: string;
  readonly edge: string;
  /** Contorno para el tema claro, donde la nieve blanca no contrasta. `null` en oscuro. */
  readonly outline: string | null;
}

export function readSnowColors(element: Element): SnowColors {
  const style = getComputedStyle(element);
  const value = (name: string, fallback: string): string =>
    style.getPropertyValue(name).trim() || fallback;
  const outline = value('--pp-snow-outline', 'transparent');
  return {
    snow: value('--pp-snow', '#f6f8ff'),
    shade: value('--pp-snow-shade', '#b6c1e2'),
    edge: value('--pp-snow-edge', 'rgba(255,255,255,.9)'),
    outline: outline === 'transparent' || outline === 'rgba(0, 0, 0, 0)' ? null : outline,
  };
}

const COAL = '#23252e';
const TWIG = '#7a5232';
const CARROT = '#f08a24';

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function line(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number): void {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
}

/** Contorno suavizado de un mapa de alturas; `closed` lo cierra por debajo para rellenarlo. */
function surfacePath(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y: number,
  h: Float32Array,
  closed: boolean,
): void {
  ctx.beginPath();
  let px = x0;
  let py = y - (h[0] ?? 0);
  if (closed) ctx.moveTo(x0, y + 1.5);
  ctx[closed ? 'lineTo' : 'moveTo'](px, py);
  for (let i = 1; i < h.length; i += 1) {
    const cx = x0 + i * COL;
    const cy = y - (h[i] ?? 0);
    ctx.quadraticCurveTo(px, py, (px + cx) / 2, (py + cy) / 2);
    px = cx;
    py = cy;
  }
  ctx.lineTo(px, py);
  if (closed) {
    ctx.lineTo(px, y + 1.5);
    ctx.closePath();
  }
}

function paintGround(ctx: CanvasRenderingContext2D, scene: SnowScene, colors: SnowColors): void {
  const { floor } = scene;
  const gradient = ctx.createLinearGradient(0, floor.y - 30, 0, floor.y);
  gradient.addColorStop(0, colors.snow);
  gradient.addColorStop(1, colors.shade);
  surfacePath(ctx, floor.x0, floor.y, floor.h, true);
  ctx.fillStyle = gradient;
  ctx.fill();
  surfacePath(ctx, floor.x0, floor.y, floor.h, false);
  ctx.strokeStyle = colors.edge;
  ctx.lineWidth = 1;
  ctx.stroke();
  for (const cap of scene.caps) {
    surfacePath(ctx, cap.x0, cap.y, cap.h, true);
    ctx.fillStyle = colors.snow;
    ctx.fill();
    if (!colors.outline) continue;
    surfacePath(ctx, cap.x0, cap.y, cap.h, false);
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function paintBall(
  ctx: CanvasRenderingContext2D,
  ball: Ball,
  colors: SnowColors,
  shadow: boolean,
): void {
  const { x, y, r } = ball;
  if (shadow) {
    ctx.fillStyle = colors.outline ? 'rgba(60,70,120,.16)' : 'rgba(10,12,30,.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.9, r * 0.95, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const gradient = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r);
  gradient.addColorStop(0, colors.snow);
  gradient.addColorStop(0.62, colors.snow);
  gradient.addColorStop(1, colors.shade);
  ctx.fillStyle = gradient;
  circle(ctx, x, y, r);
  if (colors.outline) {
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Marcas que giran con la bola: sin ellas no se ve que rueda.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ball.rot);
  ctx.strokeStyle = colors.outline ? 'rgba(93,82,148,.22)' : 'rgba(120,135,185,.35)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k += 1) {
    const angle = k * 2.1;
    ctx.beginPath();
    ctx.arc(r * 0.5 * Math.cos(angle), r * 0.5 * Math.sin(angle), r * 0.22, angle, angle + 1.6);
    ctx.stroke();
  }
  ctx.restore();
}

function paintArms(ctx: CanvasRenderingContext2D, body: Ball): void {
  ctx.strokeStyle = TWIG;
  ctx.lineWidth = Math.max(1.6, body.r * 0.09);
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const sx = body.x + side * body.r * 0.7;
    const sy = body.y - body.r * 0.15;
    const ex = body.x + side * body.r * 1.85;
    const ey = body.y - body.r * 0.85;
    line(ctx, sx, sy, ex, ey);
    const fx = sx + (ex - sx) * 0.7;
    const fy = sy + (ey - sy) * 0.7;
    line(ctx, fx, fy, fx + side * body.r * 0.32, fy - body.r * 0.04);
    line(ctx, ex, ey, ex + side * body.r * 0.1, ey - body.r * 0.3);
  }
}

/** Bufanda del color del avatar de quien hace el muñeco. */
function paintScarf(ctx: CanvasRenderingContext2D, head: Ball, body: Ball, hue: number): void {
  const h = hue.toString();
  const neck = head.y + head.r * 0.86;
  const half = head.r * 1.05;
  const height = Math.max(4, head.r * 0.36);
  ctx.save();
  ctx.translate(head.x + head.r * 0.42, neck);
  ctx.rotate(0.18);
  // Se asigna dos veces: un navegador sin `oklch` en el lienzo ignora el segundo y se queda el hsl.
  ctx.fillStyle = `hsl(${h} 45% 52%)`;
  ctx.fillStyle = `oklch(0.6 0.13 ${h})`;
  ctx.beginPath();
  ctx.roundRect(-height / 2, 0, height, body.r * 0.95, 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = `hsl(${h} 55% 66%)`;
  ctx.fillStyle = `oklch(0.73 0.125 ${h})`;
  ctx.beginPath();
  ctx.roundRect(head.x - half, neck - height / 2, half * 2, height, height / 2);
  ctx.fill();
}

function paintFace(ctx: CanvasRenderingContext2D, head: Ball, body: Ball): void {
  ctx.fillStyle = COAL;
  for (const t of [-0.36, 0.02, 0.4]) {
    circle(ctx, body.x, body.y + body.r * t, Math.max(1.4, body.r * 0.08));
  }
  const eye = Math.max(1.3, head.r * 0.1);
  circle(ctx, head.x - head.r * 0.33, head.y - head.r * 0.2, eye);
  circle(ctx, head.x + head.r * 0.33, head.y - head.r * 0.2, eye);
  ctx.fillStyle = CARROT;
  ctx.beginPath();
  ctx.moveTo(head.x, head.y - head.r * 0.04);
  ctx.lineTo(head.x + head.r * 0.8, head.y + head.r * 0.08);
  ctx.lineTo(head.x, head.y + head.r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COAL;
  for (let k = 0; k < 5; k += 1) {
    const angle = Math.PI * (0.25 + k * 0.125);
    circle(
      ctx,
      head.x + Math.cos(angle) * head.r * 0.5,
      head.y + head.r * 0.02 + Math.sin(angle) * head.r * 0.42,
      Math.max(0.9, head.r * 0.055),
    );
  }
}

function paintSnowman(
  ctx: CanvasRenderingContext2D,
  scene: SnowScene,
  colors: SnowColors,
  hue: number,
): void {
  const [base, body, head] = scene.balls;
  const dressed = scene.deco > 0 && base !== undefined && body !== undefined && head !== undefined;
  if (dressed) {
    ctx.globalAlpha = scene.deco;
    paintArms(ctx, body);
    ctx.globalAlpha = 1;
  }
  scene.balls.forEach((ball, index) => {
    paintBall(ctx, ball, colors, index === 0);
  });
  if (!dressed) return;
  ctx.globalAlpha = scene.deco;
  paintScarf(ctx, head, body, hue);
  paintFace(ctx, head, body);
  ctx.globalAlpha = 1;
}

function paintFlakes(ctx: CanvasRenderingContext2D, scene: SnowScene, colors: SnowColors): void {
  if (scene.flakes.length === 0) return;
  ctx.fillStyle = colors.snow;
  ctx.beginPath();
  for (const flake of scene.flakes) {
    ctx.moveTo(flake.x + flake.r, flake.y);
    ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
  }
  ctx.fill();
  if (!colors.outline) return;
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

export function paintSnow(
  ctx: CanvasRenderingContext2D,
  scene: SnowScene,
  colors: SnowColors,
  snowmanHue: number,
): void {
  ctx.clearRect(0, 0, scene.width, scene.height);
  if (scene.floor.h.length === 0) return;
  paintGround(ctx, scene, colors);
  paintSnowman(ctx, scene, colors, snowmanHue);
  if (scene.rolling) paintBall(ctx, scene.rolling, colors, true);
  paintFlakes(ctx, scene, colors);
}
