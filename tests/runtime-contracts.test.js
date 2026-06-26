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
const mainJs = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const tauriLib = fs.readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
const layoutDropdownHtml = fs.readFileSync(
  new URL("../src/layout-preset-dropdown.html", import.meta.url),
  "utf8",
);
const layoutMenuHtml = fs.existsSync(new URL("../src/layout-preset-menu.html", import.meta.url))
  ? fs.readFileSync(new URL("../src/layout-preset-menu.html", import.meta.url), "utf8")
  : "";

test("close confirm dialog contract exists in HTML", () => {
  for (const id of [
    'id="close-confirm"',
    'id="close-confirm-title"',
    'id="close-confirm-body"',
    'id="cancel-close-confirm"',
    'id="accept-close-confirm"',
    'id="open-about"',
    'id="about-dialog"',
    'id="about-title"',
    'id="about-body"',
    'id="close-about"',
    'data-close-about-backdrop="true"',
    'data-close-confirm-backdrop="true"',
    'id="target-context-menu"',
    'id="target-context-title"',
    'data-context-action="test-connectivity"',
    'data-context-action="remove"',
  ]) {
    assert.equal(indexHtml.includes(id), true, `missing ${id}`);
  }
});

test("layout preset dialog contract exists in HTML and app wiring", () => {
  for (const fragment of [
    'class="topbar-left"',
    'class="topbar-center"',
    'class="topbar-actions"',
    'id="layout-preset-select"',
    'id="layout-preset-current"',
    'id="layout-preset-more"',
    'id="layout-preset-menu"',
    'data-layout-preset-action="save-as"',
    'data-layout-preset-action="edit"',
    'id="layout-presets"',
    'id="layout-presets-list"',
    'id="layout-preset-form"',
    'id="layout-preset-name"',
    'data-close-layout-presets="true"',
  ]) {
    assert.equal(indexHtml.includes(fragment), true, `missing ${fragment}`);
  }

  for (const fragment of [
    'const LAYOUT_PRESETS_STORAGE_KEY = "chatdock-layout-presets-v1";',
    "function loadLayoutPresets()",
    "function persistLayoutPresets()",
    "function renderLayoutPresets()",
    "function renderLayoutPresetSelect()",
    "async function ensureLayoutPresetDropdownWebview()",
    "async function showLayoutPresetDropdownWebview()",
    "async function hideLayoutPresetDropdownWebview()",
    "async function ensureLayoutPresetMenuWebview()",
    "async function showLayoutPresetMenuWebview()",
    "async function hideLayoutPresetMenuWebview()",
    "await current.setFocus();",
    'payload?.action === "close"',
    "function openLayoutPresetMenu()",
    "async function applyLayoutPreset(presetId)",
    "state.layoutPresets = loadLayoutPresets();",
    'document.querySelector("#layout-preset-select").addEventListener("click"',
    'document.querySelector("#layout-preset-more").addEventListener("click"',
  ]) {
    assert.equal(mainJs.includes(fragment), true, `missing ${fragment}`);
  }

  assert.equal(indexHtml.includes("<select"), false, "layout switcher should not use native select");

  for (const fragment of [
    'id="layout-preset-dropdown-list"',
    'layout-preset-dropdown-state',
    'layout-preset-dropdown-action',
    'action: "close"',
    'data-layout-preset-id',
  ]) {
    assert.equal(layoutDropdownHtml.includes(fragment), true, `missing ${fragment}`);
  }

  for (const fragment of [
    'id="layout-preset-menu-list"',
    'layout-preset-menu-state',
    'layout-preset-menu-action',
    'data-layout-preset-action',
    'action: "close"',
  ]) {
    assert.equal(layoutMenuHtml.includes(fragment), true, `missing ${fragment}`);
  }
});

test("close confirm and unavailable target styles exist", () => {
  for (const selector of [
    ".close-confirm-card",
    ".close-confirm-actions",
    ".close-confirm-accept",
    ".about-card",
    ".about-body",
    ".about-mark",
    ".about-link",
    ".target-pill.unavailable",
    ".target-pill.context-open",
    ".context-menu",
    ".context-menu-item",
    ".layout-presets-card",
    ".layout-preset-item",
    ".layout-preset-form",
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
  assert.equal(mainWindow.dragDropEnabled, false);
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

test("composer supports pasted and dropped attachments end to end", () => {
  for (const fragment of [
    'id="prompt-dropzone"',
    'id="prompt-attachments"',
  ]) {
    assert.equal(indexHtml.includes(fragment), true, `missing ${fragment}`);
  }

  for (const fragment of [
    "function wirePromptAttachments()",
    "function hasDraggedFiles(dataTransfer)",
    "function describeDragTransfer(dataTransfer)",
    "async function appendComposerPaths(paths)",
    "function findPanelDropTarget(position)",
    "async function injectAttachmentsIntoPanel(targetLabel, paths)",
    "function physicalToViewportPosition(position)",
    "function logAttachmentDebug(stage, payload = {})",
    "function isAboutDialogOpen()",
    "async function openAboutDialog()",
    "async function closeAboutDialog()",
    "async function ensureWebviewDropListener(siteLabel, webviewInstance)",
    'await tauriEvent.listen(ATTACHMENT_DEBUG_EVENT, ({ payload }) => {',
    'invoke("inject_attachments", {',
    'await webviewInstance.onDragDropEvent(async (event) => {',
    'await appWindow.onDragDropEvent(async (event) => {',
    'invoke("read_file_bytes", { path })',
    'promptField.addEventListener("paste"',
    'console.info("[drag-debug]"',
    'for (const node of [compactBar, dropzone, promptField])',
    "serializeComposerAttachments()",
    'invoke("broadcast_prompt", { prompt, targets, attachments })',
  ]) {
    assert.equal(mainJs.includes(fragment), true, `missing ${fragment}`);
  }

  for (const fragment of [
    "struct PromptAttachment",
    "struct AttachmentDebugEvent",
    "attachments: Option<Vec<PromptAttachment>>",
    "fn inject_attachments(",
    "fn emit_attachment_debug(app: &AppHandle<tauri::Wry>, label: &str, stage: &str, message: &str)",
    'const ATTACHMENT_DEBUG_EVENT: &str = "attachment-injection-debug";',
    "fn read_file_bytes(path: String) -> Result<Vec<u8>, String>",
    "const deadline = Date.now() + 5000;",
    "const shouldSubmit = ",
    "const sleepWithin = async (ms, deadline) => {{",
    "const uploadAttachments = async (anchor, deadline) => {{",
    "const waitForUploadToSettle = async (anchor, deadline) => {{",
    "const waitForSendReady = async (input, deadline) => {{",
    "const findBusyIndicators = (anchor) => {{",
    "const collectFileInputs = (anchor) => {{",
    "const findPromptInput = () => {{",
    "const collectDeepMatches = (root, predicate, includeRoot = false) => {{",
    "const ensureFileInputs = async (anchor, deadline) => {{",
    "const collectAttachTriggers = (anchor) => {{",
    "element instanceof HTMLInputElement && element.type === 'file'",
    "assignFilesToInput(input, acceptedFiles)",
  ]) {
    assert.equal(tauriLib.includes(fragment), true, `missing ${fragment}`);
  }

  assert.equal(
    tauriLib.includes("input.click?.();"),
    false,
    "file upload injection should not open the native file picker",
  );
});
