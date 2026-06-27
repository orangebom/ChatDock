import test from "node:test";
import assert from "node:assert/strict";

import {
  renderPageTabs,
  renderTargetBar,
} from "../src/features/site-manager/target-bar-dom.ts";

function createClassList() {
  const values = new Set();
  return {
    add(value) {
      values.add(value);
    },
    has(value) {
      return values.has(value);
    },
    values,
  };
}

function createDocumentStub() {
  return {
    createElement(tagName) {
      return {
        tagName,
        type: "",
        checked: false,
        value: "",
        className: "",
        textContent: "",
        title: "",
        dataset: {},
        children: [],
        listeners: {},
        classList: createClassList(),
        append(...nodes) {
          this.children.push(...nodes);
        },
        appendChild(node) {
          this.children.push(node);
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
    },
  };
}

test("renderPageTabs creates page buttons and selected counter", async () => {
  const pageChanges = [];
  const container = createContainer();

  renderPageTabs({
    document: createDocumentStub(),
    container,
    pageCount: 2,
    activePageIndex: 0,
    selectedCount: 5,
    maxSitesPerPage: 4,
    selectedPrefix: "已选",
    getPageLabels: (pageIndex) => (pageIndex === 0 ? ["a", "b", "c", "d"] : ["e"]),
    onPageChange: async (pageIndex) => pageChanges.push(pageIndex),
  });

  assert.equal(container.innerHTML, "");
  assert.equal(container.children[0].className, "page-tab active");
  assert.equal(container.children[1].title, "1/4 个 AI");
  assert.equal(container.children[2].className, "page-counter");
  assert.equal(container.children[2].textContent, "已选 5");

  await container.children[1].listeners.click();

  assert.deepEqual(pageChanges, [1]);
});

test("renderTargetBar creates selectable AI pills with unavailable and context states", async () => {
  const changes = [];
  const contexts = [];
  const container = createContainer();

  renderTargetBar({
    document: createDocumentStub(),
    container,
    sites: [
      { label: "deepseek", title: "DeepSeek", accentColor: "#123456" },
      { label: "kimi", title: "Kimi", accentColor: "#abcdef" },
    ],
    selectedLabels: ["deepseek"],
    contextMenu: { open: true, siteLabel: "deepseek" },
    getAvailability: (label) => (label === "kimi" ? { message: "不可访问" } : null),
    isUnavailable: (label) => label === "kimi",
    createDot: (color) => ({ kind: "dot", color }),
    onContextMenu: (label, x, y) => contexts.push({ label, x, y }),
    onSelectionChange: async (label, selected) => changes.push({ label, selected }),
  });

  const first = container.children[0];
  const second = container.children[1];
  assert.equal(first.className, "target-pill active");
  assert.equal(first.classList.has("context-open"), true);
  assert.equal(first.children[2].className, "target-order");
  assert.equal(second.className, "target-pill unavailable");
  assert.equal(second.title, "不可访问");
  assert.equal(second["aria-label"], "Kimi，不可访问");

  first.listeners.contextmenu({ preventDefault() {}, clientX: 1, clientY: 2 });
  second.children[0].checked = true;
  await second.children[0].listeners.change();

  assert.deepEqual(contexts, [{ label: "deepseek", x: 1, y: 2 }]);
  assert.deepEqual(changes, [{ label: "kimi", selected: true }]);
});
