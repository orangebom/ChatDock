import test from "node:test";
import assert from "node:assert/strict";

import {
  loadSiteAvailability,
  persistSiteAvailability,
  sanitizeAvailabilityRecord,
} from "../src/state/availability.ts";

test("sanitizeAvailabilityRecord normalizes cached availability records", () => {
  assert.deepEqual(sanitizeAvailabilityRecord("kimi", { available: false, message: "", checkedAt: 123 }), {
    available: false,
    message: "不可访问",
    verifiedByWebview: false,
    checkedAt: 123,
  });
  assert.deepEqual(sanitizeAvailabilityRecord("chatgpt", { available: true, message: "blocked", verifiedByWebview: true }), {
    available: true,
    message: "",
    verifiedByWebview: true,
    checkedAt: null,
  });
  assert.equal(sanitizeAvailabilityRecord("", { available: true }), null);
});

test("loadSiteAvailability parses valid records and drops invalid records", () => {
  const storage = {
    getItem: () => JSON.stringify({
      kimi: { available: false, message: "timeout", checkedAt: 10 },
      bad: null,
    }),
  };

  const result = loadSiteAvailability(storage, "key");

  assert.equal(result.size, 1);
  assert.deepEqual(result.get("kimi"), {
    available: false,
    message: "timeout",
    verifiedByWebview: false,
    checkedAt: 10,
  });
});

test("persistSiteAvailability writes only known site records", () => {
  let saved = "";
  const storage = {
    setItem: (_key, value) => {
      saved = value;
    },
  };
  const records = new Map([
    ["kimi", { available: false, message: "", verifiedByWebview: true, checkedAt: 10 }],
    ["unknown", { available: true, message: "ok" }],
  ]);
  const knownLabels = new Set(["kimi"]);

  persistSiteAvailability(storage, "key", records, knownLabels, () => 99);

  assert.deepEqual(JSON.parse(saved), {
    kimi: {
      available: false,
      message: "不可访问",
      verifiedByWebview: true,
      checkedAt: 10,
    },
  });
});
