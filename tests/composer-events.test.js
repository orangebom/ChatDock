import test from "node:test";
import assert from "node:assert/strict";

import {
  createPromptDropTracker,
  getDropFileSummaries,
} from "../src/features/composer/composer-events.ts";

test("createPromptDropTracker tracks nested drag depth and resets state", () => {
  const states = [];
  const tracker = createPromptDropTracker((active) => states.push(active));

  tracker.enter();
  tracker.enter();
  tracker.leave(false);
  tracker.leave(false);
  tracker.enter();
  tracker.reset();

  assert.deepEqual(states, [true, true, false, true, false]);
});

test("createPromptDropTracker forces inactive when leaving the current target", () => {
  const states = [];
  const tracker = createPromptDropTracker((active) => states.push(active));

  tracker.enter();
  tracker.enter();
  tracker.leave(true);

  assert.deepEqual(states, [true, true, false]);
});

test("getDropFileSummaries keeps only debug-safe file details", () => {
  const files = [
    { name: "a.png", type: "image/png", size: 123 },
    { name: "b.pdf", type: "application/pdf", size: 456 },
  ];

  assert.deepEqual(getDropFileSummaries(files), files);
});
