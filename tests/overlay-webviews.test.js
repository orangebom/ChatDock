import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOverlayWebviewOptions,
  buildLayoutPresetDropdownState,
  buildLayoutPresetMenuState,
  createOverlayWebviewController,
  shouldSyncOverlayState,
} from "../src/tauri/overlay-webviews.ts";

test("buildOverlayWebviewOptions applies shared overlay webview defaults", () => {
  assert.deepEqual(
    buildOverlayWebviewOptions("/layout-preset-dropdown.html", { x: 10, y: 20, width: 180, height: 96 }),
    {
      url: "/layout-preset-dropdown.html",
      x: 10,
      y: 20,
      width: 180,
      height: 96,
      transparent: true,
      focus: false,
      dragDropEnabled: false,
      zoomHotkeysEnabled: false,
      generalAutofillEnabled: false,
      devtools: false,
    },
  );
});

test("buildOverlayWebviewOptions uses fallback metrics when metrics are missing", () => {
  assert.deepEqual(
    buildOverlayWebviewOptions("/layout-preset-menu.html", null, { width: 168, height: 84 }),
    {
      url: "/layout-preset-menu.html",
      x: 0,
      y: 0,
      width: 168,
      height: 84,
      transparent: true,
      focus: false,
      dragDropEnabled: false,
      zoomHotkeysEnabled: false,
      generalAutofillEnabled: false,
      devtools: false,
    },
  );
});

test("buildLayoutPresetDropdownState serializes only dropdown-safe preset fields", () => {
  assert.deepEqual(
    buildLayoutPresetDropdownState("dark", {
      activePresetId: "chat",
      items: [
        { id: "chat", name: "对话布局", siteLabels: ["chatgpt"], builtin: true },
        { id: "image", name: "图片布局", siteLabels: ["gemini"] },
      ],
    }),
    {
      theme: "dark",
      activePresetId: "chat",
      presets: [
        { id: "chat", name: "对话布局" },
        { id: "image", name: "图片布局" },
      ],
    },
  );
});

test("buildLayoutPresetDropdownState tolerates unloaded layout presets", () => {
  assert.deepEqual(buildLayoutPresetDropdownState("light", null), {
    theme: "light",
    activePresetId: "",
    presets: [],
  });
});

test("buildLayoutPresetMenuState serializes the active theme", () => {
  assert.deepEqual(buildLayoutPresetMenuState("dark"), { theme: "dark" });
});

test("shouldSyncOverlayState skips closed overlays that have not been created", () => {
  assert.equal(shouldSyncOverlayState(null, false), false);
  assert.equal(shouldSyncOverlayState({}, false), true);
  assert.equal(shouldSyncOverlayState(null, true), true);
});

function createMockWebview(label) {
  return {
    label,
    hidden: 0,
    shown: 0,
    focused: 0,
    autoResize: null,
    positions: [],
    sizes: [],
    async hide() {
      this.hidden += 1;
    },
    async show() {
      this.shown += 1;
    },
    async setFocus() {
      this.focused += 1;
    },
    async setAutoResize(value) {
      this.autoResize = value;
    },
    async setPosition(value) {
      this.positions.push(value);
    },
    async setSize(value) {
      this.sizes.push(value);
    },
  };
}

test("createOverlayWebviewController creates and caches missing webviews", async () => {
  let cached = null;
  let createdOptions = null;
  const created = createMockWebview("layout");
  class MockWebview {
    constructor(appWindow, label, options) {
      createdOptions = { appWindow, label, options };
    }
  }

  const controller = createOverlayWebviewController({
    appWindow: "window",
    Webview: MockWebview,
    label: "layout",
    route: "/layout.html",
    fallbackSize: { width: 180, height: 96 },
    getCached: () => cached,
    setCached: (value) => {
      cached = value;
    },
    getByLabel: async () => null,
    waitForWebview: async () => created,
    getMetrics: () => ({ x: 1, y: 2, width: 3, height: 4 }),
    toPhysicalMetrics: async (metrics) => metrics,
    isOpen: () => false,
    createPosition: (x, y) => ({ x, y }),
    createSize: (width, height) => ({ width, height }),
    emitTo: async () => {},
    eventName: "layout-state",
    getPayload: () => ({}),
  });

  const result = await controller.ensure();

  assert.equal(result, created);
  assert.equal(cached, created);
  assert.equal(created.hidden, 1);
  assert.equal(created.autoResize, false);
  assert.deepEqual(createdOptions, {
    appWindow: "window",
    label: "layout",
    options: buildOverlayWebviewOptions("/layout.html", { x: 1, y: 2, width: 3, height: 4 }, { width: 180, height: 96 }),
  });
});

test("createOverlayWebviewController positions open webviews", async () => {
  const cached = createMockWebview("layout");
  const controller = createOverlayWebviewController({
    appWindow: "window",
    Webview: class {},
    label: "layout",
    route: "/layout.html",
    fallbackSize: { width: 180, height: 96 },
    getCached: () => cached,
    setCached: () => {},
    getByLabel: async () => cached,
    waitForWebview: async () => cached,
    getMetrics: () => ({ x: 10, y: 20, width: 180, height: 96 }),
    toPhysicalMetrics: async (metrics) => metrics,
    isOpen: () => true,
    createPosition: (x, y) => ({ x, y }),
    createSize: (width, height) => ({ width, height }),
    emitTo: async () => {},
    eventName: "layout-state",
    getPayload: () => ({}),
  });

  await controller.position();

  assert.deepEqual(cached.positions, [{ x: 10, y: 20 }]);
  assert.deepEqual(cached.sizes, [{ width: 180, height: 96 }]);
});

test("createOverlayWebviewController hides open webviews when metrics disappear", async () => {
  const cached = createMockWebview("layout");
  let hideRequests = 0;
  const controller = createOverlayWebviewController({
    appWindow: "window",
    Webview: class {},
    label: "layout",
    route: "/layout.html",
    fallbackSize: { width: 180, height: 96 },
    getCached: () => cached,
    setCached: () => {},
    getByLabel: async () => cached,
    waitForWebview: async () => cached,
    getMetrics: () => null,
    toPhysicalMetrics: async (metrics) => metrics,
    isOpen: () => true,
    onHide: () => {
      hideRequests += 1;
    },
    createPosition: (x, y) => ({ x, y }),
    createSize: (width, height) => ({ width, height }),
    emitTo: async () => {},
    eventName: "layout-state",
    getPayload: () => ({}),
  });

  await controller.position();

  assert.equal(hideRequests, 1);
  assert.equal(cached.hidden, 1);
});

test("createOverlayWebviewController emits state only when open or already cached", async () => {
  const cached = createMockWebview("layout");
  const emissions = [];
  const controller = createOverlayWebviewController({
    appWindow: "window",
    Webview: class {},
    label: "layout",
    route: "/layout.html",
    fallbackSize: { width: 180, height: 96 },
    getCached: () => cached,
    setCached: () => {},
    getByLabel: async () => cached,
    waitForWebview: async () => cached,
    getMetrics: () => ({ x: 0, y: 0, width: 1, height: 1 }),
    toPhysicalMetrics: async (metrics) => metrics,
    isOpen: () => false,
    createPosition: (x, y) => ({ x, y }),
    createSize: (width, height) => ({ width, height }),
    emitTo: async (...args) => {
      emissions.push(args);
    },
    eventName: "layout-state",
    getPayload: () => ({ theme: "dark" }),
  });

  await controller.sync();

  assert.deepEqual(emissions, [["layout", "layout-state", { theme: "dark" }]]);
});
