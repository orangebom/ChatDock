import test from "node:test";
import assert from "node:assert/strict";

import { wireTauriAppEvents } from "../src/tauri/app-events.ts";

test("wireTauriAppEvents wires panel toolbar and layout preset events", async () => {
  const handlers = new Map();
  const calls = [];
  const tauriEvent = {
    async listen(name, handler) {
      handlers.set(name, handler);
    },
  };
  const appWindow = {
    async onDragDropEvent(handler) {
      handlers.set("drag", handler);
    },
  };

  await wireTauriAppEvents({
    tauriEvent,
    appWindow,
    siteAvailabilitySyncEvent: "site-sync",
    attachmentDebugEvent: "attachment-debug",
    actions: {
      handlePanelAction: async (action, site) => calls.push(`panel:${action}:${site}`),
      closeLayoutPresetDropdown: async () => calls.push("closeDropdown"),
      applyLayoutPreset: async (presetId) => calls.push(`apply:${presetId}`),
      closeLayoutPresetMenu: async () => calls.push("closeMenu"),
      runLayoutPresetMenuAction: async (action) => calls.push(`menu:${action}`),
      syncSiteAvailability: (label, available, message, options) => calls.push({ label, available, message, options }),
      logAttachmentDebug: (stage) => calls.push(`debug:${stage}`),
      findPanelDropTarget: () => null,
      setPanelDropTarget: () => {},
      setPromptDropActive: () => {},
      clearDragVisualState: () => {},
      injectAttachmentsIntoPanel: async () => ({ ok: true }),
      getSiteMeta: () => null,
      setStatus: () => {},
      appendComposerPaths: async () => 0,
      onError: () => {},
    },
  });

  await handlers.get("panel-toolbar-action")({ payload: { action: "reload", site: "chatgpt" } });
  await handlers.get("layout-preset-dropdown-action")({ payload: { action: "apply", presetId: "chat" } });
  await handlers.get("layout-preset-menu-action")({ payload: { action: "edit" } });
  handlers.get("site-sync")({ payload: { label: "gemini", available: false, message: "blocked" } });

  assert.deepEqual(calls, [
    "panel:reload:chatgpt",
    "closeDropdown",
    "apply:chat",
    "menu:edit",
    { label: "gemini", available: false, message: "blocked", options: { fromWebview: true } },
  ]);
});

test("wireTauriAppEvents routes dropped files to panel target", async () => {
  const handlers = new Map();
  const calls = [];

  await wireTauriAppEvents({
    tauriEvent: { async listen(name, handler) { handlers.set(name, handler); } },
    appWindow: { async onDragDropEvent(handler) { handlers.set("drag", handler); } },
    siteAvailabilitySyncEvent: "site-sync",
    attachmentDebugEvent: "attachment-debug",
    actions: {
      handlePanelAction: async () => {},
      closeLayoutPresetDropdown: async () => {},
      applyLayoutPreset: async () => {},
      closeLayoutPresetMenu: async () => {},
      runLayoutPresetMenuAction: async () => {},
      syncSiteAvailability: () => {},
      logAttachmentDebug: (stage) => calls.push(`debug:${stage}`),
      findPanelDropTarget: () => "kimi",
      setPanelDropTarget: (label) => calls.push(`target:${label}`),
      setPromptDropActive: (active) => calls.push(`prompt:${active}`),
      clearDragVisualState: () => calls.push("clear"),
      injectAttachmentsIntoPanel: async (label, paths) => {
        calls.push(`inject:${label}:${paths.length}`);
        return { ok: true };
      },
      getSiteMeta: () => ({ title: "Kimi" }),
      setStatus: (message, level) => calls.push(`status:${level}:${message}`),
      appendComposerPaths: async () => 0,
      onError: () => {},
    },
  });

  await handlers.get("drag")({ payload: { type: "drop", position: { x: 1, y: 1 }, paths: ["a.png"] } });

  assert.equal(calls.includes("inject:kimi:1"), true);
  assert.equal(calls.includes("status:ok:已将附件注入 Kimi 面板。"), true);
});
