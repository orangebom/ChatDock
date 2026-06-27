import test from "node:test";
import assert from "node:assert/strict";

import {
  addVisibleSiteToWorkspace,
  moveItem,
  removeVisibleSiteFromWorkspace,
  reorderVisibleSitesInWorkspace,
  syncVisibleSiteOrder,
} from "../src/features/site-manager/site-manager-state.ts";

function workspace() {
  return {
    siteOrder: ["a", "b", "c", "d"],
    visibleSiteLabels: ["a", "b", "c"],
    selectedSiteLabels: ["c", "a"],
  };
}

test("moveItem reorders without mutating the source array", () => {
  const source = ["a", "b", "c"];
  assert.deepEqual(moveItem(source, 0, 2), ["b", "c", "a"]);
  assert.deepEqual(source, ["a", "b", "c"]);
  assert.deepEqual(moveItem(source, -1, 2), source);
});

test("reorderVisibleSitesInWorkspace keeps hidden sites after visible sites and sorts selected labels", () => {
  const target = workspace();

  assert.equal(reorderVisibleSitesInWorkspace(target, "c", "a"), true);
  assert.deepEqual(target.visibleSiteLabels, ["c", "a", "b"]);
  assert.deepEqual(target.siteOrder, ["c", "a", "b", "d"]);
  assert.deepEqual(target.selectedSiteLabels, ["c", "a"]);
});

test("reorderVisibleSitesInWorkspace ignores missing or same targets", () => {
  const target = workspace();

  assert.equal(reorderVisibleSitesInWorkspace(target, "x", "a"), false);
  assert.equal(reorderVisibleSitesInWorkspace(target, "a", "a"), false);
});

test("addVisibleSiteToWorkspace appends hidden site through sanitized order", () => {
  const target = workspace();
  addVisibleSiteToWorkspace(target, "d", (order) => order);

  assert.deepEqual(target.visibleSiteLabels, ["a", "b", "c", "d"]);
  assert.deepEqual(target.siteOrder, ["a", "b", "c", "d"]);
});

test("removeVisibleSiteFromWorkspace removes visible and selected labels and clears maximized", () => {
  const target = workspace();
  const result = removeVisibleSiteFromWorkspace(target, "c", "c");

  assert.deepEqual(target.visibleSiteLabels, ["a", "b"]);
  assert.deepEqual(target.selectedSiteLabels, ["a"]);
  assert.equal(result.maximizedLabel, null);
});

test("syncVisibleSiteOrder updates order only when DOM order changed", () => {
  const target = workspace();

  assert.equal(syncVisibleSiteOrder(target, ["a", "b", "c"]), false);
  assert.equal(syncVisibleSiteOrder(target, ["b", "a", "c"]), true);
  assert.deepEqual(target.visibleSiteLabels, ["b", "a", "c"]);
  assert.deepEqual(target.siteOrder, ["b", "a", "c", "d"]);
  assert.deepEqual(target.selectedSiteLabels, ["a", "c"]);
});
