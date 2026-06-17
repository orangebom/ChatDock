import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const indexHtml = fs.readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
const stylesCss = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const tauriConfig = JSON.parse(
  fs.readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"),
);
const defaultCapability = JSON.parse(
  fs.readFileSync(new URL("../src-tauri/capabilities/default.json", import.meta.url), "utf8"),
);
const releaseWorkflow = fs.readFileSync(
  new URL("../.github/workflows/release.yml", import.meta.url),
  "utf8",
);

test("close confirm dialog contract exists in HTML", () => {
  for (const id of [
    'id="close-confirm"',
    'id="close-confirm-title"',
    'id="close-confirm-body"',
    'id="cancel-close-confirm"',
    'id="accept-close-confirm"',
    'data-close-confirm-backdrop="true"',
  ]) {
    assert.equal(indexHtml.includes(id), true, `missing ${id}`);
  }
});

test("close confirm and unavailable target styles exist", () => {
  for (const selector of [
    ".close-confirm-card",
    ".close-confirm-actions",
    ".close-confirm-accept",
    ".target-pill.unavailable",
    ":root[data-theme=\"light\"] .target-pill.unavailable",
  ]) {
    assert.equal(stylesCss.includes(selector), true, `missing ${selector}`);
  }
});

test("window config no longer enforces min size", () => {
  const mainWindow = tauriConfig.app.windows.find((window) => window.label === "main");
  assert.ok(mainWindow, "main window config missing");
  assert.equal("minWidth" in mainWindow, false);
  assert.equal("minHeight" in mainWindow, false);
});

test("window permissions allow both close request interception and destroy", () => {
  const permissions = defaultCapability.permissions;
  assert.equal(permissions.includes("core:window:allow-close"), true);
  assert.equal(permissions.includes("core:window:allow-destroy"), true);
});

test("release workflow publishes version tags", () => {
  assert.equal(releaseWorkflow.includes('tags:'), true);
  assert.equal(releaseWorkflow.includes('- "v*"'), true);
  assert.equal(releaseWorkflow.includes("tauri-apps/tauri-action@v1"), true);
});
