/** Window event fired at the moment of the snap; the site-wide overlay (SnapOverlay) listens for it. */
export const SNAP_EVENT = "ironman:snap";

/** Seconds the stones charge before the snap. */
export const CHARGE = 0.7;
/** Seconds the lightning storm lasts after the snap. */
export const STORM = 2.4;
/** Seconds the white flash takes to fade after the snap (one flash only). */
export const FLASH = 0.25;

/** The six stones, in the order the lightning cycles through them. */
export const STONES = ["space", "reality", "power", "mind", "time", "soul"] as const;
export type Stone = (typeof STONES)[number];
/** Each stone's colour token (spelled out so the token guard can see every one is used). */
export const STONE_VAR: Record<Stone, string> = {
  space: "--stone-space",
  reality: "--stone-reality",
  power: "--stone-power",
  mind: "--stone-mind",
  time: "--stone-time",
  soul: "--stone-soul",
};

/** Where on screen (px) the snap came from. */
export type SnapDetail = { x: number; y: number };
export type SnapPhase = { charge: number; storm: number; flash: number };

const REST: SnapPhase = { charge: 0, storm: 0, flash: 0 };

/**
 * Where a snap is `since` seconds after the click: `charge` rises 0→1 while the stones power up, then at the snap
 * `storm` starts at 1 and falls to 0 over STORM, with `flash` falling 1→0 over its first FLASH seconds.
 */
export function snapPhase(since: number): SnapPhase {
  if (!(since >= 0)) return REST;
  if (since < CHARGE) return { charge: since / CHARGE, storm: 0, flash: 0 };
  if (since >= CHARGE + STORM) return REST;
  const after = since - CHARGE;
  return { charge: 0, storm: 1 - after / STORM, flash: Math.max(0, 1 - after / FLASH) };
}

/** Tells the rest of the page a snap just happened at `detail` (screen px). */
export function dispatchSnap(detail: SnapDetail, target: EventTarget = window): void {
  target.dispatchEvent(new CustomEvent<SnapDetail>(SNAP_EVENT, { detail }));
}
