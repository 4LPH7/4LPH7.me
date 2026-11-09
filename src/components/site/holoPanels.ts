import { themeColor } from "@/lib/theme";
import * as THREE from "three";
import { MONO } from "@/app/fonts";

/** Canvas-drawn contents for the hologram panels around the droid. Each `draw` repaints and flags the texture. */

export type Panel = { tex: THREE.CanvasTexture; draw: (t: number, heat: number) => void };

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { ctx, tex, w, h };
}

/** Glass frame with corner brackets and scanlines, in the panel's colour. */
function frame(ctx: CanvasRenderingContext2D, w: number, h: number, rgb: string, heat: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = `rgba(${rgb},${0.07 + heat * 0.05})`;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = `rgba(${rgb},${0.55 + heat * 0.4})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  ctx.lineWidth = 6;
  const L = 26;
  for (const [x, y, dx, dy] of [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * L, y + dy * 3);
    ctx.lineTo(x + dx * 3, y + dy * 3);
    ctx.lineTo(x + dx * 3, y + dy * L);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(${rgb},0.06)`;
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
}

const TERMINAL = [
  "$ ssh k2so@4lph7.me", "[+] handshake ok  (ed25519)", "$ nmap -sV 10.0.0.0/24", "PORT    STATE  SERVICE", "22/tcp  open   ssh",
  "443/tcp open   https", "$ ./scan --deep --quiet", "[*] 1,024 packets inspected", "[!] anomaly in auth.log", "[+] patched in 0.42s",
  "$ git push origin main", "To github.com:4LPH7/portfolio", "   a99f316..f897066  main -> main", "$ python portfolioiq.py --rebalance",
  "[*] signals: 3 BUY  1 HOLD", "$ sudo systemctl restart palworld", "[+] server online  (8 players)", "$ echo \"I'll be there for you\"",
];

/** Green-on-black terminal; new lines arrive faster while the droid types. */
export function terminalPanel(): Panel {
  const c = canvas(512, 360);
  let shown = 0;
  let acc = 0;
  let last = 0;
  return {
    tex: c.tex,
    draw(t, heat) {
      const { ctx, w, h } = c;
      acc += (t - last) * (2.2 + heat * 4);
      last = t;
      if (acc > 1) { shown++; acc = 0; }
      frame(ctx, w, h, "94,234,212", heat);
      ctx.font = `600 22px ${MONO}`;
      ctx.fillStyle = "rgba(94,234,212,0.9)";
      ctx.fillText("● ● ●   k2so@4lph7: ~", 20, 34);
      const rows = 11;
      for (let i = 0; i < rows; i++) {
        const n = shown - rows + 1 + i;
        if (n < 0) continue;
        const line = TERMINAL[n % TERMINAL.length];
        ctx.fillStyle = line.startsWith("[!]") ? "rgba(255,255,255,0.95)" : line.startsWith("$") ? "rgba(236,254,255,0.95)" : "rgba(94,234,212,0.78)";
        ctx.fillText(line, 20, 72 + i * 26);
      }
      if (Math.floor(t * 2) % 2) ctx.fillRect(20 + 14, 72 + (rows - 1) * 26 + 6, 12, 4);
      c.tex.needsUpdate = true;
    },
  };
}

const CODE = [
  ["const ", "droid", " = await ", "boot", "(", "\"K-2SO\"", ");"], ["if ", "(", "threat", ".level > ", "0.7", ") {"],
  ["  ", "shield", ".", "raise", "();"], ["}"], ["for ", "(const ", "pkt", " of ", "stream", ") {"],
  ["  ", "verify", "(pkt.", "sig", ", ", "key", ");"], ["}"], ["export ", "default ", "ship", ";"], ["// TODO: be nicer to humans"],
];
const CODE_TOKENS = ["--holo-cyan", "--holo-ink", "--holo-cyan", "--holo-sky", "--holo-ink", "--holo-mist", "--holo-ink"];
let codeColorCache: string[] | null = null;
function codeColor(i: number): string {
  codeColorCache ??= CODE_TOKENS.map(themeColor);
  return codeColorCache[i];
}

