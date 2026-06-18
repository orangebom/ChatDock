import test from "node:test";
import assert from "node:assert/strict";

import { handleCloseRequest, hasBlockingOverlay } from "../src/close-confirm.js";

test("hasBlockingOverlay returns true when any modal-like layer is open", () => {
  assert.equal(hasBlockingOverlay(), false);
  assert.equal(hasBlockingOverlay({ siteManagerOpen: true }), true);
  assert.equal(hasBlockingOverlay({ closeConfirmOpen: true }), true);
  assert.equal(hasBlockingOverlay({ onboardingOpen: true }), true);
  assert.equal(hasBlockingOverlay({ targetContextMenuOpen: true }), true);
});

test("handleCloseRequest cancels close when user rejects confirmation", async () => {
  let preventCount = 0;
  const statusCalls = [];
  let destroyCalled = false;

  const result = await handleCloseRequest({
    event: { preventDefault() { preventCount += 1; } },
    showCloseConfirm: async () => false,
    destroyWindow: async () => { destroyCalled = true; },
    setStatus: (message, level) => statusCalls.push({ message, level }),
  });

  assert.equal(result, false);
  assert.equal(preventCount, 1);
  assert.equal(destroyCalled, false);
  assert.deepEqual(statusCalls, [{ message: "已取消关闭。", level: "muted" }]);
});

test("handleCloseRequest destroys window when user confirms", async () => {
  let preventCount = 0;
  let destroyCalled = false;

  const result = await handleCloseRequest({
    event: { preventDefault() { preventCount += 1; } },
    showCloseConfirm: async () => true,
    destroyWindow: async () => { destroyCalled = true; },
    setStatus: () => {},
  });

  assert.equal(result, true);
  assert.equal(preventCount, 1);
  assert.equal(destroyCalled, true);
});

test("handleCloseRequest reports destroy failure", async () => {
  const statusCalls = [];
  const errors = [];
  let preventCount = 0;

  const result = await handleCloseRequest({
    event: { preventDefault() { preventCount += 1; } },
    showCloseConfirm: async () => true,
    destroyWindow: async () => { throw new Error("boom"); },
    setStatus: (message, level) => statusCalls.push({ message, level }),
    onError: (error) => errors.push(String(error)),
  });

  assert.equal(result, false);
  assert.equal(preventCount, 2);
  assert.equal(errors.length, 1);
  assert.deepEqual(statusCalls, [{ message: "关闭失败：Error: boom", level: "fail" }]);
});
