import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const APP_DIR = join(import.meta.dirname, ".");
const SRC_DIR = join(import.meta.dirname, "..");
const TOKENS = "tokens.css";

function cssFiles(dir: string): string[] {
	return readdirSync(dir)
		.filter((name) => name.endsWith(".css"))
		.map((name) => join(dir, name));
}

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory())
			return name === "reactbits" ? [] : sourceFiles(path);
		return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});
}

const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;

test("no raw colour literals outside tokens.css", () => {
	const offenders = cssFiles(APP_DIR)
		.filter((file) => !file.endsWith(TOKENS))
		.flatMap((file) => {
			const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
			return (css.match(RAW_COLOUR) ?? []).map(
				(hit) => `${relative(SRC_DIR, file)}: ${hit}`,
			);
		});
	assert.deepEqual(offenders, []);
});

test("no theme overrides outside tokens.css", () => {
	const offenders = cssFiles(APP_DIR)
		.filter((file) => !file.endsWith(TOKENS))
		.flatMap((file) => {
			const css = readFileSync(file, "utf8");
			return (css.match(/:root\[data-theme="light"\][^{]*\{/g) ?? []).map(
				(hit) => `${relative(SRC_DIR, file)}: ${hit}`,
			);
		});
	assert.deepEqual(offenders, []);
});

test("no raw colour literals in component TS/TSX outside allowlisted files", () => {
	const allowed = /skillIcons\.ts$|reactbits/;
	const offenders = sourceFiles(SRC_DIR)
		.filter((file) => !allowed.test(file))
		.flatMap((file) => {
			const src = readFileSync(file, "utf8");
			return (src.match(/#[0-9a-fA-F]{6}\b|0x[0-9a-fA-F]{6}\b/g) ?? []).map(
				(hit) => `${relative(SRC_DIR, file)}: ${hit}`,
			);
		});
	assert.deepEqual(offenders, []);
});

test("no font size below 11px", () => {
	const offenders = cssFiles(APP_DIR).flatMap((file) => {
		const css = readFileSync(file, "utf8");
		return [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)]
			.filter((m) => Number(m[1]) < 11)
			.map((m) => `${relative(SRC_DIR, file)}: ${m[0]}`);
	});
	assert.deepEqual(offenders, []);
});

test("next/font variables use the --nf prefix and tokens.css maps --font-* onto them", () => {
	const fonts = readFileSync(join(SRC_DIR, "app", "fonts.ts"), "utf8");
	const tokensCss = readFileSync(join(APP_DIR, TOKENS), "utf8");
	const fontVars = [...fonts.matchAll(/variable: "(--[\w-]+)"/g)].map(
		(m) => m[1],
	);
	const legacy = fontVars.filter((name) => !name.startsWith("--nf-"));
	assert.deepEqual(legacy, []);
	assert.match(tokensCss, /--font-serif:\s*var\(--nf-serif\)/);
	assert.match(tokensCss, /--font-mono:\s*var\(--nf-mono\)/);
});

test("every var() resolves to a defined token", () => {
	const all = cssFiles(APP_DIR)
		.map((f) => readFileSync(f, "utf8"))
		.join("\n");
	// next/font injects --nf-* variables at runtime, so they count as defined here.
	const fonts = readFileSync(join(SRC_DIR, "app", "fonts.ts"), "utf8");
	const injected = [...fonts.matchAll(/variable: "(--[\w-]+)"/g)].map(
		(m) => m[1],
	);
	const defined = new Set([
		...[...all.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]),
		...injected,
	]);
	const used = [...all.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
	// Set at runtime from TSX (element.style), so no CSS declaration exists for them.
	const SET_FROM_JS = new Set([
		"--reveal-delay",
		"--deck-cover",
		"--arm",
		"--deck-tint",
		"--fill",
		"--i",
	]);
	const missing = [
		...new Set(
			used.filter((name) => !defined.has(name) && !SET_FROM_JS.has(name)),
		),
	];
	assert.deepEqual(missing, []);
});

test("no tokens defined but unused", () => {
	const tsSource = sourceFiles(SRC_DIR)
		.map((file) => readFileSync(file, "utf8"))
		.join("\n");
	const css = cssFiles(APP_DIR)
		.map((f) => readFileSync(f, "utf8"))
		.join("\n");
	const tokensCss = readFileSync(join(APP_DIR, TOKENS), "utf8");
	const defined = [...tokensCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
	const unused = [...new Set(defined)].filter(
		(name) => !css.includes(`var(${name}`) && !tsSource.includes(name),
	);
	assert.deepEqual(unused, []);
});
