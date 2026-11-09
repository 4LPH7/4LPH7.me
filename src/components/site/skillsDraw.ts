import { cssVar } from "@/lib/theme";
import { MONO } from "@/app/fonts";
import { skillIcons } from "@/data/skillIcons";
import { type Blob, RIM, RIM_DIRS } from "@/lib/foam";

/** Canvas drawing for the toolbox bubbles: soft outlines, glass, icons, plus ripples, pop droplets and the pull. */

const icons = Object.fromEntries(
  Object.entries(skillIcons).map(([k, v]) => [k, { color: v.color, path: typeof Path2D === "undefined" ? null : new Path2D(v.d) }]),
);

export const tintOf = (name: string, light: boolean) => {
  const c = icons[name]?.color;
  return c && c !== "currentColor" ? c : tok(light ? "--skill-tint-light" : "--skill-tint-dark");
};

/** Soap-film hues for the drifting sheen inside each rim. */
const FILM = ["--film-pink", "--film-blue", "--film-teal", "--film-yellow", "--film-violet", "--film-pink"];

const hex = (a: number) => Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");

/** Trace a bubble's springy outline as one smooth closed curve. */
function outline(ctx: CanvasRenderingContext2D, b: Blob) {
  const px = (k: number) => b.x + RIM_DIRS[k % RIM][0] * b.rim[k % RIM];
  const py = (k: number) => b.y + RIM_DIRS[k % RIM][1] * b.rim[k % RIM];
  ctx.beginPath();
  ctx.moveTo((px(RIM - 1) + px(0)) / 2, (py(RIM - 1) + py(0)) / 2);
  for (let k = 0; k < RIM; k++) ctx.quadraticCurveTo(px(k), py(k), (px(k) + px(k + 1)) / 2, (py(k) + py(k + 1)) / 2);
  ctx.closePath();
}

export interface Look {
  name: string;
  light: boolean;
  /** 0..1 hover swell. */
  lift: number;
  /** 1 normal; lower fades a bubble back while another category is in focus. */
  alpha: number;
  /** Shares the focused bubble's category. */
  related: boolean;
  held: boolean;
  t: number;
}

export function drawBubble(ctx: CanvasRenderingContext2D, b: Blob, o: Look) {
  const r = b.r;
  if (r < 2) return;
  const tint = tintOf(o.name, o.light);
  const glow = Math.max(o.lift, o.related ? 0.6 : 0);
  ctx.save();
  ctx.globalAlpha = o.alpha;
  outline(ctx, b);
  const g = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.1, b.x, b.y, r * 1.05);
  g.addColorStop(0, o.light ? tok("--skill-face-top") : o.lift > 0.01 ? tok("--skill-face-lift") : tok("--skill-face-top"));
  g.addColorStop(0.66, tok("--skill-face-mid"));
  g.addColorStop(1, `${tint}${o.light ? "44" : hex(0.25 + glow * 0.25)}`);
  ctx.fillStyle = g;
  ctx.shadowColor = `${tint}${hex(0.33 + glow * 0.35)}`;
  ctx.shadowBlur = o.held ? 34 : 14 + glow * 22;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1 + glow * 1.2;
  ctx.strokeStyle = glow > 0.05 ? `${tint}${hex(0.2 + glow * 0.6)}` : o.light ? "#0b122022" : "#ffffff1c";
  ctx.stroke();

  // inside the outline: a soap-film sheen that drifts round, a soft highlight and a bounce light
  ctx.save();
  ctx.clip();
  if ("createConicGradient" in ctx) {
    const film = ctx.createConicGradient(o.t * 0.4 + b.x * 0.01, b.x, b.y);
    FILM.forEach((c, i) => { film.addColorStop(i / (FILM.length - 1), `${tok(c)}${o.light ? "30" : "26"}`); });
    ctx.strokeStyle = film;
    ctx.lineWidth = 8;
    ctx.stroke();
  }
  const spec = ctx.createRadialGradient(b.x - r * 0.38, b.y - r * 0.5, 0, b.x - r * 0.38, b.y - r * 0.5, r * 0.55);
  spec.addColorStop(0, o.light ? "#ffffffcc" : `rgba(255,255,255,${0.16 + o.lift * 0.14})`);
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.ellipse(b.x - r * 0.32, b.y - r * 0.46, r * 0.5, r * 0.3, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * 0.93, 0.15 * Math.PI, 0.45 * Math.PI);
  ctx.strokeStyle = `${tint}55`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // icon floats up a touch on hover; label underneath
  const icon = icons[o.name];
  const sz = r * 0.62;
  if (icon?.path) {
    ctx.save();
    ctx.translate(b.x - sz / 2, b.y - sz * 0.72 - o.lift * r * 0.07);
    ctx.scale(sz / 24, sz / 24);
    ctx.fillStyle = icon.color === "currentColor" ? tok("--skill-icon-white") : icon.color;
    ctx.fill(icon.path);
    ctx.restore();
  }
  ctx.fillStyle = o.light ? tok("--skill-ink") : o.lift > 0.3 ? tok("--skill-icon-white") : tok("--skill-icon-fallback");
  ctx.font = `600 ${Math.max(9, r * 0.2)}px Supreme, system-ui, sans-serif`;
  ctx.fillText(o.name, b.x, b.y + r * 0.42);
  ctx.restore();
}