/** Cyan code hologram scrolling upward. */
export function codePanel(): Panel {
  const c = canvas(512, 384);
  return {
    tex: c.tex,
    draw(t, heat) {
      const { ctx, w, h } = c;
      frame(ctx, w, h, "34,211,238", heat);
      ctx.font = `600 21px ${MONO}`;
      const scroll = (t * 26) % 30;
      for (let i = 0; i < 14; i++) {
        const y = 40 + i * 30 - scroll;
        if (y < 24 || y > h - 12) continue;
        const parts = CODE[(Math.floor(t * 26 / 30) + i) % CODE.length];
        let x = 22;
        ctx.globalAlpha = parts[0].startsWith("//") ? 0.45 : 0.9;
        parts.forEach((p, k) => { ctx.fillStyle = parts[0].startsWith("//") ? themeColor("--holo-muted") : codeColor(k % CODE_TOKENS.length); ctx.fillText(p, x, y); x += ctx.measureText(p).width; });
        ctx.globalAlpha = 1;
      }
      c.tex.needsUpdate = true;
    },
  };
}

/** Radar HUD with a sweep and blips. */
export function radarPanel(): Panel {
  const c = canvas(320, 320);
  return {
    tex: c.tex,
    draw(t, heat) {
      const { ctx, w, h } = c;
      frame(ctx, w, h, "34,211,238", heat);
      const cx = w / 2, cy = h / 2 + 8, R = 118;
      ctx.strokeStyle = "rgba(34,211,238,0.45)";
      ctx.lineWidth = 2;
      for (const r of [R, R * 0.66, R * 0.33]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
      const a = t * 1.6;
      const g = ctx.createConicGradient(a - 0.9, cx, cy);
      g.addColorStop(0, "rgba(34,211,238,0)");
      g.addColorStop(0.14, "rgba(34,211,238,0.4)");
      g.addColorStop(0.145, "rgba(34,211,238,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 5; k++) {
        const ba = k * 1.9 + 0.4, br = R * (0.3 + ((k * 37) % 60) / 100);
        const age = ((a - ba) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        ctx.fillStyle = `rgba(224,242,254,${Math.max(0, 1 - age / 3)})`;
        ctx.beginPath(); ctx.arc(cx + Math.cos(ba) * br, cy + Math.sin(ba) * br, 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.font = `600 18px ${MONO}`;
      ctx.fillStyle = "rgba(125,211,252,0.9)";
      ctx.fillText("NET SCAN", 18, 30);
      c.tex.needsUpdate = true;
    },
  };
}

/** Tall panel of falling glyphs. */
export function rainPanel(): Panel {
  const c = canvas(256, 448);
  const cols = 14;
  const drops = Array.from({ length: cols }, (_, i) => ((i * 53) % 29) * 16);
  const glyphs = "01アイウエオカキクケコ<>/{}#$%=";
  let last = 0;
  return {
    tex: c.tex,
    draw(t, heat) {
      const { ctx, w, h } = c;
      const dt = Math.min(0.1, t - last);
      last = t;
      frame(ctx, w, h, "34,211,238", heat);
      ctx.font = `600 17px ${MONO}`;
      for (let i = 0; i < cols; i++) {
        drops[i] = (drops[i] + dt * (90 + (i % 5) * 25)) % (h + 160);
        for (let k = 0; k < 9; k++) {
          const y = drops[i] - k * 18;
          if (y < 16 || y > h - 8) continue;
          ctx.fillStyle = k === 0 ? "rgba(236,254,255,0.95)" : `rgba(34,211,238,${0.75 - k * 0.08})`;
          ctx.fillText(glyphs[(i * 7 + k + Math.floor(t * 8)) % glyphs.length], 10 + i * 17, y);
        }
      }
      c.tex.needsUpdate = true;
    },
  };
}
