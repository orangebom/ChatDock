export const MAX_SITES_PER_PAGE = 4;

export function getSiteAvailability(siteAvailability, label) {
  return siteAvailability.get(label) || null;
}

export function isSiteUnavailable(siteAvailability, label) {
  return getSiteAvailability(siteAvailability, label)?.available === false;
}

export function getLabelsToProbe(targetLabels, siteMap, siteAvailability, pendingSiteAvailability) {
  const uniqueLabels = [...new Set(targetLabels)].filter((label) => siteMap.has(label));
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
        },
      ];
    }),
  );
}

export function clearSelectionState(pageLayouts, normalizePageLayouts) {
  return {
    selectedSiteLabels: [],
    activePageIndex: 0,
    pageLayouts: normalizePageLayouts(pageLayouts, 1),
    maximizedLabel: null,
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
