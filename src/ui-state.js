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
  return siteAvailability.get(label) || null;
}

export function isSiteUnavailable(siteAvailability, label) {
  const availability = getSiteAvailability(siteAvailability, label);
  return availability?.available === false && !availability?.verifiedByWebview;
}

export function getLabelsToProbe(
  targetLabels,
  siteMap,
  siteAvailability,
  pendingSiteAvailability,
  options = {},
) {
  const { force = false } = options;
  const uniqueLabels = [...new Set(targetLabels)].filter((label) => siteMap.has(label));
  if (force) {
    return uniqueLabels.filter((label) => !pendingSiteAvailability.has(label));
  }
  return uniqueLabels.filter(
    (label) => !siteAvailability.has(label) && !pendingSiteAvailability.has(label),
  );
}

export function applyAvailabilityResults(labels, results, fallbackMessage = "不可访问") {
  const resultMap = new Map(
    (Array.isArray(results) ? results : []).map((result) => [result.label, result]),
  );

  return new Map(
    labels.map((label) => {
      const result = resultMap.get(label);
      return [
        label,
        {
          available: !!result?.available,
          message: result?.message || (result ? "" : fallbackMessage),
          verifiedByWebview: false,
        },
      ];
    }),
  );
}

export function markAvailabilityFromWebview(siteAvailability, label, available, message = "") {
  const current = getSiteAvailability(siteAvailability, label);
  return {
    ...current,
    available,
    message: available ? "" : (message || current?.message || "不可访问"),
    verifiedByWebview: true,
  };
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
