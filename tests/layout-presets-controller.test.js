import test from "node:test";
import assert from "node:assert/strict";

import { createLayoutPresetController } from "../src/features/layout-presets/layout-presets-controller.ts";

function createElement(tagName) {
  return {
    tagName,
    className: "",
    value: "",
    maxLength: 0,
    disabled: false,
    title: "",
    textContent: "",
    dataset: {},
    style: {},
    children: [],
    type: "",
    listeners: {},
    readOnly: false,
    focusCalls: 0,
    selectCalls: 0,
    focus() {
      this.focusCalls += 1;
    },
    select() {
      this.selectCalls += 1;
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
    append(...nodes) {
      this.children.push(...nodes);
    },
    appendChild(node) {
      this.children.push(node);
      return node;
    },
  };
}

function createController(overrides = {}) {
  const calls = [];
  globalThis.document = { createElement };
  const elements = new Map([
    ["#layout-preset-select", { title: "", setAttribute() {} }],
    ["#layout-preset-current", { textContent: "" }],
    ["#layout-presets-list", createElement("div")],
    ["#layout-preset-name", { focus: () => calls.push("focus"), select: () => calls.push("select") }],
  ]);
  const state = {
    layoutPresets: {
      activePresetId: "base",
      items: [
        {
          id: "base",
          name: "默认",
          builtin: false,
          snapshot: { selectedSiteLabels: [], activePageIndex: 0, pageLayouts: [] },
        },
      ],
    },
    workspace: {
      visibleSiteLabels: ["chatgpt", "gemini"],
      selectedSiteLabels: [],
      activePageIndex: 0,
      pageLayouts: [],
    },
    maximizedLabel: "chatgpt",
    isApplyingLayoutPreset: false,
    editingLayoutPresetId: null,
    ...overrides.state,
  };

  const controller = createLayoutPresetController({
    document: { querySelector: (selector) => elements.get(selector) || null },
    state,
    actions: {
      getSiteMeta: (label) => ({ title: label.toUpperCase() }),
      getAllSiteLabels: () => ["chatgpt", "gemini"],
      normalizePageLayouts: (layouts, pageCount) =>
        Array.from({ length: pageCount }, (_, index) => layouts[index] || {}),
      getPageCount: (count) => Math.max(1, Math.ceil(count / 4)),
      persistLayoutPresets: () => calls.push("persist-presets"),
      persistWorkspace: () => calls.push("persist-workspace"),
      renderWorkspace: () => calls.push("render-workspace"),
      refreshLayout: async () => calls.push("refresh-layout"),
      setStatus: (message, level) => calls.push(`status:${level}:${message}`),
      syncLayoutPresetDropdownState: async () => calls.push("sync-dropdown"),
      openLayoutPresets: async () => calls.push("open-layout-presets"),
      closeLayoutPresetMenu: async () => calls.push("close-menu"),
      ...overrides.actions,
    },
  });

  return { controller, state, calls, elements };
}

test("layout preset controller saves current layout as custom preset", () => {
  const { controller, state, calls } = createController();

  const saved = controller.saveAs("  我的布局  ");

  assert.equal(saved, true);
  assert.equal(state.layoutPresets.items.length, 2);
  assert.equal(state.layoutPresets.items[1].name, "我的布局");
  assert.equal(state.layoutPresets.activePresetId, state.layoutPresets.items[1].id);
  assert.equal(calls.includes("persist-presets"), true);
  assert.equal(calls.some((call) => String(call).startsWith("status:ok:已保存布局")), true);
});

test("layout preset controller enters rename mode for a target preset", () => {
  const { controller, state } = createController();

  controller.startRename("base");

  assert.equal(state.editingLayoutPresetId, "base");
});

test("layout preset controller applies preset and skips hidden sites", async () => {
  const { controller, state, calls } = createController({
    state: {
      layoutPresets: {
        activePresetId: "base",
        items: [
          {
            id: "image",
            name: "图片生成",
            builtin: false,
            snapshot: {
              selectedSiteLabels: ["chatgpt", "hidden-ai"],
              activePageIndex: 2,
              pageLayouts: [{ twoWaySplit: 0.5 }],
            },
          },
        ],
      },
    },
  });

  await controller.apply("image");

  assert.deepEqual(state.workspace.selectedSiteLabels, ["chatgpt"]);
  assert.equal(state.workspace.activePageIndex, 0);
  assert.equal(state.maximizedLabel, null);
  assert.deepEqual(calls, [
    "persist-presets",
    "persist-workspace",
    "render-workspace",
    "sync-dropdown",
    "refresh-layout",
    "status:warn:已应用布局：图片生成，1 个隐藏 AI 已跳过",
  ]);
});

test("layout preset controller opens editor from menu intent", async () => {
  const { controller, calls } = createController();

  await controller.runMenuAction("save-as");

  assert.deepEqual(calls, ["close-menu", "open-layout-presets", "focus", "select"]);
});
