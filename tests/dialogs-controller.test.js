import test from "node:test";
import assert from "node:assert/strict";

import { createStandardDialogsController } from "../src/features/dialogs/dialogs-controller.ts";

function createController(overrides = {}) {
  const calls = [];
  const elements = new Map([
    ["#layout-presets", { hidden: true }],
    ["#about-dialog", { hidden: true }],
    ["#close-about", { focus: () => calls.push("focus-close-about") }],
  ]);
  const controller = createStandardDialogsController({
    document: { querySelector: (selector) => elements.get(selector) || null },
    requestAnimationFrame: (callback) => {
      calls.push("raf");
      callback();
    },
    actions: {
      isSiteManagerOpen: () => true,
      closeSiteManager: async () => calls.push("close-site-manager"),
      isOnboardingOpen: () => true,
      closeOnboarding: async (markCompleted) => calls.push(`close-onboarding:${markCompleted}`),
      isTargetContextMenuOpen: () => true,
      closeTargetContextMenu: () => calls.push("close-context-menu"),
      isLayoutPresetMenuOpen: () => true,
      closeLayoutPresetMenu: async () => calls.push("close-layout-menu"),
      isLayoutPresetDropdownOpen: () => true,
      closeLayoutPresetDropdown: async () => calls.push("close-layout-dropdown"),
      renderLayoutPresets: () => calls.push("render-layout-presets"),
      syncCompactBarHeight: () => calls.push("sync-compact-bar"),
      syncVisibleWebviews: async () => calls.push("sync-webviews"),
      syncVisibleToolbarWebviews: async () => calls.push("sync-toolbar"),
      refreshLayout: async (passes) => calls.push(`refresh:${passes ?? ""}`),
      ...overrides.actions,
    },
  });

  return { controller, calls, elements };
}

test("standard dialogs controller opens layout presets and closes competing overlays", async () => {
  const { controller, calls, elements } = createController();

  await controller.openLayoutPresets();

  assert.equal(elements.get("#layout-presets").hidden, false);
  assert.deepEqual(calls, [
    "close-site-manager",
    "close-onboarding:true",
    "close-context-menu",
    "close-layout-menu",
    "close-layout-dropdown",
    "render-layout-presets",
    "sync-compact-bar",
    "sync-webviews",
    "sync-toolbar",
    "refresh:1",
  ]);
});

test("standard dialogs controller opens about dialog and focuses close button", async () => {
  const { controller, calls, elements } = createController({
    actions: {
      isLayoutPresetMenuOpen: () => false,
      isLayoutPresetDropdownOpen: () => false,
    },
  });

  await controller.openAbout();

  assert.equal(elements.get("#about-dialog").hidden, false);
  assert.deepEqual(calls, [
    "close-site-manager",
    "close-onboarding:true",
    "close-context-menu",
    "sync-webviews",
    "sync-toolbar",
    "raf",
    "focus-close-about",
  ]);
});

test("standard dialogs controller closes modal and refreshes layout", async () => {
  const { controller, calls, elements } = createController();
  elements.get("#about-dialog").hidden = false;

  await controller.closeAbout();

  assert.equal(elements.get("#about-dialog").hidden, true);
  assert.deepEqual(calls, ["refresh:"]);
});
