import test from "node:test";
import assert from "node:assert/strict";

import { createSiteManagerController } from "../src/features/site-manager/site-manager-controller.ts";

function createElement(extra = {}) {
  return {
    hidden: true,
    innerHTML: "",
    dataset: {},
    querySelectorAll: () => [],
    ...extra,
  };
}

test("site manager controller opens modal, renders lists, and refreshes layout", async () => {
  const calls = [];
  const elements = new Map([
    ["#site-manager", createElement()],
    ["#visible-sites", createElement()],
    ["#hidden-sites", createElement()],
    ["#visible-sites-count", createElement()],
    ["#hidden-sites-count", createElement()],
  ]);

  const controller = createSiteManagerController({
    document: {
      querySelector: (selector) => elements.get(selector) || null,
    },
    Sortable: { create: () => ({ destroy() {} }) },
    state: { sortables: [] },
    actions: {
      createManagerItem: () => ({}),
      getVisibleManagedSites: () => [{ label: "chatgpt", title: "ChatGPT" }],
      getHiddenManagedSites: () => [{ label: "kimi", title: "Kimi" }],
      renderLists: (payload) => calls.push({ type: "render", payload }),
      syncCompactBarHeight: () => calls.push("sync-compact-bar"),
      syncVisibleWebviews: async () => calls.push("sync-webviews"),
      syncVisibleToolbarWebviews: async () => calls.push("sync-toolbar"),
      refreshLayout: async (passes) => calls.push(`refresh:${passes ?? ""}`),
      persistWorkspace: () => calls.push("persist-workspace"),
      renderWorkspace: () => calls.push("render-workspace"),
      syncVisibleSiteOrder: () => false,
    },
  });

  await controller.open();

  assert.equal(elements.get("#site-manager").hidden, false);
  assert.equal(calls[0].type, "render");
  assert.deepEqual(calls.slice(1), ["sync-compact-bar", "sync-webviews", "sync-toolbar", "refresh:1"]);
});

test("site manager controller closes modal and refreshes layout", async () => {
  const elements = new Map([["#site-manager", createElement({ hidden: false })]]);
  const calls = [];

  const controller = createSiteManagerController({
    document: { querySelector: (selector) => elements.get(selector) || null },
    Sortable: { create: () => ({ destroy() {} }) },
    state: { sortables: [] },
    actions: {
      createManagerItem: () => ({}),
      getVisibleManagedSites: () => [],
      getHiddenManagedSites: () => [],
      renderLists: () => {},
      syncCompactBarHeight: () => {},
      syncVisibleWebviews: async () => {},
      syncVisibleToolbarWebviews: async () => {},
      refreshLayout: async (passes) => calls.push(`refresh:${passes ?? ""}`),
      persistWorkspace: () => {},
      renderWorkspace: () => {},
      syncVisibleSiteOrder: () => false,
    },
  });

  await controller.close();

  assert.equal(elements.get("#site-manager").hidden, true);
  assert.deepEqual(calls, ["refresh:"]);
});

test("site manager controller syncs reordered visible sites from DOM", async () => {
  const calls = [];
  const visibleNodes = [
    { dataset: { siteLabel: "chatgpt" } },
    { dataset: { siteLabel: "kimi" } },
  ];
  const elements = new Map([
    ["#global-targets", createElement({ querySelectorAll: () => visibleNodes })],
  ]);

  const controller = createSiteManagerController({
    document: { querySelector: (selector) => elements.get(selector) || null },
    Sortable: { create: () => ({ destroy() {} }) },
    state: { sortables: [] },
    actions: {
      createManagerItem: () => ({}),
      getVisibleManagedSites: () => [],
      getHiddenManagedSites: () => [],
      renderLists: () => {},
      syncCompactBarHeight: () => {},
      syncVisibleWebviews: async () => {},
      syncVisibleToolbarWebviews: async () => {},
      refreshLayout: async (passes) => calls.push(`refresh:${passes ?? ""}`),
      persistWorkspace: () => calls.push("persist-workspace"),
      renderWorkspace: () => calls.push("render-workspace"),
      syncVisibleSiteOrder: (_workspace, labels) => {
        calls.push(`sync-order:${labels.join(",")}`);
        return true;
      },
    },
  });

  const changed = controller.syncVisibleSitesFromDom("#global-targets");

  assert.equal(changed, true);
  assert.deepEqual(calls, ["sync-order:chatgpt,kimi", "persist-workspace"]);
});
