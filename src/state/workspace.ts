import { clamp } from "../geometry.js";
import type { LayoutState, SiteLabel, WorkspaceState } from "../types/domain";

export const MAX_SITES_PER_PAGE = 4;

export const DEFAULT_LAYOUT_STATE: LayoutState = {
  twoWaySplit: 0.5,
  threeWaySplits: [1 / 3, 2 / 3],
  quadCols: 0.5,
  quadRows: 0.5,
};

export function cloneLayout(layout?: Partial<LayoutState> | null): LayoutState {
  const source = layout || DEFAULT_LAYOUT_STATE;
  return {
    twoWaySplit: clamp(Number(source.twoWaySplit) || DEFAULT_LAYOUT_STATE.twoWaySplit, 0.2, 0.8),
    threeWaySplits:
      Array.isArray(source.threeWaySplits) && source.threeWaySplits.length === 2
        ? [
            clamp(Number(source.threeWaySplits[0]) || DEFAULT_LAYOUT_STATE.threeWaySplits[0], 0.18, 0.7),
            clamp(Number(source.threeWaySplits[1]) || DEFAULT_LAYOUT_STATE.threeWaySplits[1], 0.3, 0.82),
          ]
        : [...DEFAULT_LAYOUT_STATE.threeWaySplits],
    quadCols: clamp(Number(source.quadCols) || DEFAULT_LAYOUT_STATE.quadCols, 0.24, 0.76),
    quadRows: clamp(Number(source.quadRows) || DEFAULT_LAYOUT_STATE.quadRows, 0.24, 0.76),
  };
}

export function createDefaultWorkspace(siteLabels: SiteLabel[]): WorkspaceState {
  const siteOrder = [...siteLabels];
  return {
    activePageIndex: 0,
    siteOrder,
    visibleSiteLabels: siteOrder,
    selectedSiteLabels: [],
    pageLayouts: [cloneLayout()],
  };
}

export function getPageCount(selectedCount = 0): number {
  return Math.max(1, Math.ceil(selectedCount / MAX_SITES_PER_PAGE));
}

export function normalizePageLayouts(rawLayouts: unknown, pageCount: number): LayoutState[] {
  const layouts = Array.isArray(rawLayouts) ? rawLayouts.map((layout) => cloneLayout(layout)) : [];
  while (layouts.length < pageCount) {
    layouts.push(cloneLayout());
  }
  return layouts.slice(0, pageCount);
}

export function sanitizeSiteOrder(order: unknown, siteLabels: SiteLabel[]): SiteLabel[] {
  const validLabels = new Set(siteLabels);
  const rawOrder = Array.isArray(order) ? order : [];
  const dedupedOrder = rawOrder.filter(
    (label, index, source): label is SiteLabel =>
      typeof label === "string" && validLabels.has(label) && source.indexOf(label) === index,
  );
  const missingLabels = siteLabels.filter((label) => !dedupedOrder.includes(label));
  return [...dedupedOrder, ...missingLabels];
}

export function sanitizeVisibleSiteLabels(
  visibleLabels: unknown,
  siteOrder: unknown,
  siteLabels: SiteLabel[],
): SiteLabel[] {
  const validOrder = sanitizeSiteOrder(siteOrder, siteLabels);
  const rawVisible = Array.isArray(visibleLabels) ? visibleLabels : validOrder;
  return rawVisible.filter(
    (label, index, source): label is SiteLabel =>
      typeof label === "string" && validOrder.includes(label) && source.indexOf(label) === index,
  );
}

export function migrateLegacyWorkspace(rawWorkspace: unknown, siteLabels: SiteLabel[]): Partial<WorkspaceState> {
  const workspace = rawWorkspace && typeof rawWorkspace === "object" ? rawWorkspace as Record<string, unknown> : {};
  const selectedFromLegacy = Array.isArray(workspace.selectedSiteLabels)
    ? workspace.selectedSiteLabels
    : [];
  const layoutsFromLegacy = Array.isArray(workspace.pages)
    ? workspace.pages.map((page) => page && typeof page === "object" ? (page as Record<string, unknown>).layout : null)
    : workspace.pageLayouts;

  return {
    activePageIndex: 0,
    siteOrder: [...siteLabels],
    visibleSiteLabels: [...siteLabels],
    selectedSiteLabels: selectedFromLegacy.filter((label): label is SiteLabel => typeof label === "string"),
    pageLayouts: Array.isArray(layoutsFromLegacy)
      ? layoutsFromLegacy.map((layout) => cloneLayout(layout))
      : undefined,
  };
}

export function sanitizeWorkspace(rawWorkspace: unknown, siteLabels: SiteLabel[]): WorkspaceState {
  const workspace = rawWorkspace && typeof rawWorkspace === "object" ? rawWorkspace as Record<string, unknown> : {};
  const siteOrder = sanitizeSiteOrder(workspace.siteOrder, siteLabels);
  const visibleSiteLabels = sanitizeVisibleSiteLabels(workspace.visibleSiteLabels, siteOrder, siteLabels);
  const selectedSiteLabels = Array.isArray(workspace.selectedSiteLabels)
    ? workspace.selectedSiteLabels.filter(
        (label, index, source): label is SiteLabel =>
          typeof label === "string" && visibleSiteLabels.includes(label) && source.indexOf(label) === index,
      )
    : [];

  const pageCount = getPageCount(selectedSiteLabels.length);
  const activePageIndex = clamp(
    Number.isInteger(workspace.activePageIndex) ? Number(workspace.activePageIndex) : 0,
    0,
    pageCount - 1,
  );

  return {
    activePageIndex,
    siteOrder,
    visibleSiteLabels,
    selectedSiteLabels,
    pageLayouts: normalizePageLayouts(workspace.pageLayouts, pageCount),
  };
}
