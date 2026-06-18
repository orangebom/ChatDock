import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_SITES_PER_PAGE,
  applyAvailabilityResults,
  clearSelectionState,
  getLabelsToProbe,
  isSiteUnavailable,
  markAvailabilityFromWebview,
  toggleSiteSelection,
} from "../src/ui-state.js";

function normalizePageLayouts(layouts, pageCount) {
  const next = [...layouts];
  while (next.length < pageCount) {
    next.push({ id: `page-${next.length + 1}` });
  }
  return next.slice(0, Math.max(pageCount, 1));
}

test("getLabelsToProbe ignores duplicates, unknown labels, cached labels, and pending labels", () => {
  const siteMap = new Map([
    ["chatgpt", {}],
    ["claude", {}],
    ["gemini", {}],
  ]);
  const siteAvailability = new Map([["chatgpt", { available: true, message: "" }]]);
  const pendingSiteAvailability = new Set(["claude"]);

  const labels = getLabelsToProbe(
    ["chatgpt", "chatgpt", "claude", "gemini", "unknown"],
    siteMap,
    siteAvailability,
    pendingSiteAvailability,
  );

  assert.deepEqual(labels, ["gemini"]);
});

test("getLabelsToProbe can force recheck for cached labels while still skipping pending labels", () => {
  const siteMap = new Map([
    ["chatgpt", {}],
    ["claude", {}],
    ["gemini", {}],
  ]);
  const siteAvailability = new Map([
    ["chatgpt", { available: false, message: "不可访问", verifiedByWebview: false }],
    ["claude", { available: true, message: "", verifiedByWebview: false }],
  ]);
  const pendingSiteAvailability = new Set(["gemini"]);

  const labels = getLabelsToProbe(
    ["chatgpt", "claude", "gemini"],
    siteMap,
    siteAvailability,
    pendingSiteAvailability,
    { force: true },
  );

  assert.deepEqual(labels, ["chatgpt", "claude"]);
});

test("applyAvailabilityResults keeps success message empty and falls back on missing results", () => {
  const result = applyAvailabilityResults(
    ["chatgpt", "claude"],
    [{ label: "chatgpt", available: true, message: "" }],
  );

  assert.deepEqual(result.get("chatgpt"), { available: true, message: "", verifiedByWebview: false });
  assert.deepEqual(result.get("claude"), { available: false, message: "不可访问", verifiedByWebview: false });
  assert.equal(isSiteUnavailable(result, "claude"), true);
});

test("markAvailabilityFromWebview treats verified success as available even after prior probe failure", () => {
  const siteAvailability = new Map([
    ["chatgpt", { available: false, message: "不可访问", verifiedByWebview: false }],
  ]);

  siteAvailability.set(
    "chatgpt",
    markAvailabilityFromWebview(siteAvailability, "chatgpt", true),
  );

  assert.deepEqual(siteAvailability.get("chatgpt"), {
    available: true,
    message: "",
    verifiedByWebview: true,
  });
  assert.equal(isSiteUnavailable(siteAvailability, "chatgpt"), false);
});

test("clearSelectionState resets paging and maximized state", () => {
  const cleared = clearSelectionState([{ id: "page-1" }, { id: "page-2" }], normalizePageLayouts);

  assert.deepEqual(cleared.selectedSiteLabels, []);
  assert.equal(cleared.activePageIndex, 0);
  assert.equal(cleared.maximizedLabel, null);
  assert.equal(cleared.pageLayouts.length, 1);
});

test("toggleSiteSelection adds site and jumps to the page containing the new selection", () => {
  const selectedSiteLabels = ["chatgpt", "claude", "gemini", "copilot"];
  const next = toggleSiteSelection({
    label: "grok",
    selected: true,
    visibleSiteLabels: [...selectedSiteLabels, "grok"],
    selectedSiteLabels,
    maximizedLabel: null,
    activePageIndex: 0,
    normalizePageLayouts,
    pageLayouts: [{ id: "page-1" }],
  });

  assert.ok(next);
  assert.deepEqual(next.selectedSiteLabels.at(-1), "grok");
  assert.equal(next.activePageIndex, Math.floor((selectedSiteLabels.length) / MAX_SITES_PER_PAGE));
  assert.equal(next.pageLayouts.length, 2);
});

test("toggleSiteSelection removes maximized target and clamps page index", () => {
  const next = toggleSiteSelection({
    label: "gemini",
    selected: false,
    visibleSiteLabels: ["chatgpt", "claude", "gemini"],
    selectedSiteLabels: ["chatgpt", "claude", "gemini"],
    maximizedLabel: "gemini",
    activePageIndex: 1,
    normalizePageLayouts,
    pageLayouts: [{ id: "page-1" }, { id: "page-2" }],
  });

  assert.ok(next);
  assert.deepEqual(next.selectedSiteLabels, ["chatgpt", "claude"]);
  assert.equal(next.maximizedLabel, null);
  assert.equal(next.activePageIndex, 0);
  assert.equal(next.pageLayouts.length, 1);
});

test("toggleSiteSelection returns null for hidden site", () => {
  const next = toggleSiteSelection({
    label: "grok",
    selected: true,
    visibleSiteLabels: ["chatgpt"],
    selectedSiteLabels: ["chatgpt"],
    maximizedLabel: null,
    activePageIndex: 0,
    normalizePageLayouts,
    pageLayouts: [{ id: "page-1" }],
  });

  assert.equal(next, null);
});
