import test from "node:test";
import assert from "node:assert/strict";

import {
  renderEmptyPanelState,
  renderLayoutHandles,
} from "../src/features/panels/panels-dom.ts";

function createDocumentStub() {
  return {
    createElement(tagName) {
      return {
        tagName,
        type: "",
        className: "",
        textContent: "",
        alt: "",
        src: "",
        hidden: false,
        dataset: {},
        style: {},
        children: [],
        listeners: {},
        append(...nodes) {
          this.children.push(...nodes);
        },
        appendChild(node) {
          this.children.push(node);
        },
        addEventListener(type, listener) {
          this.listeners[type] = listener;
        },
      };
    },
  };
}

function createContainer() {
  return {
    innerHTML: "old",
    hidden: false,
    children: [],
    append(node) {
      this.children.push(node);
    },
    appendChild(node) {
      this.children.push(node);
    },
  };
}

test("renderLayoutHandles creates pointer handles with geometry styles", () => {
  const layer = createContainer();
  const starts = [];

  renderLayoutHandles({
    document: createDocumentStub(),
    layer,
    handles: [{ key: "two-way", axis: "x", x: 100, y: 0, width: 12, height: 400 }],
    onPointerDown: (event, handle) => starts.push([event.type, handle.key]),
  });

  assert.equal(layer.innerHTML, "");
  const handle = layer.children[0];
  assert.equal(handle.type, "button");
  assert.equal(handle.className, "layout-handle");
  assert.deepEqual(handle.dataset, { axis: "x", key: "two-way" });
  assert.deepEqual(handle.style, { left: "100px", top: "0px", width: "12px", height: "400px" });

  handle.listeners.pointerdown({ type: "pointerdown" });

  assert.deepEqual(starts, [["pointerdown", "two-way"]]);
});

test("renderEmptyPanelState hides the empty state when targets are visible", () => {
  const container = createContainer();

  renderEmptyPanelState({
    document: createDocumentStub(),
    container,
    visibleCount: 2,
    title: "空",
    message: "暂无",
  });

  assert.equal(container.innerHTML, "");
  assert.equal(container.hidden, true);
  assert.equal(container.children.length, 0);
});

test("renderEmptyPanelState renders the full empty state card", () => {
  const container = createContainer();

  renderEmptyPanelState({
    document: createDocumentStub(),
    container,
    visibleCount: 0,
    title: "尚未选择 AI",
    message: "请选择 AI",
  });

  assert.equal(container.hidden, false);
  const card = container.children[0];
  assert.equal(card.className, "layout-empty-card");
  assert.equal(card.children[1].textContent, "尚未选择 AI");
  assert.equal(card.children[2].textContent, "请选择 AI");
  assert.equal(card.children[3].children.length, 3);
  assert.equal(card.children[4].textContent, "从底部开始组装你的 AI 工作台");
});
