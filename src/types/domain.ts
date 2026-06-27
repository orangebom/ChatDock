export type SiteLabel = string;

export interface SiteConfig {
  label: SiteLabel;
  title: string;
  url: string;
  accentColor: string;
  dataDirectory?: string;
}

export interface LayoutState {
  twoWaySplit: number;
  threeWaySplits: [number, number];
  quadCols: number;
  quadRows: number;
}

export interface WorkspaceState {
  activePageIndex: number;
  siteOrder: SiteLabel[];
  visibleSiteLabels: SiteLabel[];
  selectedSiteLabels: SiteLabel[];
  pageLayouts: LayoutState[];
}

export interface LayoutPresetSnapshot {
  selectedSiteLabels: SiteLabel[];
  activePageIndex: number;
  pageLayouts: LayoutState[];
}

export interface LayoutPreset {
  id: string;
  name: string;
  builtin: boolean;
  snapshot: LayoutPresetSnapshot;
}

export interface LayoutPresetState {
  activePresetId: string;
  items: LayoutPreset[];
}

export interface AvailabilityRecord {
  available: boolean;
  message: string;
  verifiedByWebview?: boolean;
  checkedAt?: number;
}

export interface PanelMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AttachmentItem {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  path?: string;
}
