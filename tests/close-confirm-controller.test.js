import test from "node:test";
import assert from "node:assert/strict";

import { createCloseConfirmController } from "../src/features/dialogs/close-confirm-controller.ts";

function createController(overrides = {}) {
  const calls = [];
  const elements = new Map([
    ["#close-confirm", { hidden: true }],
    ["#accept-close-confirm", { focus: () => calls.push("focus-accept") }],
  ]);
  const state = {
    open: false,
    resolver: null,
    ...overrides.state,
  };

  const controller = createCloseConfirmController({
    document: { querySelector: (selector) => elements.get(selector) || null },
    requestAnimationFrame: (callback) => {
      calls.push("raf");
      callback();
    },
    state,
    actions: {
      isSiteManagerOpen: () => true,
      closeSiteManager: async () => calls.push("close-site-manager"),
      isOnboardingOpen: () => true,
      closeOnboarding: async (markCompleted) => calls.push(`close-onboarding:${markCompleted}`),
      syncVisibleWebviews: async () => calls.push("sync-webviews"),
      syncVisibleToolbarWebviews: async () => calls.push("sync-toolbar"),
      refreshLayout: async () => calls.push("refresh-layout"),
      ...overrides.actions,
    },
  });

  return { controller, state, calls, elements };
}

test("close confirm controller opens modal and focuses accept button", async () => {
  const { controller, state, calls, elements } = createController({
    actions: {
      isSiteManagerOpen: () => false,
      isOnboardingOpen: () => false,
    },
  });

  const pending = controller.show();
  await Promise.resolve();
  await Promise.resolve();
  void controller.resolve(false);
  const result = await pending;

  assert.equal(result, false);
  assert.equal(elements.get("#close-confirm").hidden, true);
  assert.equal(state.open, false);
  assert.deepEqual(calls, [
    "sync-webviews",
    "sync-toolbar",
    "raf",
    "focus-accept",
    "refresh-layout",
  ]);
});

test("close confirm controller chains concurrent show calls", async () => {
  const { controller } = createController({
    actions: {
      isSiteManagerOpen: () => false,
      isOnboardingOpen: () => false,
    },
  });

  const first = controller.show();
  await Promise.resolve();
  await Promise.resolve();
  const second = controller.show();
  void controller.resolve(true);

  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(firstResult, true);
  assert.equal(secondResult, true);
});
