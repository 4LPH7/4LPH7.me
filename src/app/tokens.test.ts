import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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
    if (statSync(path).isDirectory()) return name === "reactbits" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;

test("no raw colour literals outside tokens.css", () => {
  const offenders = cssFiles(APP_DIR)
    .filter((file) => !file.endsWith(TOKENS))
    .flatMap((file) => {
      const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      return (css.match(RAW_COLOUR) ?? []).map((hit) => `${relative(SRC_DIR, file)}: ${hit}`);
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

test("every var() resolves to a defined token", () => {
  const all = cssFiles(APP_DIR).map((f) => readFileSync(f, "utf8")).join("\n");
  const defined = new Set([...all.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const used = [...all.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
  const missing = [...new Set(used.filter((name) => !defined.has(name)))];
  assert.deepEqual(missing, []);
});

test("no tokens defined but unused", () => {
  const css = cssFiles(APP_DIR).map((f) => readFileSync(f, "utf8")).join("\n");
  const tokensCss = readFileSync(join(APP_DIR, TOKENS), "utf8");
  const defined = [...tokensCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
  const unused = [...new Set(defined)].filter((name) => !css.includes(`var(${name}`));
  assert.deepEqual(unused, []);
});
