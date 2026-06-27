import test from "node:test";
import assert from "node:assert/strict";

import { createTargetContextMenuController } from "../src/features/site-manager/target-context-menu.ts";

function createClassList(calls, label) {
  return {
    add: (className) => calls.push(`${label}:add:${className}`),
    remove: (className) => calls.push(`${label}:remove:${className}`),
  };
}

test("target context menu controller opens, positions, and closes menu", () => {
  const calls = [];
  const state = { open: false, siteLabel: null, x: 0, y: 0 };
  const menu = {
    offsetWidth: 156,
    offsetHeight: 94,
    style: {
      left: "",
      top: "",
      removeProperty: (name) => calls.push(`remove-style:${name}`),
    },
  };
  const shell = {
    hidden: true,
    querySelector: () => menu,
  };
  const title = { textContent: "" };
  const pills = new Map([
    ['.target-pill[data-site-label="kimi"]', { classList: createClassList(calls, "kimi") }],
  ]);
  const controller = createTargetContextMenuController({
    document: {
      querySelector: (selector) => {
        if (selector === "#target-context-menu") return shell;
        if (selector === "#target-context-title") return title;
        return pills.get(selector) || null;
      },
    },
    window: { innerWidth: 300, innerHeight: 200 },
    state,
    actions: {
      getSiteMeta: () => ({ title: "Kimi" }),
      syncVisibleWebviews: async () => calls.push("sync-webviews"),
      syncVisibleToolbarWebviews: async () => calls.push("sync-toolbar"),
    },
  });

  controller.open("kimi", 290, 190);

  assert.equal(state.open, true);
  assert.equal(state.siteLabel, "kimi");
  assert.equal(title.textContent, "Kimi 操作");
  assert.equal(shell.hidden, false);
  assert.equal(menu.style.left, "134px");
  assert.equal(menu.style.top, "96px");
  assert.equal(controller.isOpen(), true);

  controller.close();

  assert.deepEqual(
    calls.filter((call) => !call.startsWith("sync")),
    ["kimi:add:context-open", "remove-style:left", "remove-style:top", "kimi:remove:context-open"],
  );
  assert.deepEqual(state, { open: false, siteLabel: null, x: 0, y: 0 });
});
