import test from "node:test";
import assert from "node:assert/strict";

import { createLayoutPresetOverlayController } from "../src/features/layout-presets/layout-preset-overlays.ts";

function createOverlayController(overrides = {}) {
  const calls = [];
  const elements = new Map([
    [
      "#layout-preset-select",
      {
        expanded: "",
        setAttribute(name, value) {
          this[name] = value;
          calls.push(`select:${name}:${value}`);
        },
      },
    ],
    ["#layout-preset-more", {}],
    ["#layout-preset-menu", { setAttribute: (name, value) => calls.push(`menu-shell:${name}:${value}`) }],
  ]);
  const state = {
    layoutPresets: { activePresetId: "base", items: [{ id: "base", name: "默认" }] },
    layoutPresetDropdown: { open: false },
    layoutPresetMenu: { open: false },
    ...overrides.state,
  };
  const overlays = {
    dropdown: {
      ensure: async () => calls.push("dropdown.ensure"),
      hide: async () => calls.push("dropdown.hide"),
      position: async () => calls.push("dropdown.position"),
      sync: async () => calls.push("dropdown.sync"),
      show: async () => calls.push("dropdown.show"),
    },
    menu: {
      ensure: async () => calls.push("menu.ensure"),
      hide: async () => calls.push("menu.hide"),
      position: async () => calls.push("menu.position"),
      sync: async () => calls.push("menu.sync"),
      show: async () => calls.push("menu.show"),
    },
    ...overrides.overlays,
  };

  const controller = createLayoutPresetOverlayController({
    document: { querySelector: (selector) => elements.get(selector) || null },
    state,
    overlays,
    actions: {
      isTargetContextMenuOpen: () => false,
      closeTargetContextMenu: () => calls.push("close-context"),
      ...overrides.actions,
    },
  });

  return { controller, state, calls, elements };
}

test("layout preset overlay controller opens dropdown and closes competing menus", async () => {
  const { controller, state, calls } = createOverlayController({
    state: { layoutPresetMenu: { open: true } },
    actions: {
      isTargetContextMenuOpen: () => true,
      closeTargetContextMenu: () => calls.push("close-context"),
    },
  });

  await controller.openDropdown();

  assert.equal(state.layoutPresetDropdown.open, true);
  assert.equal(state.layoutPresetMenu.open, false);
  assert.deepEqual(calls, [
    "close-context",
    "menu-shell:hidden:",
    "menu.hide",
    "select:aria-expanded:true",
    "dropdown.show",
  ]);
});

test("layout preset overlay controller opens menu and closes dropdown", async () => {
  const { controller, state, calls } = createOverlayController({
    state: { layoutPresetDropdown: { open: true } },
  });

  await controller.openMenu();

  assert.equal(state.layoutPresetDropdown.open, false);
  assert.equal(state.layoutPresetMenu.open, true);
  assert.deepEqual(calls, [
    "menu-shell:hidden:",
    "dropdown.hide",
    "select:aria-expanded:false",
    "menu.show",
  ]);
});
