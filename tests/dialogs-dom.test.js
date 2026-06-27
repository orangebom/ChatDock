import test from "node:test";
import assert from "node:assert/strict";

import {
  focusElementOnNextFrame,
  hideModalElement,
  isModalElementOpen,
  showModalElement,
} from "../src/features/dialogs/dialogs-dom.ts";

test("isModalElementOpen detects visible modal elements", () => {
  assert.equal(isModalElementOpen(null), false);
  assert.equal(isModalElementOpen({ hidden: true }), false);
  assert.equal(isModalElementOpen({ hidden: false }), true);
});

test("showModalElement and hideModalElement toggle hidden state", () => {
  const modal = { hidden: true };

  assert.equal(showModalElement(modal), true);
  assert.equal(modal.hidden, false);

  assert.equal(hideModalElement(modal), true);
  assert.equal(modal.hidden, true);
});

test("showModalElement and hideModalElement report missing modal", () => {
  assert.equal(showModalElement(null), false);
  assert.equal(hideModalElement(null), false);
});

test("focusElementOnNextFrame schedules focus for a target element", async () => {
  let frameCount = 0;
  let focusCount = 0;
  const requestAnimationFrame = (callback) => {
    frameCount += 1;
    callback();
  };

  focusElementOnNextFrame({ focus: () => { focusCount += 1; } }, requestAnimationFrame);

  assert.equal(frameCount, 1);
  assert.equal(focusCount, 1);
});

test("focusElementOnNextFrame tolerates missing focus target", () => {
  let frameCount = 0;
  focusElementOnNextFrame(null, () => {
    frameCount += 1;
  });

  assert.equal(frameCount, 0);
});
