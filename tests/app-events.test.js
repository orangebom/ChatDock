import test from "node:test";
import assert from "node:assert/strict";

import { wireAppDomEvents } from "../src/features/app-events.ts";

function createElement() {
  return {
    value: "",
    dataset: {},
    listeners: {},
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
  };
}

function createDocumentStub() {
  const elements = new Map();
  return {
    elements,
    querySelector(selector) {
      if (!elements.has(selector)) {
        elements.set(selector, createElement());
      }
      return elements.get(selector);
    },
  };
}

function createWindowStub() {
  return {
    listeners: {},
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
  };
}

function createActions() {
  const calls = [];
  return {
    calls,
    sendPrompt: async () => calls.push("sendPrompt"),
    autosizePrompt: () => calls.push("autosizePrompt"),
    wirePromptAttachments: () => calls.push("wirePromptAttachments"),
    scheduleLayoutRefresh: (reason) => calls.push(`schedule:${reason}`),
    reloadAll: async () => calls.push("reloadAll"),
    refreshLayout: async () => calls.push("refreshLayout"),
    setStatus: (message, level) => calls.push(`status:${level}:${message}`),
    openOnboarding: async () => calls.push("openOnboarding"),
    isLayoutPresetDropdownOpen: () => false,
    closeLayoutPresetDropdown: async () => calls.push("closeLayoutPresetDropdown"),
    openLayoutPresetDropdown: async () => calls.push("openLayoutPresetDropdown"),
    isLayoutPresetMenuOpen: () => false,
    closeLayoutPresetMenu: async () => calls.push("closeLayoutPresetMenu"),
    openLayoutPresetMenu: async () => calls.push("openLayoutPresetMenu"),
    openAboutDialog: async () => calls.push("openAboutDialog"),
    openSiteManager: async () => calls.push("openSiteManager"),
    closeAboutDialog: async () => calls.push("closeAboutDialog"),
    closeSiteManager: async () => calls.push("closeSiteManager"),
    closeLayoutPresets: async () => calls.push("closeLayoutPresets"),
    saveLayoutPresetAs: () => true,
    runLayoutPresetMenuAction: async (action) => calls.push(`layoutMenu:${action}`),
    closeTargetContextMenu: () => calls.push("closeTargetContextMenu"),
    runTargetContextAction: async (action, label) => calls.push(`context:${action}:${label}`),
    getTargetContextSiteLabel: () => "chatgpt",
    resolveCloseConfirm: async (accepted) => calls.push(`closeConfirm:${accepted}`),
    isTargetContextMenuOpen: () => false,
    isCloseConfirmOpen: () => false,
    isAboutDialogOpen: () => false,
    isSiteManagerOpen: () => false,
    onboarding: {
      wire: () => calls.push("onboardingWire"),
      handleKeydown: async () => false,
    },
  };
}

test("wireAppDomEvents sends prompt on form submit and enter", async () => {
  const document = createDocumentStub();
  const window = createWindowStub();
  const actions = createActions();
  wireAppDomEvents({ document, window, actions });

  await document.querySelector("#prompt-form").listeners.submit({ preventDefault() {} });
  await document.querySelector("#prompt").listeners.keydown({
    key: "Enter",
    shiftKey: false,
    preventDefault() {},
  });

  assert.equal(actions.calls.filter((call) => call === "sendPrompt").length, 2);
});

test("wireAppDomEvents toggles layout preset dropdown", async () => {
  const document = createDocumentStub();
  const window = createWindowStub();
  const actions = createActions();
  wireAppDomEvents({ document, window, actions });

  await document.querySelector("#layout-preset-select").listeners.click();

  assert.equal(actions.calls.includes("openLayoutPresetDropdown"), true);
});

test("wireAppDomEvents delegates Escape key to close-confirm first", async () => {
  const document = createDocumentStub();
  const window = createWindowStub();
  const actions = createActions();
  actions.isCloseConfirmOpen = () => true;
  wireAppDomEvents({ document, window, actions });

  await window.listeners.keydown({
    key: "Escape",
    preventDefault() {},
  });

  assert.equal(actions.calls.includes("closeConfirm:false"), true);
});
