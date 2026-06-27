type ThemeMode = "system" | "dark" | "light";
type Theme = "dark" | "light";

interface ThemeDocumentLike {
  documentElement: {
    dataset: Record<string, string>;
    style: {
      colorScheme?: string;
    };
  };
  querySelector(selector: string): {
    setAttribute?(name: string, value: string): void;
    textContent?: string;
  } | null;
}

export function resolveThemeMode(themeMode: string, getSystemTheme: () => Theme): Theme {
  return themeMode === "system" ? getSystemTheme() : themeMode as Theme;
}

export function getThemeToggleState(themeMode: string, resolvedTheme: Theme) {
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
  const themeText = themeMode === "system" ? "跟随系统" : resolvedTheme === "dark" ? "暗色" : "亮色";
  const themeHint = themeMode === "system"
    ? `当前跟随系统，点击切换到${nextTheme === "light" ? "亮色" : "暗色"}主题`
    : nextTheme === "light"
      ? "切换到亮色主题"
      : "切换到暗色主题";

  return {
    nextTheme,
    themeText,
    themeHint,
  };
}

export function applyThemeToDocument(
  document: ThemeDocumentLike,
  themeMode: ThemeMode | string,
  getSystemTheme: () => Theme,
) {
  const resolvedTheme = resolveThemeMode(themeMode, getSystemTheme);
  const { themeText, themeHint } = getThemeToggleState(themeMode, resolvedTheme);

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.style.colorScheme = resolvedTheme;

  const toggle = document.querySelector("#theme-toggle");
  const toggleLabel = document.querySelector("#theme-toggle-label");

  toggle?.setAttribute?.("aria-label", themeHint);
  toggle?.setAttribute?.("title", themeHint);

  if (toggleLabel) {
    toggleLabel.textContent = themeText;
  }

  return {
    themeMode,
    theme: resolvedTheme,
  };
}
