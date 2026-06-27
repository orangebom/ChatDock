import test from "node:test";
import assert from "node:assert/strict";

import {
  createLayoutPresetId,
  getLayoutPresetMenuIntent,
  normalizeLayoutPresetName,
} from "../src/features/layout-presets/layout-presets-actions.ts";

test("normalizeLayoutPresetName trims names and rejects empty values", () => {
  assert.equal(normalizeLayoutPresetName("  图片生成  "), "图片生成");
  assert.equal(normalizeLayoutPresetName("   "), "");
});

test("createLayoutPresetId creates custom layout ids", () => {
  const id = createLayoutPresetId(() => 123456789, () => 0.123456);

  assert.equal(id, "custom-21i3v9-4fzyo");
});

test("getLayoutPresetMenuIntent maps menu actions to stable intents", () => {
  assert.equal(getLayoutPresetMenuIntent("save-as"), "save-as");
  assert.equal(getLayoutPresetMenuIntent("edit"), "edit");
  assert.equal(getLayoutPresetMenuIntent("unknown"), "none");
  assert.equal(getLayoutPresetMenuIntent(undefined), "none");
});
