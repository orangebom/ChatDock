import test from "node:test";
import assert from "node:assert/strict";

import {
  createManagerItem,
  renderSiteManagerLists,
} from "../src/features/site-manager/site-manager-dom.ts";

function createDocumentStub() {
  return {
    createElement(tagName) {
      return {
        tagName,
        type: "",
        className: "",
        textContent: "",
        title: "",
        dataset: {},
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

test("createManagerItem renders visible site with drag handle and remove action", async () => {
  const calls = [];
  const item = createManagerItem({
    document: createDocumentStub(),
    site: { label: "chatgpt", title: "ChatGPT", accentColor: "#10a37f" },
    visible: true,
    createDot: (color) => ({ kind: "dot", color }),
    createDragHandle: () => ({ kind: "handle" }),
    onAdd: async (label) => calls.push(["add", label]),
    onRemove: async (label) => calls.push(["remove", label]),
  });

  assert.equal(item.className, "manager-item");
  assert.equal(item.dataset.siteLabel, "chatgpt");
  const actions = item.children[1];
  assert.equal(actions.children[0].kind, "handle");
  assert.equal(actions.children[1].textContent, "移除");

  await actions.children[1].listeners.click();

  assert.deepEqual(calls, [["remove", "chatgpt"]]);
});

test("createManagerItem renders hidden site with add action", async () => {
  const calls = [];
  const item = createManagerItem({
    document: createDocumentStub(),
    site: { label: "claude", title: "Claude", accentColor: "#d97757" },
    visible: false,
    createDot: (color) => ({ kind: "dot", color }),
    createDragHandle: () => ({ kind: "handle" }),
    onAdd: async (label) => calls.push(["add", label]),
    onRemove: async (label) => calls.push(["remove", label]),
  });

  const actions = item.children[1];
  assert.equal(actions.children.length, 1);
  assert.equal(actions.children[0].textContent, "添加");

  await actions.children[0].listeners.click();

  assert.deepEqual(calls, [["add", "claude"]]);
});

test("renderSiteManagerLists resets containers and updates counts", () => {
  const visibleContainer = createContainer();
  const hiddenContainer = createContainer();
  const visibleCount = { textContent: "" };
  const hiddenCount = { textContent: "" };

  renderSiteManagerLists({
    visibleContainer,
    hiddenContainer,
    visibleCount,
    hiddenCount,
    visibleSites: [{ label: "chatgpt", title: "ChatGPT", accentColor: "#10a37f" }],
    hiddenSites: [{ label: "claude", title: "Claude", accentColor: "#d97757" }],
    createItem: (site, visible) => ({ label: site.label, visible }),
  });

  assert.equal(visibleContainer.innerHTML, "");
  assert.equal(hiddenContainer.innerHTML, "");
  assert.equal(visibleCount.textContent, "1 个");
  assert.equal(hiddenCount.textContent, "1 个");
  assert.deepEqual(visibleContainer.children, [{ label: "chatgpt", visible: true }]);
  assert.deepEqual(hiddenContainer.children, [{ label: "claude", visible: false }]);
});
