import test from "node:test";
import assert from "node:assert/strict";

import { createLayoutRefreshController } from "../src/features/panels/layout-refresh-controller.ts";

test("layout refresh controller schedules refreshes and cancels stale timers", async () => {
  const calls = [];
  const timers = [];
  const cleared = [];
  const state = {
    relayoutVersion: 0,
    layoutRefreshToken: 0,
    layoutRefreshTimers: [],
  };

  const controller = createLayoutRefreshController({
    state,
    timerApi: {
      setTimeout: (handler, delay) => {
        const entry = { handler, delay };
        timers.push(entry);
        return entry;
      },
      clearTimeout: (timer) => cleared.push(timer.delay),
    },
    actions: {
      syncCompactBarHeight: () => {},
      hasUsableGridSize: () => true,
      applyLayout: () => calls.push("apply-layout"),
      isAnyOverlayOpen: () => false,
      syncVisibleWebviews: async () => calls.push("sync-webviews"),
      syncVisibleToolbarWebviews: async () => calls.push("sync-toolbar"),
      isOnboardingOpen: () => false,
      renderOnboardingStep: () => calls.push("render-onboarding"),
      ensureTargetsReady: async () => calls.push("ensure-targets"),
      ensureToolbarTargetsReady: async () => calls.push("ensure-toolbars"),
      getVisibleTargets: () => ["chatgpt"],
      syncToolbarStates: async () => calls.push("sync-toolbar-states"),
      relayoutWebviews: async () => calls.push("relayout-webviews"),
      relayoutToolbarWebviews: async () => calls.push("relayout-toolbar-webviews"),
      sleep: async () => {},
    },
  });

  controller.schedule("layout", [10, 20]);
  controller.schedule("window-state", [30]);

  assert.deepEqual(cleared, [10, 20]);

  timers[2].handler();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(
    JSON.stringify(calls),
    JSON.stringify([
      "apply-layout",
      "ensure-targets",
      "ensure-toolbars",
      "sync-webviews",
      "sync-toolbar",
      "sync-toolbar-states",
      "relayout-webviews",
      "relayout-toolbar-webviews",
      "relayout-webviews",
      "relayout-toolbar-webviews",
      "relayout-webviews",
      "relayout-toolbar-webviews",
      "relayout-webviews",
      "relayout-toolbar-webviews",
    ]),
  );
});

test("layout refresh controller short-circuits for overlays", async () => {
  const calls = [];
  const controller = createLayoutRefreshController({
    state: {
      relayoutVersion: 0,
      layoutRefreshToken: 0,
      layoutRefreshTimers: [],
    },
    timerApi: {
      setTimeout: () => null,
      clearTimeout: () => {},
    },
    actions: {
      syncCompactBarHeight: () => {},
      hasUsableGridSize: () => true,
      applyLayout: () => calls.push("apply-layout"),
      isAnyOverlayOpen: () => true,
      syncVisibleWebviews: async () => calls.push("sync-webviews"),
      syncVisibleToolbarWebviews: async () => calls.push("sync-toolbar"),
      isOnboardingOpen: () => true,
      renderOnboardingStep: () => calls.push("render-onboarding"),
      ensureTargetsReady: async () => calls.push("ensure-targets"),
      ensureToolbarTargetsReady: async () => calls.push("ensure-toolbars"),
      getVisibleTargets: () => ["chatgpt"],
      syncToolbarStates: async () => calls.push("sync-toolbar-states"),
      relayoutWebviews: async () => calls.push("relayout-webviews"),
      relayoutToolbarWebviews: async () => calls.push("relayout-toolbar-webviews"),
      sleep: async () => {},
    },
  });

  await controller.refresh();

  assert.deepEqual(calls, [
    "apply-layout",
    "sync-webviews",
    "sync-toolbar",
    "render-onboarding",
  ]);
});
