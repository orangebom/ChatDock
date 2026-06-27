import test from "node:test";
import assert from "node:assert/strict";

import {
  getLayoutPresetApplyLabel,
  getLayoutPresetDeleteState,
  getLayoutPresetMetaLabel,
  getLayoutPresetSelectLabel,
  renderLayoutPresetList,
} from "../src/features/layout-presets/layout-presets-dom.ts";

function createDocumentStub() {
  return {
    createElement(tagName) {
      return {
        tagName,
        type: "",
        className: "",
        textContent: "",
        title: "",
        value: "",
        maxLength: 0,
        readOnly: false,
        disabled: false,
        dataset: {},
        children: [],
        listeners: {},
        style: {},
        append(...nodes) {
          this.children.push(...nodes);
        },
        appendChild(node) {
          this.children.push(node);
          return node;
        },
        addEventListener(type, listener) {
          this.listeners[type] = listener;
        },
        setAttribute(name, value) {
          this[name] = value;
        },
      };
    },
  };
}

function createContainer() {
  return {
    innerHTML: "old",
    children: [],
    appendChild(node) {
      this.children.push(node);
      return node;
    },
  };
}

test("getLayoutPresetSelectLabel returns active preset name or fallback", () => {
  assert.equal(getLayoutPresetSelectLabel({ name: "默认对比" }), "默认对比");
  assert.equal(getLayoutPresetSelectLabel(null), "选择布局");
});

test("getLayoutPresetMetaLabel describes selected AI labels", () => {
  const titleByLabel = (label) => ({ chatgpt: "ChatGPT", gemini: "Gemini" }[label] || label);

  assert.equal(getLayoutPresetMetaLabel([], titleByLabel), "空白布局");
  assert.equal(getLayoutPresetMetaLabel(["chatgpt", "gemini"], titleByLabel), "2 个 AI：ChatGPT、Gemini");
});

test("getLayoutPresetApplyLabel marks the active preset", () => {
  assert.equal(getLayoutPresetApplyLabel("default", "default"), "当前");
  assert.equal(getLayoutPresetApplyLabel("image", "default"), "应用");
});

test("getLayoutPresetDeleteState disables builtin presets and the last preset", () => {
  assert.deepEqual(getLayoutPresetDeleteState({ builtin: true }, 3), {
    disabled: true,
    title: "内置布局不可删除",
  });
  assert.deepEqual(getLayoutPresetDeleteState({ builtin: false }, 1), {
    disabled: true,
    title: "删除布局",
  });
  assert.deepEqual(getLayoutPresetDeleteState({ builtin: false }, 2), {
    disabled: false,
    title: "删除布局",
  });
});

test("renderLayoutPresetList exposes rename action and save flow", async () => {
  globalThis.document = createDocumentStub();
  const calls = [];
  const container = createContainer();

  renderLayoutPresetList({
    container,
    presets: [
      {
        id: "base",
        name: "默认对比",
        builtin: false,
        snapshot: { selectedSiteLabels: ["chatgpt", "gemini"] },
      },
    ],
    activePresetId: "base",
    editingPresetId: null,
    getSiteTitle: (label) => ({ chatgpt: "ChatGPT", gemini: "Gemini" }[label] || label),
    onStartRename: (presetId) => calls.push(["start", presetId]),
    onRename: (presetId, name) => calls.push(["rename", presetId, name]),
    onCancelRename: (presetId) => calls.push(["cancel", presetId]),
    onApply: async (presetId) => calls.push(["apply", presetId]),
    onDelete: async (presetId) => calls.push(["delete", presetId]),
  });

  const card = container.children[0];
  const actions = card.children[1];
  assert.equal(actions.children[0].textContent, "重命名");

  await actions.children[0].listeners.click();
  assert.deepEqual(calls, [["start", "base"]]);

  container.children = [];
  calls.length = 0;

  renderLayoutPresetList({
    container,
    presets: [
      {
        id: "base",
        name: "默认对比",
        builtin: false,
        snapshot: { selectedSiteLabels: ["chatgpt", "gemini"] },
      },
    ],
    activePresetId: "base",
    editingPresetId: "base",
    getSiteTitle: (label) => ({ chatgpt: "ChatGPT", gemini: "Gemini" }[label] || label),
    onStartRename: (presetId) => calls.push(["start", presetId]),
    onRename: (presetId, name) => calls.push(["rename", presetId, name]),
    onCancelRename: (presetId) => calls.push(["cancel", presetId]),
    onApply: async (presetId) => calls.push(["apply", presetId]),
    onDelete: async (presetId) => calls.push(["delete", presetId]),
  });

  const editingCard = container.children[0];
  const titleInput = editingCard.children[0].children[0];
  const editingActions = editingCard.children[1];

  assert.equal(titleInput.readOnly, false);
  assert.equal(editingActions.children[0].textContent, "保存");

  titleInput.value = "新的布局";
  await editingActions.children[0].listeners.click();

  assert.deepEqual(calls, [["rename", "base", "新的布局"]]);
});
