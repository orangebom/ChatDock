import test from "node:test";
import assert from "node:assert/strict";

import {
  applyThemeToDocument,
  getThemeToggleState,
  resolveThemeMode,
} from "../src/features/theme.ts";

test("resolveThemeMode follows system only for system mode", () => {
  assert.equal(resolveThemeMode("system", () => "light"), "light");
  assert.equal(resolveThemeMode("dark", () => "light"), "dark");
  assert.equal(resolveThemeMode("light", () => "dark"), "light");
});

test("getThemeToggleState returns labels and hints", () => {
  assert.deepEqual(getThemeToggleState("system", "dark"), {
    nextTheme: "light",
    themeText: "跟随系统",
    themeHint: "当前跟随系统，点击切换到亮色主题",
  });
  assert.equal(getThemeToggleState("dark", "dark").themeHint, "切换到亮色主题");
  assert.equal(getThemeToggleState("light", "light").themeHint, "切换到暗色主题");
});

test("applyThemeToDocument writes dataset, color scheme, and toggle metadata", () => {
  const toggleAttributes = {};
  const toggle = {
    setAttribute(name, value) {
      toggleAttributes[name] = value;
    },
  };
  const toggleLabel = { textContent: "" };
  const document = {
    documentElement: {
      dataset: {},
      style: {},
    },
    querySelector(selector) {
      if (selector === "#theme-toggle") return toggle;
      if (selector === "#theme-toggle-label") return toggleLabel;
      return null;
    },
  };

  const result = applyThemeToDocument(document, "system", () => "light");

  assert.deepEqual(result, { themeMode: "system", theme: "light" });
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(document.documentElement.dataset.themeMode, "system");
  assert.equal(document.documentElement.style.colorScheme, "light");
  assert.equal(toggleAttributes["aria-label"], "当前跟随系统，点击切换到暗色主题");
  assert.equal(toggleAttributes.title, "当前跟随系统，点击切换到暗色主题");
  assert.equal(toggleLabel.textContent, "跟随系统");
});
