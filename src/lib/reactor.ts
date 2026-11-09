/** Glow level of a powered-down reactor: a faint ember, never fully dark. */
export const STANDBY = 0.06;
/** Seconds of flicker before the arc catches. */
export const IGNITE = 0.55;
/** Seconds after the click when the light starts sweeping around the coils. */
export const SWEEP = 0.75;
/** Seconds from the click until the reactor runs steady at full power. */
export const BOOT = 1.9;
/** Seconds the shutdown takes to drain to standby. */
export const SHUTDOWN = 1.1;

const FLASH_LIFE = 0.35;
const SHOCK_LIFE = 0.9;
const FLARE = 0.15;

/**
 * `level`: glow (STANDBY..1, briefly above 1 at ignition and at the shutdown flare). `flash`: 1→0 ignition flash.
 * `sweep`: 0→1 light running around the coils, or -1. `shock`: 0→1 through the electric discharge at ignition, or -1.
 */
export type ReactorPower = {
	level: number;
	flash: number;
	sweep: number;
	shock: number;
};

const STEADY: ReactorPower = { level: 1, flash: 0, sweep: -1, shock: -1 };
const REST: ReactorPower = { level: STANDBY, flash: 0, sweep: -1, shock: -1 };

/** Deterministic 0..1 flicker that changes about 24 times a second: an arc struggling to catch. */
function flicker(t: number): number {
	const x = Math.sin(Math.floor(t * 24) * 12.9898) * 43758.5453;
	return x - Math.floor(x);
}

/**
 * Where the reactor is `since` seconds after it was switched `on` (true) or off (false). Booting: flicker, ignition
 * flash with an electric discharge and a glow overshoot, a sweep of light around the coils, then steady. Shutting down: a last
 * flare, then the glow drains (stuttering at the end) to the standby ember.
 */
export function reactorPower(on: boolean, since: number): ReactorPower {
	if (!(since >= 0)) return on ? STEADY : REST;
	if (on) {
		if (since >= BOOT) return STEADY;
		if (since < IGNITE) {
			const catching = 0.4 + (0.6 * since) / IGNITE;
			return {
				level: STANDBY + flicker(since) * 0.6 * catching,
				flash: 0,
				sweep: -1,
				shock: -1,
			};
		}
		const after = since - IGNITE;
		const settle = 1 - after / (BOOT - IGNITE);
		return {
			level: 1 + 0.6 * settle * settle,
			flash: after < FLASH_LIFE ? 1 - after / FLASH_LIFE : 0,
			sweep: since >= SWEEP ? (since - SWEEP) / (BOOT - SWEEP) : -1,
			shock: after < SHOCK_LIFE ? after / SHOCK_LIFE : -1,
		};
	}
	if (since >= SHUTDOWN) return REST;
	if (since < FLARE) return { level: 1.25, flash: 0, sweep: -1, shock: -1 };
	const k = (since - FLARE) / (SHUTDOWN - FLARE);
	const drain = (1 - k) * (1 - k);
	const stutter = k > 0.7 ? 0.4 + flicker(since) * 0.6 : 1;
	return {
		level: STANDBY + (1 - STANDBY) * drain * stutter,
		flash: 0,
		sweep: -1,
		shock: -1,
	};
}
