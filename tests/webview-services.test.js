import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPanelToolbarState,
  buildPanelWebviewOptions,
  buildToolbarUrl,
  buildToolbarWebviewOptions,
  createPanelWebviewController,
  getToolbarLabel,
  shouldKeepWebviewVisible,
} from "../src/tauri/webview-panels.ts";

test("getToolbarLabel appends the toolbar suffix", () => {
  assert.equal(getToolbarLabel("chatgpt"), "chatgpt-toolbar");
});

test("buildToolbarUrl serializes site metadata for toolbar webviews", () => {
  assert.equal(
    buildToolbarUrl({
      label: "deepseek",
      title: "DeepSeek",
      accentColor: "#123456",
    }),
    "/panel-toolbar.html?site=deepseek&title=DeepSeek&accent=%23123456",
  );
});

test("shouldKeepWebviewVisible keeps current visible panels alive", () => {
  assert.equal(shouldKeepWebviewVisible(true, false), true);
  assert.equal(shouldKeepWebviewVisible(false, true), true);
  assert.equal(shouldKeepWebviewVisible(false, false), false);
});

test("buildToolbarWebviewOptions applies toolbar defaults and fallbacks", () => {
  assert.deepEqual(
    buildToolbarWebviewOptions("/panel-toolbar.html", null, 34),
    {
      url: "/panel-toolbar.html",
      x: 0,
      y: 0,
      width: 1200,
      height: 34,
      zoomHotkeysEnabled: false,
      generalAutofillEnabled: false,
      devtools: false,
    },
  );
});

test("buildPanelWebviewOptions applies panel defaults and site metadata", () => {
  assert.deepEqual(
    buildPanelWebviewOptions(
      {
        label: "chatgpt",
        url: "https://chatgpt.com",
        dataDirectory: "chatgpt-profile",
      },
      { x: 1, y: 2, width: 3, height: 4 },
    ),
    {
      url: "https://chatgpt.com",
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      dataDirectory: "chatgpt-profile",
      zoomHotkeysEnabled: false,
      generalAutofillEnabled: true,
      devtools: true,
    },
  );
});

test("buildPanelToolbarState serializes panel toolbar state", () => {
  assert.deepEqual(
    buildPanelToolbarState(
      { label: "gemini", title: "Gemini", accentColor: "#4285f4" },
      "light",
      true,
    ),
    {
      site: "gemini",
      title: "Gemini",
      accent: "#4285f4",
      theme: "light",
      maximized: true,
    },
  );
});

