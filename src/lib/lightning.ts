/** A point in the unit disc the discharge is drawn in: (0, 0) is the core, radius 1 the edge of the drawing. */
export type Pt = [number, number];
/** One stroke of the discharge: its jagged points and how thick it is drawn (1 = a main bolt). */
export type Stroke = { pts: Pt[]; width: number };

/**
 * A jagged lightning bolt from `a` to `b` by midpoint displacement: `depth` rounds of halving every segment and pushing
 * the new midpoint sideways by up to `rough` × that segment's length. The ends stay put; 2^depth + 1 points.
 */
export function bolt(
	a: Pt,
	b: Pt,
	depth: number,
	rough: number,
	rand: () => number,
): Pt[] {
	let pts: Pt[] = [a, b];
	for (let d = 0; d < depth; d++) {
		const next: Pt[] = [pts[0]];
		for (let i = 1; i < pts.length; i++) {
			const [x0, y0] = pts[i - 1];
			const [x1, y1] = pts[i];
			const dx = x1 - x0;
			const dy = y1 - y0;
			const len = Math.hypot(dx, dy) || 1;
			const off = (rand() * 2 - 1) * rough * len;
			next.push(
				[(x0 + x1) / 2 - (dy / len) * off, (y0 + y1) / 2 + (dx / len) * off],
				pts[i],
			);
		}
		pts = next;
	}
	return pts;
}

const polar = (r: number, a: number): Pt => [Math.cos(a) * r, Math.sin(a) * r];

/**
 * One frame of an electric discharge: bolts from the core out to `reach` (0..1) with a fork off each, plus arcs that
 * jump along the reactor ring at radius `ring`. Every call is a fresh random pattern, so redrawing it flickers.
 */
export function discharge(
	reach: number,
	ring: number,
	rand: () => number,
): Stroke[] {
	const strokes: Stroke[] = [];
	const bolts = 4 + Math.floor(rand() * 4);
	for (let i = 0; i < bolts; i++) {
		const a = ((i + rand() * 0.7) / bolts) * Math.PI * 2;
		const end = reach * (0.7 + rand() * 0.3);
		const pts = bolt(
			polar(0.08, a),
			polar(end, a + (rand() - 0.5) * 0.6),
			5,
			0.28,
			rand,
		);
		strokes.push({ pts, width: 1 });
		const from = pts[8 + Math.floor(rand() * 16)];
		const fa =
			Math.atan2(from[1], from[0]) +
			(rand() < 0.5 ? -1 : 1) * (0.4 + rand() * 0.5);
		const fr = Math.min(
			reach,
			Math.hypot(from[0], from[1]) + reach * (0.15 + rand() * 0.2),
		);
		strokes.push({ pts: bolt(from, polar(fr, fa), 4, 0.3, rand), width: 0.5 });
	}
	const arcs = 2 + Math.floor(rand() * 3);
	for (let i = 0; i < arcs; i++) {
		const a = rand() * Math.PI * 2;
		strokes.push({
			pts: bolt(
				polar(ring, a),
				polar(ring, a + 0.5 + rand() * 0.7),
				4,
				0.35,
				rand,
			),
			width: 0.6,
		});
	}
	return strokes;
}
