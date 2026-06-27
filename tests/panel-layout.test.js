import test from "node:test";
import assert from "node:assert/strict";

import { getPanelLayoutRects, updateLayoutFromHandleDrag } from "../src/features/panels/panel-layout.ts";

const layout = {
  twoWaySplit: 0.5,
  threeWaySplits: [1 / 3, 2 / 3],
  quadCols: 0.5,
  quadRows: 0.5,
};

test("getPanelLayoutRects returns empty maps when no labels are visible", () => {
  const result = getPanelLayoutRects([], layout, { width: 800, height: 400 }, 2);

  assert.equal(result.rects.size, 0);
  assert.deepEqual(result.handles, []);
});

test("getPanelLayoutRects gives one visible label the full viewport", () => {
  const result = getPanelLayoutRects(["chatgpt"], layout, { width: 800, height: 400 }, 2);

  assert.deepEqual(result.rects.get("chatgpt"), { x: 0, y: 0, width: 800, height: 400 });
  assert.deepEqual(result.handles, []);
});

test("getPanelLayoutRects creates a two way split and handle", () => {
  const result = getPanelLayoutRects(["a", "b"], layout, { width: 800, height: 400 }, 2);

  assert.deepEqual(result.rects.get("a"), { x: 0, y: 0, width: 399, height: 400 });
  assert.deepEqual(result.rects.get("b"), { x: 401, y: 0, width: 399, height: 400 });
  assert.deepEqual(result.handles, [{ key: "two-way", axis: "x", x: 400, y: 0, width: 12, height: 400 }]);
});

test("getPanelLayoutRects creates three column layout and normalizes split order", () => {
  const source = { ...layout, threeWaySplits: [0.75, 0.76] };
  const result = getPanelLayoutRects(["a", "b", "c"], source, { width: 900, height: 300 }, 2);

  assert.deepEqual(source.threeWaySplits, [0.7, 0.82]);
  assert.equal(result.handles.length, 2);
  assert.deepEqual(result.handles.map((handle) => handle.key), ["three-way-left", "three-way-right"]);
});

test("getPanelLayoutRects creates quad layout and two handles", () => {
  const result = getPanelLayoutRects(["a", "b", "c", "d"], layout, { width: 800, height: 600 }, 2);

  assert.deepEqual(result.rects.get("a"), { x: 0, y: 0, width: 399, height: 299 });
  assert.deepEqual(result.rects.get("d"), { x: 401, y: 301, width: 399, height: 299 });
  assert.deepEqual(result.handles.map((handle) => handle.key), ["quad-cols", "quad-rows"]);
});

test("updateLayoutFromHandleDrag clamps drag ratios by handle type", () => {
  const source = {
    twoWaySplit: 0.5,
    threeWaySplits: [0.33, 0.66],
    quadCols: 0.5,
    quadRows: 0.5,
  };

  updateLayoutFromHandleDrag(source, "two-way", 0.95);
  updateLayoutFromHandleDrag(source, "three-way-left", 0.6);
  updateLayoutFromHandleDrag(source, "three-way-right", 0.62);
  updateLayoutFromHandleDrag(source, "quad-cols", 0.1);
  updateLayoutFromHandleDrag(source, "quad-rows", 0.9);

  assert.equal(source.twoWaySplit, 0.8);
  assert.deepEqual(source.threeWaySplits, [0.54, 0.66]);
  assert.equal(source.quadCols, 0.24);
  assert.equal(source.quadRows, 0.76);
});