/** A small pill above the hovered bubble naming its category. */
export function drawChip(ctx: CanvasRenderingContext2D, b: Blob, text: string, alpha: number) {
  if (alpha < 0.02) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `600 10px ${MONO}`;
  const w = ctx.measureText(text).width + 22;
  const x = b.x - w / 2;
  const y = Math.max(6, b.y - b.r - 30 - (1 - alpha) * 6);
  ctx.beginPath();
  ctx.roundRect(x, y, w, 20, 10);
  ctx.fillStyle = tok("--skill-ink");
  ctx.fill();
  ctx.fillStyle = tok("--skill-ink-inverse");
  ctx.fillText(text, b.x, y + 10.5);
  ctx.restore();
}

export type Ripple = { x: number; y: number; at: number; from: number; to: number; life: number; color: string };
export type Drop = { x: number; y: number; vx: number; vy: number; r: number; age: number; life: number; color: string };

/** Expanding rings (pokes, blasts, pops); finished ones are removed. */
export function drawRipples(ctx: CanvasRenderingContext2D, list: Ripple[], now: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    const u = (now - p.at) / p.life;
    if (u >= 1) { list.splice(i, 1); continue; }
    const e = 1 - (1 - u) ** 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.from + (p.to - p.from) * e, 0, Math.PI * 2);
    ctx.strokeStyle = `${p.color}${hex((1 - u) * 0.7)}`;
    ctx.lineWidth = 2 + (1 - u) * 3;
    ctx.stroke();
  }
}

/** Droplets from a popped bubble: fly out, fall a little, fade. */
export function drawDrops(ctx: CanvasRenderingContext2D, list: Drop[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i];
    d.age += dt;
    if (d.age >= d.life) { list.splice(i, 1); continue; }
    d.vy += 900 * dt;
    d.vx *= Math.exp(-1.5 * dt);
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    const u = d.age / d.life;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r * (1 - u * 0.6), 0, Math.PI * 2);
    ctx.fillStyle = `${d.color}${hex(1 - u)}`;
    ctx.fill();
  }
}

/** The hold-to-pull vortex: a glowing core and dashed rings spinning inward as it charges. */
export function drawPull(ctx: CanvasRenderingContext2D, x: number, y: number, charge: number, t: number) {
  if (charge <= 0) return;
  ctx.save();
  const core = ctx.createRadialGradient(x, y, 0, x, y, 30 + charge * 50);
  core.addColorStop(0, `rgba(96,165,250,${0.35 + charge * 0.4})`);
  core.addColorStop(1, "rgba(59,130,246,0)");
  ctx.fillStyle = core;
  ctx.fillRect(x - 90, y - 90, 180, 180);
  ctx.setLineDash([6, 10]);
  for (let k = 0; k < 3; k++) {
    const r = (28 + k * 26) * (1 - ((t * 0.9 + k / 3) % 1) * 0.35) * (0.7 + charge * 0.5);
    ctx.beginPath();
    ctx.arc(x, y, r, t * (1.5 + k) + k, t * (1.5 + k) + k + Math.PI * 1.6);
    ctx.strokeStyle = `rgba(147,197,253,${charge * (0.5 - k * 0.12)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

const tokenCache = new Map<string, string>();

/** Clears cached token colours; call when the theme changes. */
export function refreshSkillTokens(): void {
  tokenCache.clear();
}

/** A CSS token's current value, read once per theme (never per frame). */
function tok(name: string): string {
  const hit = tokenCache.get(name);
  if (hit !== undefined) return hit;
  const value = cssVar(name);
  tokenCache.set(name, value);
  return value;
}
