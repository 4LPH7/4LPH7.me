import assert from "node:assert/strict";
import { test } from "node:test";
import { bolt, discharge } from "./lightning.ts";

/** Deterministic 0..1 sequence, so the tests are repeatable. */
function seeded(seed: number) {
	let s = seed;
	return () => {
		s = (s * 16807) % 2147483647;
		return (s - 1) / 2147483646;
	};
}

test("a bolt keeps its ends and has 2^depth + 1 points", () => {
	const pts = bolt([0, 0], [1, 0], 5, 0.3, seeded(1));
	assert.equal(pts.length, 33);
	assert.deepEqual(pts[0], [0, 0]);
	assert.deepEqual(pts[32], [1, 0]);
});

test("a bolt is jagged but stays near its line", () => {
	const pts = bolt([0, 0], [1, 0], 5, 0.3, seeded(7));
	assert.ok(
		pts.some(([, y]) => Math.abs(y) > 0.01),
		"it zigzags",
	);
	for (const [x, y] of pts) {
		assert.ok(Number.isFinite(x) && Number.isFinite(y));
		assert.ok(Math.abs(y) < 0.5, `y ${y} wanders too far`);
	}
});

test("a zero-length bolt does not produce NaN", () => {
	for (const [x, y] of bolt([0.2, 0.2], [0.2, 0.2], 3, 0.3, seeded(3))) {
		assert.ok(Number.isFinite(x) && Number.isFinite(y));
	}
});

test("a discharge has main bolts, forks and ring arcs, all inside the drawing", () => {
	for (let seed = 1; seed < 30; seed++) {
		const strokes = discharge(0.9, 0.5, seeded(seed));
		const mains = strokes.filter((s) => s.width === 1).length;
		assert.ok(mains >= 4 && mains <= 7, `${mains} main bolts`);
		assert.ok(strokes.length > mains * 2, "forks and ring arcs too");
		for (const s of strokes) {
			for (const [x, y] of s.pts)
				assert.ok(
					Math.hypot(x, y) < 1.2,
					`point (${x}, ${y}) leaves the drawing`,
				);
		}
	}
});

test("each frame is a new pattern, so redrawing flickers", () => {
	const rand = seeded(5);
	assert.notDeepEqual(discharge(0.9, 0.5, rand), discharge(0.9, 0.5, rand));
});
