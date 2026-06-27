import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_LAYOUT_STATE,
  cloneLayout,
  createDefaultWorkspace,
  getPageCount,
  normalizePageLayouts,
  sanitizeSiteOrder,
  sanitizeVisibleSiteLabels,
  sanitizeWorkspace,
} from "../src/state/workspace.ts";

const labels = ["chatgpt", "claude", "gemini", "deepseek"];

test("cloneLayout clamps invalid split ratios and preserves valid values", () => {
  assert.deepEqual(
    cloneLayout({
      twoWaySplit: 0.9,
      threeWaySplits: [0.1, 0.9],
      quadCols: 0.5,
      quadRows: "bad",
    }),
    {
      twoWaySplit: 0.8,
      threeWaySplits: [0.18, 0.82],
      quadCols: 0.5,
      quadRows: DEFAULT_LAYOUT_STATE.quadRows,
    },
  );
});

test("createDefaultWorkspace selects the first available site and keeps all sites visible", () => {
  assert.deepEqual(createDefaultWorkspace(labels), {
    selectedSiteLabels: [],
    activePageIndex: 0,
    pageLayouts: [cloneLayout()],
    siteOrder: labels,
    visibleSiteLabels: labels,
  });
});

test("getPageCount keeps at least one page and groups four sites per page", () => {
  assert.equal(getPageCount(0), 1);
  assert.equal(getPageCount(4), 1);
  assert.equal(getPageCount(5), 2);
});

test("normalizePageLayouts creates missing pages and clones layout values", () => {
  const layouts = normalizePageLayouts([{ twoWaySplit: 0.7 }], 3);

  assert.equal(layouts.length, 3);
  assert.equal(layouts[0].twoWaySplit, 0.7);
  assert.deepEqual(layouts[1], cloneLayout());
  assert.deepEqual(layouts[2], cloneLayout());
});

test("sanitizeSiteOrder deduplicates valid labels and appends missing labels", () => {
  assert.deepEqual(
    sanitizeSiteOrder(["gemini", "unknown", "gemini", "chatgpt"], labels),
    ["gemini", "chatgpt", "claude", "deepseek"],
  );
});

test("sanitizeVisibleSiteLabels falls back to the sanitized order when visible labels are missing", () => {
  assert.deepEqual(
    sanitizeVisibleSiteLabels(undefined, ["gemini", "unknown", "chatgpt"], labels),
    ["gemini", "chatgpt", "claude", "deepseek"],
  );
});

test("sanitizeWorkspace repairs selected labels, paging, order, and layouts", () => {
  const workspace = sanitizeWorkspace(
    {
      selectedSiteLabels: ["gemini", "missing", "gemini", "chatgpt", "claude", "deepseek"],
      activePageIndex: 99,
      pageLayouts: [{ id: "page-1" }],
      siteOrder: ["deepseek", "chatgpt"],
      visibleSiteLabels: ["chatgpt", "gemini"],
    },
    labels,
  );

  assert.deepEqual(workspace.selectedSiteLabels, ["gemini", "chatgpt"]);
  assert.equal(workspace.activePageIndex, 0);
  assert.deepEqual(workspace.siteOrder, ["deepseek", "chatgpt", "claude", "gemini"]);
  assert.deepEqual(workspace.visibleSiteLabels, ["chatgpt", "gemini"]);
  assert.equal(workspace.pageLayouts.length, 1);
});
