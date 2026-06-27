export type LayoutPresetMenuIntent = "save-as" | "edit" | "none";

export function normalizeLayoutPresetName(name: string): string {
  return String(name || "").trim();
}

export function createLayoutPresetId(
  now: () => number = Date.now,
  random: () => number = Math.random,
): string {
  return `custom-${now().toString(36)}-${random().toString(36).slice(2, 7)}`;
}

export function getLayoutPresetMenuIntent(action: unknown): LayoutPresetMenuIntent {
  if (action === "save-as" || action === "edit") {
    return action;
  }
  return "none";
}
