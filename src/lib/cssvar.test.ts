import { test } from "node:test";
import assert from "node:assert/strict";
import { cssVar } from "./theme.ts";

const style = { getPropertyValue: (name: string) => (name === "--accent" ? "  #3b82f6 " : "") };

test("cssVar returns the trimmed custom property value", () => {
  assert.equal(cssVar("--accent", style), "#3b82f6");
});

test("cssVar returns an empty string for an undefined property", () => {
  assert.equal(cssVar("--missing", style), "");
});
