import test from "node:test";
import assert from "node:assert/strict";

import {
  createJsonStorage,
  loadJson,
  saveJson,
} from "../src/storage/json-storage.ts";

function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

test("loadJson returns parsed values from storage", () => {
  const storage = createMemoryStorage({ settings: JSON.stringify({ theme: "dark" }) });

  assert.deepEqual(loadJson(storage, "settings", { theme: "system" }), { theme: "dark" });
});

test("loadJson returns fallback when storage is empty or malformed", () => {
  assert.deepEqual(loadJson(createMemoryStorage(), "missing", { ok: true }), { ok: true });
  assert.deepEqual(loadJson(createMemoryStorage({ broken: "{" }), "broken", { ok: true }), { ok: true });
});

test("saveJson serializes values into storage", () => {
  const storage = createMemoryStorage();

  saveJson(storage, "workspace", { selectedSiteLabels: ["chatgpt"] });

  assert.equal(storage.getItem("workspace"), '{"selectedSiteLabels":["chatgpt"]}');
});

test("createJsonStorage creates scoped read and write helpers", () => {
  const storage = createMemoryStorage();
  const settings = createJsonStorage(storage, "settings", { theme: "system" });

  assert.deepEqual(settings.load(), { theme: "system" });

  settings.save({ theme: "light" });

  assert.deepEqual(settings.load(), { theme: "light" });
});
