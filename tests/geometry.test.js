import test from "node:test";
import assert from "node:assert/strict";

import {
  clamp,
  clampCardPosition,
  createRect,
  cssToPhysicalMetrics,
  physicalToViewportPosition,
} from "../src/geometry.js";

test("clamp keeps numbers inside the inclusive range", () => {
  assert.equal(clamp(3, 1, 5), 3);
  assert.equal(clamp(-2, 1, 5), 1);
  assert.equal(clamp(8, 1, 5), 5);
});

test("createRect returns a plain rect object", () => {
  assert.deepEqual(createRect(1, 2, 3, 4), {
    x: 1,
    y: 2,
    width: 3,
    height: 4,
  });
});

test("clampCardPosition keeps floating panels inside viewport padding", () => {
  assert.equal(clampCardPosition(-10, 100, 400, 20), 20);
  assert.equal(clampCardPosition(350, 100, 400, 20), 280);
  assert.equal(clampCardPosition(160, 100, 400, 20), 160);
});

test("physicalToViewportPosition converts device pixels to CSS pixels", () => {
  assert.equal(physicalToViewportPosition(null, 2), null);
  assert.deepEqual(physicalToViewportPosition({ x: 300, y: 120 }, 1.5), {
    x: 200,
    y: 80,
  });
});

test("cssToPhysicalMetrics scales CSS rects by window dimensions", () => {
  assert.equal(cssToPhysicalMetrics(null, { width: 2000, height: 1000 }, { width: 1000, height: 500 }), null);
  assert.deepEqual(
    cssToPhysicalMetrics(
      { x: 10.2, y: 20.4, width: 300.2, height: 100.7 },
      { width: 2000, height: 1000 },
      { width: 1000, height: 500 },
    ),
    {
      x: 20,
      y: 41,
      width: 600,
      height: 201,
    },
  );
});
