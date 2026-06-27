import test from "node:test";
import assert from "node:assert/strict";

import {
  createDot,
  createDragHandle,
  createIcon,
  createStatusDot,
} from "../src/features/ui-elements.ts";

function createElement(tagName) {
  return {
    tagName,
    className: "",
    textContent: "",
    style: {},
    attributes: {},
    children: [],
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    append(...nodes) {
      this.children.push(...nodes);
    },
    appendChild(node) {
      this.children.push(node);
    },
  };
}

function createDocumentStub() {
  return {
    createElement,
    createElementNS(_namespace, tagName) {
      return createElement(tagName);
    },
  };
}

test("createIcon renders known path segments", () => {
  const icon = createIcon(createDocumentStub(), "reload");

  assert.equal(icon.tagName, "svg");
  assert.equal(icon.attributes.viewBox, "0 0 24 24");
  assert.equal(icon.attributes["aria-hidden"], "true");
  assert.deepEqual(icon.children.map((child) => child.attributes.d), [
    "M20 11a8 8 0 1 1-2.34-5.66",
    "M20 4v6h-6",
  ]);
});

test("createDot and createStatusDot apply classes and accent color", () => {
  const document = createDocumentStub();

  const dot = createDot(document, "#123456");
  assert.equal(dot.tagName, "span");
  assert.equal(dot.className, "dot");
  assert.equal(dot.style.background, "#123456");

  const statusDot = createStatusDot(document, "#abcdef");
  assert.equal(statusDot.className, "status-dot");
  assert.equal(statusDot.style.background, "#abcdef");
});

test("createDragHandle renders accessible six-dot handle", () => {
  const handle = createDragHandle(createDocumentStub());

  assert.equal(handle.className, "manager-drag-handle");
  assert.equal(handle.attributes.role, "button");
  assert.equal(handle.attributes.tabindex, "0");
  assert.equal(handle.attributes["aria-label"], "拖动排序");
  assert.equal(handle.children[0].tagName, "svg");
  assert.equal(handle.children[0].children.length, 6);
});
