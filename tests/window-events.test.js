import test from "node:test";
import assert from "node:assert/strict";

import { wireWindowLayoutEvents } from "../src/tauri/window-events.ts";

test("wireWindowLayoutEvents schedules layout refreshes for window lifecycle events", async () => {
  const handlers = new Map();
  const calls = [];
  const appWindow = {
    async onResized(handler) {
      handlers.set("resized", handler);
    },
    async onScaleChanged(handler) {
      handlers.set("scale", handler);
    },
    async onFocusChanged(handler) {
      handlers.set("focus", handler);
    },
  };

  await wireWindowLayoutEvents({
    appWindow,
    actions: {
      scheduleLayoutRefresh: (reason, delays) => calls.push({ reason, delays }),
      isLayoutPresetMenuOpen: () => true,
      isLayoutPresetDropdownOpen: () => true,
      positionLayoutPresetMenuWebview: async () => calls.push("position-menu"),
      positionLayoutPresetDropdownWebview: async () => calls.push("position-dropdown"),
      onError: (error) => calls.push(`error:${error}`),
    },
  });

  await handlers.get("resized")();
  await handlers.get("scale")();
  await handlers.get("focus")({ payload: true });
  await handlers.get("focus")({ payload: false });

  assert.deepEqual(calls, [
    { reason: "window-state", delays: [0, 120, 260, 460, 720] },
    "position-menu",
    "position-dropdown",
    { reason: "scale-change", delays: [0, 120, 260, 460, 720] },
    "position-menu",
    "position-dropdown",
    { reason: "focus-return", delays: [0, 120, 260] },
    "position-menu",
    "position-dropdown",
  ]);
});
