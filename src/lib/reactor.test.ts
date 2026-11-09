import assert from "node:assert/strict";
import { test } from "node:test";
import {
	BOOT,
	IGNITE,
	reactorPower,
	SHUTDOWN,
	STANDBY,
	SWEEP,
} from "./reactor.ts";

test("a powered reactor that has finished booting runs steady at full power", () => {
	assert.deepEqual(reactorPower(true, BOOT + 1), {
		level: 1,
		flash: 0,
		sweep: -1,
		shock: -1,
	});
});

test("booting starts by flickering, never fully on", () => {
	for (let t = 0; t < IGNITE; t += 0.03) {
		const p = reactorPower(true, t);
		assert.ok(p.level >= STANDBY && p.level < 1, `level ${p.level} at ${t}`);
		assert.equal(p.flash, 0);
	}
});

test("ignition flashes once and lets off an electric discharge", () => {
	const at = reactorPower(true, IGNITE);
	assert.equal(at.flash, 1);
	assert.equal(at.shock, 0);
	assert.ok(at.level > 1, "ignition overshoots full power");
	const later = reactorPower(true, IGNITE + 0.3);
	assert.ok(later.flash < at.flash);
	assert.ok(later.shock > 0 && later.shock <= 1);
});

test("after ignition a light sweeps once around the coils, then the level settles at 1", () => {
	const start = reactorPower(true, SWEEP);
	assert.equal(start.sweep, 0);
	const mid = reactorPower(true, (SWEEP + BOOT) / 2);
	assert.ok(mid.sweep > 0 && mid.sweep < 1);
	assert.equal(reactorPower(true, BOOT).sweep, -1);
	assert.equal(reactorPower(true, BOOT).level, 1);
});

test("shutting down flares briefly, then drains to the standby ember", () => {
	assert.ok(reactorPower(false, 0.05).level > 1, "a last flare");
	const mid = reactorPower(false, SHUTDOWN / 2);
	assert.ok(mid.level < 1 && mid.level > STANDBY);
	assert.deepEqual(reactorPower(false, SHUTDOWN + 1), {
		level: STANDBY,
		flash: 0,
		sweep: -1,
		shock: -1,
	});
});

test("before any change (or with a bad time) it rests in its current state", () => {
	assert.equal(reactorPower(true, Number.NaN).level, 1);
	assert.equal(reactorPower(false, -1).level, STANDBY);
});
