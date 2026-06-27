import test from "node:test";
import assert from "node:assert/strict";

import {
  createPanelShell,
  getPaneMetricsFromRect,
  getToolbarMetricsFromRect,
  renderPanelShells,
} from "../src/features/panels/panel-shells.ts";

function createDocumentStub() {
  return {
    createElement(tagName) {
      return {
        tagName,
        className: "",
        dataset: {},
        children: [],
        append(node) {
          this.children.push(node);
        },
      };
    },
  };
}

test("createPanelShell builds a panel article and webview host", () => {
  const shell = createPanelShell(createDocumentStub(), { label: "chatgpt" });

  assert.equal(shell.tagName, "article");
  assert.equal(shell.className, "panel-shell");
  assert.equal(shell.dataset.panel, "chatgpt");
  assert.equal(shell.children[0].className, "panel-body");
  assert.equal(shell.children[0].dataset.webviewHost, "chatgpt");
});

test("renderPanelShells resets layer and appends one shell per site", () => {
  const layer = {
    innerHTML: "old",
    children: [],
    appendChild(node) {
      this.children.push(node);
    },
  };

  renderPanelShells({
    document: createDocumentStub(),
    layer,
    sites: [{ label: "chatgpt" }, { label: "claude" }],
  });

  assert.equal(layer.innerHTML, "");
  assert.deepEqual(layer.children.map((item) => item.dataset.panel), ["chatgpt", "claude"]);
});

test("getPaneMetricsFromRect offsets panel body below toolbar", () => {
  assert.deepEqual(
    getPaneMetricsFromRect({ left: 10, top: 20, width: 300, height: 200 }, 34),
    { x: 10, y: 54, width: 300, height: 166 },
  );
});

test("getToolbarMetricsFromRect returns toolbar dimensions", () => {
  assert.deepEqual(
    getToolbarMetricsFromRect({ left: 10, top: 20, width: 300 }, 34),
    { x: 10, y: 20, width: 300, height: 34 },
  );
});
