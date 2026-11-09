import assert from "node:assert/strict";
import { test } from "node:test";
import { CHARGE, dispatchSnap, FLASH, SNAP_EVENT, STORM, type SnapDetail, snapPhase } from "./snap.ts";

test("before a snap (or with no snap) everything is at rest", () => {
	assert.deepEqual(snapPhase(-1), { charge: 0, storm: 0, flash: 0 });
	assert.deepEqual(snapPhase(Number.NaN), { charge: 0, storm: 0, flash: 0 });
});

test("the stones charge from 0 to 1 before the snap", () => {
	assert.equal(snapPhase(0).charge, 0);
	assert.equal(snapPhase(CHARGE / 2).charge, 0.5);
	assert.equal(snapPhase(CHARGE / 2).storm, 0);
	assert.equal(snapPhase(CHARGE / 2).flash, 0);
});

test("at the snap the storm and flash peak, then both fade", () => {
	const at = snapPhase(CHARGE);
	assert.equal(at.charge, 0);
	assert.equal(at.storm, 1);
	assert.equal(at.flash, 1);
	assert.equal(snapPhase(CHARGE + FLASH).flash, 0);
	assert.equal(snapPhase(CHARGE + STORM / 2).storm, 0.5);
});

test("after the storm everything is back at rest", () => {
	assert.deepEqual(snapPhase(CHARGE + STORM), { charge: 0, storm: 0, flash: 0 });
	assert.deepEqual(snapPhase(CHARGE + STORM + 5), { charge: 0, storm: 0, flash: 0 });
});

test("dispatchSnap fires the snap event with its origin", () => {
	const target = new EventTarget();
	let got: SnapDetail | null = null;
	target.addEventListener(SNAP_EVENT, (e) => {
		got = (e as CustomEvent<SnapDetail>).detail;
	});
	dispatchSnap({ x: 120, y: 340 }, target);
	assert.deepEqual(got, { x: 120, y: 340 });
});