function createMockWebview(label) {
  return {
    label,
    hidden: 0,
    shown: 0,
    autoResize: null,
    positions: [],
    sizes: [],
    async hide() {
      this.hidden += 1;
    },
    async show() {
      this.shown += 1;
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

test("createPanelWebviewController creates, positions, and caches a webview", async () => {
  const created = createMockWebview("chatgpt");
  const cached = new Map();
  const pending = new Map();
  const constructions = [];
  class MockWebview {
    constructor(appWindow, label, options) {
      constructions.push({ appWindow, label, options });
    }
  }

  const controller = createPanelWebviewController({
    appWindow: "window",
    Webview: MockWebview,
    cache: cached,
    pending,
    getByLabel: async () => null,
    waitForWebview: async () => created,
    getSite: () => ({
      label: "chatgpt",
      url: "https://chatgpt.com",
      dataDirectory: "chatgpt-profile",
    }),
    getMetrics: async () => ({ x: 1, y: 2, width: 3, height: 4 }),
    buildOptions: (site, metrics) => buildPanelWebviewOptions(site, metrics),
    shouldKeepVisible: () => true,
    createPosition: (x, y) => ({ x, y }),
    createSize: (width, height) => ({ width, height }),
    onCreated: () => {},
    onError: () => {},
    afterEnsure: async () => {},
  });

  const result = await controller.ensure("chatgpt", true);

  assert.equal(result, created);
  assert.equal(cached.get("chatgpt"), created);
  assert.equal(created.autoResize, false);
  assert.deepEqual(created.positions, [{ x: 1, y: 2 }]);
  assert.deepEqual(created.sizes, [{ width: 3, height: 4 }]);
  assert.equal(created.shown, 1);
  assert.deepEqual(constructions[0].options, {
    url: "https://chatgpt.com",
    x: 1,
    y: 2,
    width: 3,
    height: 4,
    dataDirectory: "chatgpt-profile",
    zoomHotkeysEnabled: false,
    generalAutofillEnabled: true,
    devtools: true,
  });
});

test("createPanelWebviewController reuses pending webviews and hides when requested", async () => {
  const pendingWebview = createMockWebview("chatgpt");
  const pending = new Map([["chatgpt", Promise.resolve(pendingWebview)]]);
  const controller = createPanelWebviewController({
    appWindow: "window",
    Webview: class {},
    cache: new Map(),
    pending,
    getByLabel: async () => null,
    waitForWebview: async () => pendingWebview,
    getSite: () => ({ label: "chatgpt", url: "https://chatgpt.com" }),
    getMetrics: async () => null,
    buildOptions: (site, metrics) => buildPanelWebviewOptions(site, metrics),
    shouldKeepVisible: () => false,
    createPosition: (x, y) => ({ x, y }),
    createSize: (width, height) => ({ width, height }),
  });

  const result = await controller.ensure("chatgpt", false);

  assert.equal(result, pendingWebview);
  assert.equal(pendingWebview.hidden, 1);
});

test("createPanelWebviewController re-checks visibility before showing after async work", async () => {
  const created = createMockWebview("chatgpt");
  const visibility = { suppress: false };
  const controller = createPanelWebviewController({
    appWindow: "window",
    Webview: class {},
    cache: new Map([["chatgpt", created]]),
    pending: new Map(),
    getByLabel: async () => created,
    waitForWebview: async () => created,
    getSite: () => ({ label: "chatgpt", url: "https://chatgpt.com" }),
    getMetrics: async () => ({ x: 1, y: 2, width: 3, height: 4 }),
    buildOptions: (site, metrics) => buildPanelWebviewOptions(site, metrics),
    shouldKeepVisible: () => !visibility.suppress,
    createPosition: (x, y) => ({ x, y }),
    createSize: (width, height) => ({ width, height }),
    afterEnsure: async () => {},
  });

  const pendingEnsure = controller.ensure("chatgpt", true);
  visibility.suppress = true;
  await pendingEnsure;

  assert.equal(created.shown, 0);
  assert.equal(created.hidden, 1);
});

test("createPanelWebviewController relayouts only visible targets with metrics", async () => {
  const visible = createMockWebview("visible");
  const hidden = createMockWebview("hidden");
  const cache = new Map([
    ["visible", visible],
    ["hidden", hidden],
  ]);
  const controller = createPanelWebviewController({
    appWindow: "window",
    Webview: class {},
    cache,
    pending: new Map(),
    getByLabel: async () => null,
    waitForWebview: async (label) => cache.get(label),
    getSite: (label) => ({ label, url: `https://${label}.test` }),
    getMetrics: async (label) => (label === "visible" ? { x: 8, y: 9, width: 10, height: 11 } : null),
    buildOptions: (site, metrics) => buildPanelWebviewOptions(site, metrics),
    shouldKeepVisible: () => true,
    createPosition: (x, y) => ({ x, y }),
    createSize: (width, height) => ({ width, height }),
  });

  await controller.relayout([{ label: "visible" }, { label: "hidden" }], new Set(["visible"]));

  assert.deepEqual(visible.positions, [{ x: 8, y: 9 }]);
  assert.deepEqual(visible.sizes, [{ width: 10, height: 11 }]);
  assert.equal(visible.shown, 1);
  assert.equal(hidden.hidden, 1);
});

test("createPanelWebviewController relayout hides panels while overlays suppress content", async () => {
  const visible = createMockWebview("visible");
  const cache = new Map([["visible", visible]]);
  const controller = createPanelWebviewController({
    appWindow: "window",
    Webview: class {},
    cache,
    pending: new Map(),
    getByLabel: async () => null,
    waitForWebview: async (label) => cache.get(label),
    getSite: (label) => ({ label, url: `https://${label}.test` }),
    getMetrics: async () => ({ x: 8, y: 9, width: 10, height: 11 }),
    buildOptions: (site, metrics) => buildPanelWebviewOptions(site, metrics),
    shouldKeepVisible: () => true,
    createPosition: (x, y) => ({ x, y }),
    createSize: (width, height) => ({ width, height }),
  });

  await controller.relayout([{ label: "visible" }], new Set(["visible"]), true);

  assert.equal(visible.shown, 0);
  assert.equal(visible.hidden, 1);
});
