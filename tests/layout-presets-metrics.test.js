import test from "node:test";
import assert from "node:assert/strict";

import {
  getDropdownMetricsFromRect,
  getMenuMetricsFromRect,
} from "../src/features/layout-presets/layout-presets-metrics.ts";

test("getMenuMetricsFromRect positions the menu below the trigger", () => {
  assert.deepEqual(
    getMenuMetricsFromRect(
      { left: 100, right: 132, bottom: 40, width: 32 },
      { width: 600, height: 400 },
    ),
    { x: 8, y: 48, width: 168, height: 84 },
  );
});

test("getDropdownMetricsFromRect centers dropdown around the trigger", () => {
  assert.deepEqual(
    getDropdownMetricsFromRect(
      { left: 300, right: 440, bottom: 50, width: 140 },
      3,
      { width: 800, height: 600 },
    ),
    { x: 300, y: 58, width: 176, height: 138 },
  );
});

test("getDropdownMetricsFromRect clamps item count to at least one", () => {
  assert.equal(
    getDropdownMetricsFromRect({ left: 0, right: 0, bottom: 0, width: 0 }, 0, { width: 800, height: 600 }).height,
    54,
  );
});
