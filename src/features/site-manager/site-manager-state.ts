interface WorkspaceLike {
  siteOrder: string[];
  visibleSiteLabels: string[];
  selectedSiteLabels: string[];
}

export function moveItem<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return [...array];
  }
  const next = [...array];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function reorderVisibleSitesInWorkspace(
  workspace: WorkspaceLike,
  sourceLabel: string,
  targetLabel: string,
): boolean {
  const visible = [...workspace.visibleSiteLabels];
  const fromIndex = visible.indexOf(sourceLabel);
  const toIndex = visible.indexOf(targetLabel);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return false;
  }

  return syncVisibleSiteOrder(workspace, moveItem(visible, fromIndex, toIndex));
}

export function addVisibleSiteToWorkspace(
  workspace: WorkspaceLike,
  label: string,
  sanitizeSiteOrder: (order: string[]) => string[],
): void {
  if (workspace.visibleSiteLabels.includes(label)) {
    return;
  }
  workspace.visibleSiteLabels = [...workspace.visibleSiteLabels, label];
  workspace.siteOrder = sanitizeSiteOrder([
    ...workspace.siteOrder.filter((item) => item !== label),
    label,
  ]);
}

export function removeVisibleSiteFromWorkspace(
  workspace: WorkspaceLike,
  label: string,
  maximizedLabel: string | null,
) {
  workspace.visibleSiteLabels = workspace.visibleSiteLabels.filter((item) => item !== label);
  workspace.selectedSiteLabels = workspace.selectedSiteLabels.filter((item) => item !== label);

  return {
    maximizedLabel: maximizedLabel === label ? null : maximizedLabel,
  };
}

export function syncVisibleSiteOrder(workspace: WorkspaceLike, reorderedVisible: string[]): boolean {
  const nextVisible = reorderedVisible.filter(Boolean);
  if (!nextVisible.length) {
    return false;
  }

  const currentVisible = [...workspace.visibleSiteLabels];
  const changed = nextVisible.length === currentVisible.length
    && nextVisible.some((label, index) => currentVisible[index] !== label);
  if (!changed) {
    return false;
  }

  const hidden = workspace.siteOrder.filter((label) => !nextVisible.includes(label));
  workspace.visibleSiteLabels = nextVisible;
  workspace.siteOrder = [...nextVisible, ...hidden];
  workspace.selectedSiteLabels = workspace.selectedSiteLabels
    .filter((label) => nextVisible.includes(label))
    .sort((left, right) => nextVisible.indexOf(left) - nextVisible.indexOf(right));
  return true;
}
