import {
  applyAvailabilityResults as applyAvailabilityResultsState,
  getLabelsToProbe as getLabelsToProbeState,
  getSiteAvailability as getSiteAvailabilityState,
  isSiteUnavailable as isSiteUnavailableState,
  markAvailabilityFromWebview as markAvailabilityFromWebviewState,
} from "./state/availability.ts";

export const MAX_SITES_PER_PAGE = 4;

export const DEFAULT_LAYOUT_PRESET_ID = "default-compare";
export const IMAGE_GENERATION_LAYOUT_PRESET_ID = "image-generation";

const IMAGE_GENERATION_SITE_LABELS = ["chatgpt", "gemini", "doubao", "zhipu"];

function normalizePresetPageLayouts(layouts, pageCount) {
  const next = Array.isArray(layouts) ? [...layouts] : [];
  while (next.length < pageCount) {
    next.push({});
  }
  return next.slice(0, Math.max(pageCount, 1));
}

export function getSiteAvailability(siteAvailability, label) {
  return getSiteAvailabilityState(siteAvailability, label);
}

export function isSiteUnavailable(siteAvailability, label) {
  return isSiteUnavailableState(siteAvailability, label);
}

export function getLabelsToProbe(
  targetLabels,
  siteMap,
  siteAvailability,
  pendingSiteAvailability,
  options = {},
) {
  return getLabelsToProbeState(targetLabels, siteMap, siteAvailability, pendingSiteAvailability, options);
}

export function applyAvailabilityResults(labels, results, fallbackMessage = "不可访问") {
  return applyAvailabilityResultsState(labels, results, fallbackMessage);
}

export function markAvailabilityFromWebview(siteAvailability, label, available, message = "") {
  const fallbackMessage = message || "不可访问";
  return markAvailabilityFromWebviewState(siteAvailability, label, available, fallbackMessage);
}

export function clearSelectionState(pageLayouts, normalizePageLayouts) {
  return {
    selectedSiteLabels: [],
    activePageIndex: 0,
    pageLayouts: normalizePageLayouts(pageLayouts, 1),
    maximizedLabel: null,
  };
}

function getPageCount(selectedCount) {
  return Math.max(1, Math.ceil(selectedCount / MAX_SITES_PER_PAGE));
}

function uniqueValidLabels(labels, validLabels = null) {
  const validSet = Array.isArray(validLabels) ? new Set(validLabels) : null;
  return (Array.isArray(labels) ? labels : []).filter(
    (label, index, source) =>
      typeof label === "string" &&
      source.indexOf(label) === index &&
      (!validSet || validSet.has(label)),
  );
}

export function createPresetSnapshot(workspace = {}, normalizePageLayouts = normalizePresetPageLayouts) {
  const selectedSiteLabels = uniqueValidLabels(workspace.selectedSiteLabels);
  const pageCount = getPageCount(selectedSiteLabels.length);
  const activePageIndex = Number.isInteger(workspace.activePageIndex)
    ? Math.min(pageCount - 1, Math.max(0, workspace.activePageIndex))
    : 0;

  return {
    selectedSiteLabels,
    activePageIndex,
    pageLayouts: normalizePageLayouts(workspace.pageLayouts || [], pageCount),
  };
}

export function createDefaultLayoutPresets(validLabels = [], normalizePageLayouts = normalizePresetPageLayouts) {
  const imageLabels = IMAGE_GENERATION_SITE_LABELS.filter((label) => validLabels.includes(label));

  return {
    activePresetId: DEFAULT_LAYOUT_PRESET_ID,
    items: [
      {
        id: DEFAULT_LAYOUT_PRESET_ID,
        name: "默认对比",
        builtin: true,
        snapshot: createPresetSnapshot(
          {
            selectedSiteLabels: [],
            activePageIndex: 0,
            pageLayouts: [],
          },
          normalizePageLayouts,
        ),
      },
      {
        id: IMAGE_GENERATION_LAYOUT_PRESET_ID,
        name: "图片生成",
        builtin: true,
        snapshot: createPresetSnapshot(
          {
            selectedSiteLabels: imageLabels,
            activePageIndex: 0,
            pageLayouts: [],
          },
          normalizePageLayouts,
        ),
      },
    ],
  };
}

export function sanitizeLayoutPresets(rawPresets, validLabels = [], normalizePageLayouts) {
  const defaults = createDefaultLayoutPresets(validLabels, normalizePageLayouts);
  const rawItems = Array.isArray(rawPresets?.items) ? rawPresets.items : [];
  const seen = new Set();
  const items = [];

  for (const rawItem of [...rawItems, ...defaults.items]) {
    const id = typeof rawItem?.id === "string" && rawItem.id.trim() ? rawItem.id.trim() : "";
    if (!id || seen.has(id)) {
      continue;
    }

    const name = typeof rawItem?.name === "string" && rawItem.name.trim()
      ? rawItem.name.trim()
      : "未命名布局";
    const selectedSiteLabels = uniqueValidLabels(rawItem?.snapshot?.selectedSiteLabels, validLabels);
    const pageCount = getPageCount(selectedSiteLabels.length);
    const activePageIndex = Number.isInteger(rawItem?.snapshot?.activePageIndex)
      ? Math.min(pageCount - 1, Math.max(0, rawItem.snapshot.activePageIndex))
      : 0;

    seen.add(id);
    items.push({
      id,
      name,
      builtin: rawItem?.builtin === true,
      snapshot: {
        selectedSiteLabels,
        activePageIndex,
        pageLayouts: normalizePageLayouts(rawItem?.snapshot?.pageLayouts || [], pageCount),
      },
    });
  }

  if (!items.length) {
    return defaults;
  }

  const activePresetId = items.some((item) => item.id === rawPresets?.activePresetId)
    ? rawPresets.activePresetId
    : items[0].id;

  return { activePresetId, items };
}

export function updateActivePresetSnapshot(presets, workspace, normalizePageLayouts) {
  if (!presets?.activePresetId || !Array.isArray(presets.items)) {
    return presets;
  }

  const snapshot = createPresetSnapshot(workspace, normalizePageLayouts);
  return {
    ...presets,
    items: presets.items.map((preset) =>
      preset.id === presets.activePresetId
        ? { ...preset, snapshot }
        : preset,
    ),
  };
}

export function toggleSiteSelection({
  label,
  selected,
  visibleSiteLabels,
  selectedSiteLabels,
  maximizedLabel,
  activePageIndex,
  normalizePageLayouts,
  pageLayouts,
}) {
  if (!visibleSiteLabels.includes(label)) {
    return null;
  }

  const nextSelected = selectedSiteLabels.filter((item) => item !== label);
  if (selected) {
    nextSelected.push(label);
  }

  const pageCount = Math.max(1, Math.ceil(nextSelected.length / MAX_SITES_PER_PAGE));
  const nextActivePageIndex = selected
    ? Math.floor((nextSelected.length - 1) / MAX_SITES_PER_PAGE)
    : Math.max(0, Math.min(activePageIndex, pageCount - 1));

  return {
    selectedSiteLabels: nextSelected,
    maximizedLabel: !selected && maximizedLabel === label ? null : maximizedLabel,
    activePageIndex: nextActivePageIndex,
    pageLayouts: normalizePageLayouts(pageLayouts, pageCount),
  };
}
