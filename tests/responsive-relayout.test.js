import test from "node:test";
import assert from "node:assert/strict";

import { wireResponsiveRelayout } from "../src/features/panels/responsive-relayout.ts";

test("wireResponsiveRelayout observes grid and compact bar resize events", () => {
  const calls = [];
  const observed = [];
  const elements = new Map([
    [".grid-preview", { name: "grid" }],
    [".compact-bar", { name: "bar" }],
  ]);
  const observers = [];

  class FakeResizeObserver {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe(element) {
      observed.push(element.name);
    }
    disconnect() {
      calls.push("disconnect");
    }
  }

  const state = {
    resizeObserver: { disconnect: () => calls.push("old-grid-disconnect") },
    compactBarObserver: { disconnect: () => calls.push("old-bar-disconnect") },
  };

  wireResponsiveRelayout({
    document: { querySelector: (selector) => elements.get(selector) || null },
    window: { addEventListener: (type, handler) => calls.push({ type, handler }) },
    ResizeObserver: FakeResizeObserver,
    state,
    actions: {
      scheduleLayoutRefresh: (reason, delays) => calls.push({ reason, delays }),
      syncCompactBarHeight: () => true,
      isOnboardingOpen: () => false,
      renderOnboardingStep: () => calls.push("onboarding"),
      isTargetContextMenuOpen: () => false,
      positionTargetContextMenu: () => calls.push("context-menu"),
      isLayoutPresetMenuOpen: () => false,
      positionLayoutPresetMenuWebview: async () => calls.push("layout-menu"),
      isLayoutPresetDropdownOpen: () => false,
      positionLayoutPresetDropdownWebview: async () => calls.push("layout-dropdown"),
    },
  });

  observers[0].callback();
  observers[1].callback();

  assert.deepEqual(observed, ["grid", "bar"]);
  assert.equal(state.resizeObserver instanceof FakeResizeObserver, true);
  assert.equal(state.compactBarObserver instanceof FakeResizeObserver, true);
  assert.deepEqual(calls.slice(0, 4), [
    "old-grid-disconnect",
    "old-bar-disconnect",
    { type: "resize", handler: calls[2].handler },
    { reason: "container-resize", delays: [0, 90, 220, 420] },
  ]);
  assert.deepEqual(calls[4], { reason: "compact-bar-resize", delays: [0, 90, 220, 420] });
});

test("wireResponsiveRelayout repositions open overlays on window resize", () => {
  const calls = [];
  let resizeHandler = null;

  wireResponsiveRelayout({
    document: { querySelector: () => null },
    window: {
      addEventListener: (type, handler) => {
        if (type === "resize") {
          resizeHandler = handler;
        }
      },
    },
    ResizeObserver: undefined,
    state: {},
    actions: {
      scheduleLayoutRefresh: (reason, delays) => calls.push({ reason, delays }),
      syncCompactBarHeight: () => false,
      isOnboardingOpen: () => true,
      renderOnboardingStep: () => calls.push("onboarding"),
      isTargetContextMenuOpen: () => true,
      positionTargetContextMenu: () => calls.push("context-menu"),
      isLayoutPresetMenuOpen: () => true,
      positionLayoutPresetMenuWebview: async () => calls.push("layout-menu"),
      isLayoutPresetDropdownOpen: () => true,
      positionLayoutPresetDropdownWebview: async () => calls.push("layout-dropdown"),
    },
  });

  resizeHandler();

  assert.deepEqual(calls, [
    { reason: "window-resize", delays: [0, 100, 240, 420] },
    "onboarding",
    "context-menu",
    "layout-menu",
    "layout-dropdown",
  ]);
});
