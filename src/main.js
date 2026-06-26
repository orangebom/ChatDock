import Sortable from "./vendor/sortable.esm.js";
import { handleCloseRequest, hasBlockingOverlay } from "./close-confirm.js";
import {
  applyAvailabilityResults,
  clearSelectionState,
  createDefaultLayoutPresets,
  getLabelsToProbe,
  getSiteAvailability as readSiteAvailability,
  isSiteUnavailable as readSiteUnavailable,
  markAvailabilityFromWebview,
  sanitizeLayoutPresets,
  toggleSiteSelection,
  updateActivePresetSnapshot,
} from "./ui-state.js";

const { core, dpi, webview, window: tauriWindow, event: tauriEvent } = window.__TAURI__;
const { invoke } = core;
const { getVersion } = window.__TAURI__.app;
const { PhysicalPosition, PhysicalSize } = dpi;
const { Webview } = webview;
const { getCurrentWindow } = tauriWindow;

const appWindow = getCurrentWindow();
const THEME_STORAGE_KEY = "ai-compare-theme";
const WORKSPACE_STORAGE_KEY = "ai-compare-workspace-v2";
const LEGACY_WORKSPACE_STORAGE_KEY = "ai-compare-workspace-v1";
const LAYOUT_PRESETS_STORAGE_KEY = "chatdock-layout-presets-v1";
const ONBOARDING_STORAGE_KEY = "chatdock-onboarding-v1";
const SITE_AVAILABILITY_STORAGE_KEY = "chatdock-site-availability-v1";
const MAX_SITES_PER_PAGE = 4;

const DEFAULT_LAYOUT_STATE = {
  twoWaySplit: 0.5,
  threeWaySplits: [1 / 3, 2 / 3],
  quadCols: 0.5,
  quadRows: 0.5,
};
const PANEL_TOPBAR_HEIGHT = 34;
const PANEL_TOOLBAR_ROUTE = "/panel-toolbar.html";
const LAYOUT_PRESET_DROPDOWN_LABEL = "layout-preset-dropdown";
const LAYOUT_PRESET_DROPDOWN_ROUTE = "/layout-preset-dropdown.html";
const LAYOUT_PRESET_MENU_LABEL = "layout-preset-menu";
const LAYOUT_PRESET_MENU_ROUTE = "/layout-preset-menu.html";
const PROMPT_MIN_HEIGHT = 36;
const PROMPT_MAX_HEIGHT = 116;
const SITE_PROBE_TIMEOUT_MS = 7000;
const SITE_AVAILABILITY_SYNC_EVENT = "site-availability-sync";
const ATTACHMENT_DEBUG_EVENT = "attachment-injection-debug";

const TEXT = {
  emptyTitle: "\u5c1a\u672a\u9009\u62e9 AI",
  emptyMessage: "\u8bf7\u5148\u5728\u5e95\u90e8\u9009\u62e9\u8981\u663e\u793a\u7684 AI\u3002\u5f53\u5df2\u9009\u6570\u91cf\u8d85\u8fc7 4 \u4e2a\u65f6\uff0c\u4f1a\u6309\u52fe\u9009\u987a\u5e8f\u81ea\u52a8\u5206\u5230\u4e0b\u4e00\u9875\u3002",
  selectedPrefix: "\u5df2\u9009",
};

const ONBOARDING_STEPS = [
  {
    title: "欢迎使用 ChatDock",
    body: "这里可以把多个 AI 放在同一个工作台里并行对比。首次登录各家网站后，后续会尽量复用本地会话。",
    target: null,
    placement: "center",
  },
  {
    title: "顶部这里管全局操作",
    body: "你可以在这里切换分页、查看版本、重新打开引导、刷新全部已选 AI、重新适配布局，以及切换明暗主题。",
    target: ".topbar",
    placement: "bottom",
  },
  {
    title: "这里勾选要显示的 AI",
    body: "底部这一排是全局 AI 选择区。按勾选顺序自动分页，每页最多显示 4 个 AI；右键某个 AI 还可以打开快捷菜单，直接移除或测试连通。",
    target: ".compact-topline",
    placement: "top",
  },
  {
    title: "在这里统一发送问题",
    body: "底部输入框支持一次输入，同时发送给所有已勾选 AI。输入内容会自动增高，最多显示 5 行。",
    target: "#prompt-form",
    placement: "top",
  },
  {
    title: "中间区域是真实网页",
    body: "当前页会根据显示数量自动切换单屏、左右分屏、三列或 2x2 布局。每个面板右上角还能单独刷新、最大化或关闭。",
    target: ".grid-preview",
    placement: "top",
  },
  {
    title: "编辑 AI 列表和顺序",
    body: "点击“编辑 AI”可以管理底部显示哪些 AI，也可以在弹窗里拖动排序，调整常用 AI 的展示顺序。",
    target: "#manage-sites",
    placement: "top",
  },
  {
    title: "引导可以随时重新打开",
    body: "如果中途忘了某个操作，点击顶部“引导”按钮，就能从第一步重新查看整套说明。",
    target: "#open-onboarding",
    placement: "bottom",
  },
];

const state = {
  sites: [],
  siteMap: new Map(),
  siteAvailability: new Map(),
  pendingSiteAvailability: new Set(),
  webviews: new Map(),
  pendingWebviews: new Map(),
  webviewDropListeners: new Map(),
  toolbarWebviews: new Map(),
  pendingToolbarWebviews: new Map(),
  theme: document.documentElement.dataset.theme || "dark",
  themeMode: document.documentElement.dataset.themeMode || "system",
  systemThemeMedia: null,
  workspace: null,
  layoutPresets: null,
  isApplyingLayoutPreset: false,
  maximizedLabel: null,
  activeDrag: null,
  relayoutVersion: 0,
  layoutRefreshToken: 0,
  layoutRefreshTimers: [],
  resizeObserver: null,
  compactBarObserver: null,
  sortables: [],
  targetContextMenu: {
    open: false,
    siteLabel: null,
    x: 0,
    y: 0,
  },
  layoutPresetMenu: {
    open: false,
  },
  layoutPresetDropdown: {
    open: false,
  },
  layoutPresetDropdownWebview: null,
  layoutPresetMenuWebview: null,
  closeConfirm: {
    open: false,
    resolver: null,
  },
  composerAttachments: [],
  promptDropDepth: 0,
  panelDropTarget: null,
  onboarding: {
    open: false,
    completed: false,
    stepIndex: 0,
  },
};

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cloneLayout(layout) {
  const source = layout || DEFAULT_LAYOUT_STATE;
  return {
    twoWaySplit: clamp(Number(source.twoWaySplit) || DEFAULT_LAYOUT_STATE.twoWaySplit, 0.2, 0.8),
    threeWaySplits: Array.isArray(source.threeWaySplits) && source.threeWaySplits.length === 2
      ? [
          clamp(Number(source.threeWaySplits[0]) || DEFAULT_LAYOUT_STATE.threeWaySplits[0], 0.18, 0.7),
          clamp(Number(source.threeWaySplits[1]) || DEFAULT_LAYOUT_STATE.threeWaySplits[1], 0.3, 0.82),
        ]
      : [...DEFAULT_LAYOUT_STATE.threeWaySplits],
    quadCols: clamp(Number(source.quadCols) || DEFAULT_LAYOUT_STATE.quadCols, 0.24, 0.76),
    quadRows: clamp(Number(source.quadRows) || DEFAULT_LAYOUT_STATE.quadRows, 0.24, 0.76),
  };
}

function createDefaultWorkspace() {
  const siteOrder = getAllSiteLabels();
  return {
    activePageIndex: 0,
    siteOrder,
    visibleSiteLabels: siteOrder,
    selectedSiteLabels: [],
    pageLayouts: [cloneLayout()],
  };
}

function getAllSiteLabels() {
  return state.sites.map((site) => site.label);
}

function getPageCount(selectedCount = state.workspace?.selectedSiteLabels.length || 0) {
  return Math.max(1, Math.ceil(selectedCount / MAX_SITES_PER_PAGE));
}

function normalizePageLayouts(rawLayouts, pageCount) {
  const layouts = Array.isArray(rawLayouts) ? rawLayouts.map((layout) => cloneLayout(layout)) : [];
  while (layouts.length < pageCount) {
    layouts.push(cloneLayout());
  }
  return layouts.slice(0, pageCount);
}

function migrateLegacyWorkspace(rawWorkspace) {
  const selectedFromLegacy = Array.isArray(rawWorkspace?.selectedSiteLabels)
    ? rawWorkspace.selectedSiteLabels
    : [];
  const layoutsFromLegacy = Array.isArray(rawWorkspace?.pages)
    ? rawWorkspace.pages.map((page) => page?.layout)
    : rawWorkspace?.pageLayouts;

  return {
    activePageIndex: 0,
    siteOrder: getAllSiteLabels(),
    visibleSiteLabels: getAllSiteLabels(),
    selectedSiteLabels: selectedFromLegacy,
    pageLayouts: layoutsFromLegacy,
  };
}

function sanitizeWorkspace(rawWorkspace) {
  const validSiteLabels = new Set(getAllSiteLabels());
  const rawOrder = Array.isArray(rawWorkspace?.siteOrder) ? rawWorkspace.siteOrder : [];
  const dedupedOrder = rawOrder.filter(
    (label, index, source) => validSiteLabels.has(label) && source.indexOf(label) === index,
  );
  const missingLabels = getAllSiteLabels().filter((label) => !dedupedOrder.includes(label));
  const siteOrder = [...dedupedOrder, ...missingLabels];
  const visibleSiteLabels = Array.isArray(rawWorkspace?.visibleSiteLabels)
    ? rawWorkspace.visibleSiteLabels.filter(
        (label, index, source) => siteOrder.includes(label) && source.indexOf(label) === index,
      )
    : [...siteOrder];
  const selectedSiteLabels = Array.isArray(rawWorkspace?.selectedSiteLabels)
    ? rawWorkspace.selectedSiteLabels.filter(
        (label, index, source) => visibleSiteLabels.includes(label) && source.indexOf(label) === index,
      )
    : [];

  const pageCount = getPageCount(selectedSiteLabels.length);
  const activePageIndex = clamp(
    Number.isInteger(rawWorkspace?.activePageIndex) ? rawWorkspace.activePageIndex : 0,
    0,
    pageCount - 1,
  );

  return {
    activePageIndex,
    siteOrder,
    visibleSiteLabels,
    selectedSiteLabels,
    pageLayouts: normalizePageLayouts(rawWorkspace?.pageLayouts, pageCount),
  };
}

function loadWorkspace() {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (raw) {
      return sanitizeWorkspace(JSON.parse(raw));
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY);
    if (legacyRaw) {
      return sanitizeWorkspace(migrateLegacyWorkspace(JSON.parse(legacyRaw)));
    }

    return createDefaultWorkspace();
  } catch (_error) {
    return createDefaultWorkspace();
  }
}

function loadLayoutPresets() {
  try {
    const raw = window.localStorage.getItem(LAYOUT_PRESETS_STORAGE_KEY);
    if (raw) {
      return sanitizeLayoutPresets(JSON.parse(raw), getAllSiteLabels(), normalizePageLayouts);
    }
  } catch (_error) {
    // Fall through to defaults when local data is unreadable.
  }

  return createDefaultLayoutPresets(getAllSiteLabels(), normalizePageLayouts);
}

function persistLayoutPresets() {
  if (!state.layoutPresets) {
    return;
  }
  state.layoutPresets = sanitizeLayoutPresets(
    state.layoutPresets,
    getAllSiteLabels(),
    normalizePageLayouts,
  );
  window.localStorage.setItem(LAYOUT_PRESETS_STORAGE_KEY, JSON.stringify(state.layoutPresets));
}

function persistWorkspace() {
  const pageCount = getPageCount();
  state.workspace.siteOrder = sanitizeSiteOrder(state.workspace.siteOrder);
  state.workspace.visibleSiteLabels = sanitizeVisibleSiteLabels(
    state.workspace.visibleSiteLabels,
    state.workspace.siteOrder,
  );
  state.workspace.selectedSiteLabels = state.workspace.selectedSiteLabels.filter((label) =>
    state.workspace.visibleSiteLabels.includes(label),
  );
  state.workspace.activePageIndex = clamp(state.workspace.activePageIndex, 0, pageCount - 1);
  state.workspace.pageLayouts = normalizePageLayouts(state.workspace.pageLayouts, pageCount);
  window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state.workspace));

  if (state.layoutPresets && !state.isApplyingLayoutPreset) {
    state.layoutPresets = updateActivePresetSnapshot(
      state.layoutPresets,
      state.workspace,
      normalizePageLayouts,
    );
    persistLayoutPresets();
  }
}

function sanitizeSiteOrder(order) {
  const validLabels = new Set(getAllSiteLabels());
  const rawOrder = Array.isArray(order) ? order : [];
  const dedupedOrder = rawOrder.filter(
    (label, index, source) => validLabels.has(label) && source.indexOf(label) === index,
  );
  const missingLabels = getAllSiteLabels().filter((label) => !dedupedOrder.includes(label));
  return [...dedupedOrder, ...missingLabels];
}

function sanitizeVisibleSiteLabels(visibleLabels, siteOrder = state.workspace?.siteOrder || getAllSiteLabels()) {
  const validOrder = sanitizeSiteOrder(siteOrder);
  const rawVisible = Array.isArray(visibleLabels) ? visibleLabels : validOrder;
  return rawVisible.filter(
    (label, index, source) => validOrder.includes(label) && source.indexOf(label) === index,
  );
}

function getOrderedSites() {
  const siteOrder = sanitizeSiteOrder(state.workspace?.siteOrder);
  return siteOrder.map((label) => getSiteMeta(label)).filter(Boolean);
}

function getSiteAvailability(label) {
  return readSiteAvailability(state.siteAvailability, label);
}

function isSiteUnavailable(label) {
  return readSiteUnavailable(state.siteAvailability, label);
}

function syncSiteAvailability(label, available, message = "", options = {}) {
  if (!state.siteMap.has(label)) {
    return;
  }

  const next = options.fromWebview
    ? markAvailabilityFromWebview(state.siteAvailability, label, available, message)
    : {
        available,
        message: available ? "" : (message || "不可访问"),
        verifiedByWebview: false,
      };

  state.siteAvailability.set(label, {
    ...next,
    checkedAt: Date.now(),
  });
  persistSiteAvailability();
  renderGlobalTargets();
}

function getVisibleManagedSites() {
  const visibleLabels = new Set(state.workspace.visibleSiteLabels);
  return getOrderedSites().filter((site) => visibleLabels.has(site.label));
}

function getHiddenManagedSites() {
  const visibleLabels = new Set(state.workspace.visibleSiteLabels);
  return getOrderedSites().filter((site) => !visibleLabels.has(site.label));
}

function getPageLabels(pageIndex = state.workspace.activePageIndex) {
  const start = pageIndex * MAX_SITES_PER_PAGE;
  return state.workspace.selectedSiteLabels.slice(start, start + MAX_SITES_PER_PAGE);
}

function getMaximizedTarget(pageLabels = getPageLabels()) {
  const label = state.maximizedLabel;
  if (!label) {
    return null;
  }
  if (!state.workspace.selectedSiteLabels.includes(label)) {
    return null;
  }
  return pageLabels.includes(label) ? label : null;
}

function isTargetMaximized(label, pageLabels = getPageLabels()) {
  return getMaximizedTarget(pageLabels) === label;
}

function getVisibleTargets() {
  const pageLabels = getPageLabels();
  const maximizedLabel = getMaximizedTarget(pageLabels);
  return maximizedLabel ? [maximizedLabel] : pageLabels;
}

function currentLayoutState() {
  const pageCount = getPageCount();
  state.workspace.activePageIndex = clamp(state.workspace.activePageIndex, 0, pageCount - 1);
  state.workspace.pageLayouts = normalizePageLayouts(state.workspace.pageLayouts, pageCount);
  return state.workspace.pageLayouts[state.workspace.activePageIndex];
}

function getSiteMeta(label) {
  return state.siteMap.get(label);
}

function createRect(x, y, width, height) {
  return { x, y, width, height };
}

function getGridRect() {
  return document.querySelector(".grid-preview")?.getBoundingClientRect() || null;
}

function hasUsableGridSize() {
  const rect = getGridRect();
  return Boolean(rect && rect.width > 120 && rect.height > 120);
}

function syncCompactBarHeight() {
  const compactBar = document.querySelector(".compact-bar");
  if (!compactBar) {
    return false;
  }

  const nextHeight = `${Math.ceil(compactBar.getBoundingClientRect().height)}px`;
  if (document.documentElement.style.getPropertyValue("--compact-bar-height") === nextHeight) {
    return false;
  }

  document.documentElement.style.setProperty("--compact-bar-height", nextHeight);
  return true;
}

function loadOnboardingCompleted() {
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "done";
  } catch (_error) {
    return false;
  }
}

function sanitizeAvailabilityRecord(label, value) {
  if (!label || typeof value !== "object" || value === null) {
    return null;
  }

  return {
    available: value.available === true,
    message: value.available === true ? "" : (typeof value.message === "string" && value.message) || "不可访问",
    verifiedByWebview: value.verifiedByWebview === true,
    checkedAt: Number.isFinite(value.checkedAt) ? value.checkedAt : null,
  };
}

function loadSiteAvailability() {
  try {
    const raw = window.localStorage.getItem(SITE_AVAILABILITY_STORAGE_KEY);
    if (!raw) {
      return new Map();
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return new Map();
    }

    return new Map(
      Object.entries(parsed)
        .map(([label, value]) => [label, sanitizeAvailabilityRecord(label, value)])
        .filter((entry) => entry[1]),
    );
  } catch (_error) {
    return new Map();
  }
}

function persistSiteAvailability() {
  const payload = Object.fromEntries(
    [...state.siteAvailability.entries()]
      .filter(([label]) => state.siteMap.has(label))
      .map(([label, value]) => [
        label,
        {
          available: value.available === true,
          message: value.available === true ? "" : value.message || "不可访问",
          verifiedByWebview: value.verifiedByWebview === true,
          checkedAt: Number.isFinite(value.checkedAt) ? value.checkedAt : Date.now(),
        },
      ]),
  );

  try {
    window.localStorage.setItem(SITE_AVAILABILITY_STORAGE_KEY, JSON.stringify(payload));
  } catch (_error) {
    // Ignore storage errors and continue.
  }
}

function persistOnboardingCompleted() {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "done");
  } catch (_error) {
    // Ignore storage errors and continue.
  }
}

function isAnyOverlayOpen() {
  return hasBlockingOverlay({
    siteManagerOpen: isSiteManagerOpen(),
    closeConfirmOpen: isCloseConfirmOpen(),
    aboutOpen: isAboutDialogOpen(),
    onboardingOpen: isOnboardingOpen(),
    targetContextMenuOpen: isTargetContextMenuOpen(),
    layoutPresetsOpen: isLayoutPresetsOpen(),
  });
}

function getContextMenuState() {
  return state.targetContextMenu;
}

function closeTargetContextMenu() {
  const shell = document.querySelector("#target-context-menu");
  const menu = shell?.querySelector(".context-menu");
  const activePill = state.targetContextMenu.siteLabel
    ? document.querySelector(`.target-pill[data-site-label="${state.targetContextMenu.siteLabel}"]`)
    : null;

  shell && (shell.hidden = true);
  menu?.style.removeProperty("left");
  menu?.style.removeProperty("top");
  activePill?.classList.remove("context-open");

  state.targetContextMenu.open = false;
  state.targetContextMenu.siteLabel = null;
  state.targetContextMenu.x = 0;
  state.targetContextMenu.y = 0;
  void syncVisibleWebviews();
  void syncVisibleToolbarWebviews();
}

function positionTargetContextMenu() {
  const shell = document.querySelector("#target-context-menu");
  const menu = shell?.querySelector(".context-menu");
  if (!shell || !menu || shell.hidden) {
    return;
  }

  const padding = 10;
  const width = menu.offsetWidth || 156;
  const height = menu.offsetHeight || 94;
  const left = clamp(state.targetContextMenu.x, padding, Math.max(padding, window.innerWidth - width - padding));
  const top = clamp(state.targetContextMenu.y, padding, Math.max(padding, window.innerHeight - height - padding));

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function openTargetContextMenu(siteLabel, x, y) {
  const site = getSiteMeta(siteLabel);
  const shell = document.querySelector("#target-context-menu");
  const title = document.querySelector("#target-context-title");
  if (!site || !shell || !title) {
    return;
  }

  const previousPill = state.targetContextMenu.siteLabel
    ? document.querySelector(`.target-pill[data-site-label="${state.targetContextMenu.siteLabel}"]`)
    : null;
  previousPill?.classList.remove("context-open");

  state.targetContextMenu.open = true;
  state.targetContextMenu.siteLabel = siteLabel;
  state.targetContextMenu.x = x;
  state.targetContextMenu.y = y;

  title.textContent = `${site.title} 操作`;
  shell.hidden = false;

  const nextPill = document.querySelector(`.target-pill[data-site-label="${siteLabel}"]`);
  nextPill?.classList.add("context-open");

  positionTargetContextMenu();
  void syncVisibleWebviews();
  void syncVisibleToolbarWebviews();
}

async function runTargetContextAction(action, siteLabel) {
  const site = getSiteMeta(siteLabel);
  if (!site) {
    return;
  }

  if (action === "remove") {
    removeVisibleSite(siteLabel);
    renderWorkspace();
    await refreshLayout();
    setStatus(`${site.title} 已从底部 AI 选择中移除。`, "ok");
    return;
  }

  if (action === "test-connectivity") {
    setStatus(`正在测试 ${site.title} 连通性...`, "working");
    await ensureSiteAvailability([siteLabel], { force: true });
    const availability = getSiteAvailability(siteLabel);
    if (availability?.available) {
      setStatus(`${site.title} 连通正常。`, "ok");
    } else {
      setStatus(`${site.title} 当前不可访问。`, "warn");
    }
  }
}

function isOnboardingOpen() {
  const shell = document.querySelector("#onboarding");
  return Boolean(shell && !shell.hidden);
}

function getOnboardingStep() {
  return ONBOARDING_STEPS[state.onboarding.stepIndex] || ONBOARDING_STEPS[0];
}

function getViewportPadding() {
  return 20;
}

function getTargetRect(selector) {
  if (!selector) {
    return null;
  }
  const element = document.querySelector(selector);
  if (!element) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return rect;
}

function isTargetContextMenuOpen() {
  const shell = document.querySelector("#target-context-menu");
  return Boolean(shell && !shell.hidden);
}

function clampCardPosition(value, size, viewportSize, padding = getViewportPadding()) {
  return clamp(value, padding, Math.max(padding, viewportSize - size - padding));
}

function updateOnboardingFocus(step) {
  const focus = document.querySelector("#tour-focus");
  const shadeTop = document.querySelector(".tour-shade-top");
  const shadeLeft = document.querySelector(".tour-shade-left");
  const shadeRight = document.querySelector(".tour-shade-right");
  const shadeBottom = document.querySelector(".tour-shade-bottom");
  if (!focus) {
    return;
  }

  const rect = getTargetRect(step.target);
  if (!rect) {
    focus.hidden = true;
    if (shadeTop) {
      shadeTop.style.top = "0";
      shadeTop.style.left = "0";
      shadeTop.style.width = "100%";
      shadeTop.style.height = "100%";
    }
    if (shadeLeft) {
      shadeLeft.style.width = "0";
      shadeLeft.style.height = "0";
    }
    if (shadeRight) {
      shadeRight.style.width = "0";
      shadeRight.style.height = "0";
    }
    if (shadeBottom) {
      shadeBottom.style.width = "0";
      shadeBottom.style.height = "0";
    }
    return;
  }

  const padding = 10;
  const viewportPadding = getViewportPadding();
  const focusLeft = Math.max(viewportPadding, rect.left - padding);
  const focusTop = Math.max(viewportPadding, rect.top - padding);
  const focusWidth = Math.min(window.innerWidth - viewportPadding * 2, rect.width + padding * 2);
  const focusHeight = Math.min(window.innerHeight - viewportPadding * 2, rect.height + padding * 2);
  const focusRight = Math.min(window.innerWidth - viewportPadding, focusLeft + focusWidth);
  const focusBottom = Math.min(window.innerHeight - viewportPadding, focusTop + focusHeight);

  focus.hidden = false;
  focus.style.left = `${focusLeft}px`;
  focus.style.top = `${focusTop}px`;
  focus.style.width = `${Math.max(0, focusRight - focusLeft)}px`;
  focus.style.height = `${Math.max(0, focusBottom - focusTop)}px`;

  if (shadeTop) {
    shadeTop.style.left = "0";
    shadeTop.style.top = "0";
    shadeTop.style.width = "100%";
    shadeTop.style.height = `${Math.max(0, focusTop)}px`;
  }

  if (shadeLeft) {
    shadeLeft.style.left = "0";
    shadeLeft.style.top = `${focusTop}px`;
    shadeLeft.style.width = `${Math.max(0, focusLeft)}px`;
    shadeLeft.style.height = `${Math.max(0, focusBottom - focusTop)}px`;
  }

  if (shadeRight) {
    shadeRight.style.left = `${focusRight}px`;
    shadeRight.style.top = `${focusTop}px`;
    shadeRight.style.width = `${Math.max(0, window.innerWidth - focusRight)}px`;
    shadeRight.style.height = `${Math.max(0, focusBottom - focusTop)}px`;
  }

  if (shadeBottom) {
    shadeBottom.style.left = "0";
    shadeBottom.style.top = `${focusBottom}px`;
    shadeBottom.style.width = "100%";
    shadeBottom.style.height = `${Math.max(0, window.innerHeight - focusBottom)}px`;
  }
}

function updateOnboardingCardPosition(step) {
  const card = document.querySelector("#tour-card");
  const targetRect = getTargetRect(step.target);
  if (!card) {
    return;
  }

  const cardRect = card.getBoundingClientRect();
  const padding = 20;
  let left = (window.innerWidth - cardRect.width) / 2;
  let top = (window.innerHeight - cardRect.height) / 2;

  if (targetRect) {
    const centeredLeft = targetRect.left + targetRect.width / 2 - cardRect.width / 2;
    left = clampCardPosition(centeredLeft, cardRect.width, window.innerWidth, padding);

    if (step.placement === "top") {
      top = targetRect.top - cardRect.height - 18;
      if (top < padding) {
        top = clampCardPosition(targetRect.bottom + 18, cardRect.height, window.innerHeight, padding);
      }
    } else if (step.placement === "bottom") {
      top = targetRect.bottom + 18;
      if (top + cardRect.height > window.innerHeight - padding) {
        top = clampCardPosition(targetRect.top - cardRect.height - 18, cardRect.height, window.innerHeight, padding);
      }
    } else {
      top = clampCardPosition(
        targetRect.top + targetRect.height / 2 - cardRect.height / 2,
        cardRect.height,
        window.innerHeight,
        padding,
      );
    }
  }

  card.style.left = `${clampCardPosition(left, cardRect.width, window.innerWidth, padding)}px`;
  card.style.top = `${clampCardPosition(top, cardRect.height, window.innerHeight, padding)}px`;
}

function renderOnboardingStep() {
  const shell = document.querySelector("#onboarding");
  const title = document.querySelector("#tour-title");
  const body = document.querySelector("#tour-body");
  const progress = document.querySelector("#tour-progress");
  const dots = document.querySelector("#tour-dots");
  const prev = document.querySelector("#tour-prev");
  const next = document.querySelector("#tour-next");

  if (!shell || shell.hidden || !title || !body || !progress || !dots || !prev || !next) {
    return;
  }

  const step = getOnboardingStep();
  const total = ONBOARDING_STEPS.length;
  const current = state.onboarding.stepIndex + 1;

  title.textContent = step.title;
  body.textContent = step.body;
  progress.textContent = `${current} / ${total}`;
  prev.disabled = state.onboarding.stepIndex === 0;
  next.textContent = current === total ? "完成" : "下一步";

  dots.innerHTML = "";
  ONBOARDING_STEPS.forEach((_, index) => {
    const dot = document.createElement("span");
    dot.className = `tour-dot${index === state.onboarding.stepIndex ? " active" : ""}`;
    dots.append(dot);
  });

  updateOnboardingFocus(step);
  window.requestAnimationFrame(() => {
    updateOnboardingCardPosition(step);
  });
}

async function openOnboarding(resetToFirst = false) {
  const shell = document.querySelector("#onboarding");
  if (!shell) {
    return;
  }
  if (isSiteManagerOpen()) {
    await closeSiteManager();
  }
  if (resetToFirst) {
    state.onboarding.stepIndex = 0;
  }
  state.onboarding.open = true;
  shell.hidden = false;
  renderOnboardingStep();
  await syncVisibleWebviews();
  await syncVisibleToolbarWebviews();
  await refreshLayout(1);
}

async function closeOnboarding(markCompleted = false) {
  const shell = document.querySelector("#onboarding");
  if (!shell) {
    return;
  }
  shell.hidden = true;
  state.onboarding.open = false;
  if (markCompleted) {
    state.onboarding.completed = true;
    persistOnboardingCompleted();
  }
  await refreshLayout();
}

async function stepOnboarding(direction) {
  const nextIndex = clamp(
    state.onboarding.stepIndex + direction,
    0,
    ONBOARDING_STEPS.length - 1,
  );
  if (nextIndex === state.onboarding.stepIndex) {
    return;
  }
  state.onboarding.stepIndex = nextIndex;
  renderOnboardingStep();
  await refreshLayout(1);
}

function autosizePrompt() {
  const prompt = document.querySelector("#prompt");
  if (!prompt) {
    return;
  }

  prompt.style.height = `${PROMPT_MIN_HEIGHT}px`;
  const nextHeight = Math.min(Math.max(prompt.scrollHeight, PROMPT_MIN_HEIGHT), PROMPT_MAX_HEIGHT);
  prompt.style.height = `${nextHeight}px`;
  prompt.style.overflowY = prompt.scrollHeight > PROMPT_MAX_HEIGHT ? "auto" : "hidden";
  syncCompactBarHeight();
}

function createAttachmentId() {
  return `attachment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isImageType(file) {
  return Boolean(file?.type && file.type.startsWith("image/"));
}

function formatAttachmentSize(size) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function dataUrlToBase64(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function normalizeAttachment(file) {
  const dataUrl = await readFileAsDataUrl(file);
  return {
    id: createAttachmentId(),
    name: file.name || "attachment",
    type: file.type || "application/octet-stream",
    size: Number(file.size) || 0,
    kind: isImageType(file) ? "image" : "file",
    previewUrl: isImageType(file) ? dataUrl : "",
    base64: dataUrlToBase64(dataUrl),
  };
}

function renderComposerAttachments() {
  const container = document.querySelector("#prompt-attachments");
  const dropzone = document.querySelector("#prompt-dropzone");
  if (!container || !dropzone) {
    return;
  }

  const attachments = state.composerAttachments;
  container.innerHTML = "";
  container.hidden = attachments.length === 0;
  dropzone.dataset.hasAttachments = attachments.length > 0 ? "true" : "false";

  for (const attachment of attachments) {
    const item = document.createElement("div");
    item.className = `prompt-attachment prompt-attachment-${attachment.kind}`;
    item.dataset.attachmentId = attachment.id;

    const thumb = document.createElement("div");
    thumb.className = "prompt-attachment-thumb";
    if (attachment.kind === "image" && attachment.previewUrl) {
      const image = document.createElement("img");
      image.src = attachment.previewUrl;
      image.alt = attachment.name;
      thumb.append(image);
    } else {
      const badge = document.createElement("span");
      badge.className = "prompt-attachment-ext";
      const extension = attachment.name.includes(".")
        ? attachment.name.split(".").pop()
        : "FILE";
      badge.textContent = (extension || "FILE").slice(0, 4).toUpperCase();
      thumb.append(badge);
    }

    const meta = document.createElement("div");
    meta.className = "prompt-attachment-meta";

    const name = document.createElement("div");
    name.className = "prompt-attachment-name";
    name.textContent = attachment.name;

    const info = document.createElement("div");
    info.className = "prompt-attachment-info";
    info.textContent = `${attachment.kind === "image" ? "图片" : "文件"} · ${formatAttachmentSize(attachment.size)}`;

    meta.append(name, info);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "prompt-attachment-remove";
    remove.dataset.removeAttachment = attachment.id;
    remove.setAttribute("aria-label", `移除 ${attachment.name}`);
    remove.title = `移除 ${attachment.name}`;
    remove.textContent = "×";

    item.append(thumb, meta, remove);
    container.append(item);
  }

  syncCompactBarHeight();
}

function setPromptDropActive(active) {
  const dropzone = document.querySelector("#prompt-dropzone");
  if (!dropzone) {
    return;
  }
  dropzone.dataset.dragActive = active ? "true" : "false";
}

function setPanelDropTarget(label = null) {
  if (state.panelDropTarget === label) {
    return;
  }

  if (state.panelDropTarget) {
    const previous = getPanelElement(state.panelDropTarget);
    previous?.classList.remove("is-drop-target");
  }

  state.panelDropTarget = label;
  if (!label) {
    return;
  }

  const panel = getPanelElement(label);
  panel?.classList.add("is-drop-target");
}

function clearDragVisualState() {
  resetPromptDropState();
  setPanelDropTarget(null);
}

function resetPromptDropState() {
  state.promptDropDepth = 0;
  setPromptDropActive(false);
}

function collectFilesFromItems(items) {
  const files = [];
  if (!items) {
    return files;
  }

  for (const item of Array.from(items)) {
    if (!item || item.kind !== "file") {
      continue;
    }
    const file = item.getAsFile?.();
    if (file) {
      files.push(file);
    }
  }
  return files;
}

function hasDraggedFiles(dataTransfer) {
  if (!dataTransfer) {
    return false;
  }

  if (Number(dataTransfer.files?.length) > 0) {
    return true;
  }

  const itemList = Array.from(dataTransfer.items || []);
  if (itemList.some((item) => item?.kind === "file")) {
    return true;
  }

  return Array.from(dataTransfer.types || []).includes("Files");
}

function describeDragTransfer(dataTransfer) {
  if (!dataTransfer) {
    return {
      hasTransfer: false,
      files: 0,
      items: [],
      types: [],
    };
  }

  return {
    hasTransfer: true,
    files: Number(dataTransfer.files?.length) || 0,
    items: Array.from(dataTransfer.items || []).map((item) => ({
      kind: item?.kind || "",
      type: item?.type || "",
    })),
    types: Array.from(dataTransfer.types || []),
  };
}

function guessMimeTypeFromName(name) {
  const lowerName = String(name || "").toLowerCase();
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".gif")) return "image/gif";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".bmp")) return "image/bmp";
  if (lowerName.endsWith(".svg")) return "image/svg+xml";
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".txt")) return "text/plain";
  if (lowerName.endsWith(".md")) return "text/markdown";
  if (lowerName.endsWith(".json")) return "application/json";
  if (lowerName.endsWith(".csv")) return "text/csv";
  if (lowerName.endsWith(".doc")) return "application/msword";
  if (lowerName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lowerName.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lowerName.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lowerName.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lowerName.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lowerName.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

async function pathToAttachment(path) {
  const name = String(path || "").split(/[/\\\\]/).pop() || "attachment";
  const bytes = await invoke("read_file_bytes", { path });
  const uint8 = Uint8Array.from(bytes || []);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < uint8.length; index += chunkSize) {
    const chunk = uint8.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const type = guessMimeTypeFromName(name);
  const base64 = btoa(binary);
  return {
    id: createAttachmentId(),
    name,
    type,
    size: uint8.length,
    kind: type.startsWith("image/") ? "image" : "file",
    previewUrl: type.startsWith("image/") ? `data:${type};base64,${base64}` : "",
    base64,
  };
}

async function appendComposerPaths(paths) {
  const validPaths = Array.from(paths || []).filter(Boolean);
  if (!validPaths.length) {
    return 0;
  }

  const attachments = await Promise.all(validPaths.map((path) => pathToAttachment(path)));
  const beforeCount = state.composerAttachments.length;
  state.composerAttachments = uniqueAttachments(state.composerAttachments, attachments);
  renderComposerAttachments();
  scheduleLayoutRefresh("attachments-change", [0, 80, 220]);
  return state.composerAttachments.length - beforeCount;
}

function uniqueAttachments(existing, incoming) {
  const seen = new Set(existing.map((item) => `${item.name}::${item.size}::${item.type}::${item.base64}`));
  const next = [...existing];
  for (const item of incoming) {
    const key = `${item.name}::${item.size}::${item.type}::${item.base64}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(item);
  }
  return next;
}

async function appendComposerFiles(files) {
  const validFiles = Array.from(files || []).filter((file) => file && file.size >= 0);
  if (!validFiles.length) {
    return 0;
  }

  const attachments = await Promise.all(validFiles.map((file) => normalizeAttachment(file)));
  const beforeCount = state.composerAttachments.length;
  state.composerAttachments = uniqueAttachments(state.composerAttachments, attachments);
  renderComposerAttachments();
  scheduleLayoutRefresh("attachments-change", [0, 80, 220]);
  return state.composerAttachments.length - beforeCount;
}

function removeComposerAttachment(attachmentId) {
  const next = state.composerAttachments.filter((item) => item.id !== attachmentId);
  if (next.length === state.composerAttachments.length) {
    return;
  }

  state.composerAttachments = next;
  renderComposerAttachments();
  scheduleLayoutRefresh("attachments-change", [0, 80, 220]);
}

function clearComposerAttachments() {
  if (!state.composerAttachments.length) {
    return;
  }
  state.composerAttachments = [];
  renderComposerAttachments();
  scheduleLayoutRefresh("attachments-change", [0, 80, 220]);
}

function serializeComposerAttachments() {
  return state.composerAttachments.map((attachment) => ({
    name: attachment.name,
    mimeType: attachment.type,
    size: attachment.size,
    kind: attachment.kind,
    base64: attachment.base64,
  }));
}

async function serializeAttachmentsFromPaths(paths) {
  const validPaths = Array.from(paths || []).filter(Boolean);
  if (!validPaths.length) {
    return [];
  }

  const attachments = await Promise.all(validPaths.map((path) => pathToAttachment(path)));
  return attachments.map((attachment) => ({
    name: attachment.name,
    mimeType: attachment.type,
    size: attachment.size,
    kind: attachment.kind,
    base64: attachment.base64,
  }));
}

function physicalToViewportPosition(position) {
  if (!position) {
    return null;
  }

  return {
    x: position.x / window.devicePixelRatio,
    y: position.y / window.devicePixelRatio,
  };
}

function findPanelDropTarget(position) {
  if (!position) {
    logAttachmentDebug("panel-hit:none-position");
    return null;
  }

  const viewportPosition = physicalToViewportPosition(position);
  if (!viewportPosition) {
    logAttachmentDebug("panel-hit:no-viewport-position", { position });
    return null;
  }

  const labelMetrics = getVisibleTargets()
    .map((label) => ({ label, metrics: paneMetrics(label) }))
    .filter((entry) => entry.metrics);

  for (const entry of labelMetrics) {
    const { x, y, width, height } = entry.metrics;
    if (
      viewportPosition.x >= x &&
      viewportPosition.x <= x + width &&
      viewportPosition.y >= y &&
      viewportPosition.y <= y + height
    ) {
      logAttachmentDebug("panel-hit:matched", {
        label: entry.label,
        position,
        viewportPosition,
        metrics: entry.metrics,
      });
      return entry.label;
    }
  }

  logAttachmentDebug("panel-hit:missed", {
    position,
    viewportPosition,
    visiblePanels: labelMetrics.map((entry) => ({
      label: entry.label,
      metrics: entry.metrics,
    })),
  });
  return null;
}

async function injectAttachmentsIntoPanel(targetLabel, paths) {
  logAttachmentDebug("panel-inject:start", {
    targetLabel,
    pathCount: Array.from(paths || []).filter(Boolean).length,
  });
  const attachments = await serializeAttachmentsFromPaths(paths);
  if (!attachments.length) {
    logAttachmentDebug("panel-inject:no-attachments", { targetLabel, paths });
    return { ok: false, message: "没有可注入的附件" };
  }

  const result = await invoke("inject_attachments", {
    target: targetLabel,
    attachments,
  });
  logAttachmentDebug("panel-inject:result", {
    targetLabel,
    ok: result?.ok,
    message: result?.message,
    attachmentCount: attachments.length,
  });
  return result;
}

async function ensureWebviewDropListener(siteLabel, webviewInstance) {
  if (!siteLabel || !webviewInstance || state.webviewDropListeners.has(siteLabel)) {
    return;
  }

  const unlisten = await webviewInstance.onDragDropEvent(async (event) => {
    logAttachmentDebug("child-webview-drag:event", {
      siteLabel,
      type: event.payload?.type,
      position: event.payload?.position,
      paths: event.payload?.paths || [],
    });

    if (event.payload?.type === "over" || event.payload?.type === "enter") {
      setPanelDropTarget(siteLabel);
      return;
    }

    if (event.payload?.type === "leave") {
      setPanelDropTarget(null);
      return;
    }

    if (event.payload?.type !== "drop") {
      return;
    }

    setPanelDropTarget(null);
    try {
      const result = await injectAttachmentsIntoPanel(siteLabel, event.payload.paths || []);
      if (result?.ok) {
        const site = getSiteMeta(siteLabel);
        setStatus(`已将附件注入 ${site?.title || siteLabel} 面板。`, "ok");
      } else {
        setStatus(`注入附件失败：${result?.message || "未知错误"}`, "fail");
      }
    } catch (error) {
      console.error(error);
      setStatus(`子面板拖拽失败：${error}`, "fail");
    }
  });

  state.webviewDropListeners.set(siteLabel, unlisten);
  logAttachmentDebug("child-webview-drag:listener-bound", { siteLabel });
}

function wirePromptAttachments() {
  const promptField = document.querySelector("#prompt");
  const dropzone = document.querySelector("#prompt-dropzone");
  const attachments = document.querySelector("#prompt-attachments");
  const compactBar = document.querySelector(".compact-bar");
  if (!promptField || !dropzone || !attachments || !compactBar) {
    return;
  }

  attachments.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-remove-attachment]");
    if (!button) {
      return;
    }
    removeComposerAttachment(button.dataset.removeAttachment);
  });

  promptField.addEventListener("paste", async (event) => {
    const files = collectFilesFromItems(event.clipboardData?.items);
    if (!files.length) {
      return;
    }

    event.preventDefault();
    try {
      const count = await appendComposerFiles(files);
      if (count > 0) {
        setStatus(`??? ${count} ????`, "ok");
      }
    } catch (error) {
      console.error(error);
      setStatus(`???????${error}`, "fail");
    }
  });

  const logDragEvent = (eventName, event, accepted = null) => {
    console.info("[drag-debug]", eventName, {
      accepted,
      targetId: event.target?.id || "",
      targetClass: event.target?.className || "",
      currentTargetId: event.currentTarget?.id || "",
      currentTargetClass: event.currentTarget?.className || "",
      transfer: describeDragTransfer(event.dataTransfer),
    });
  };

  const markDrag = (event, eventName = "drag") => {
    const accepted = hasDraggedFiles(event.dataTransfer);
    logDragEvent(eventName, event, accepted);
    if (!accepted) {
      return false;
    }
    event.preventDefault();
    return true;
  };

  const handleDragEnter = (event) => {
    if (!markDrag(event, "dragenter")) {
      return;
    }
    state.promptDropDepth += 1;
    setPromptDropActive(true);
  };

  const handleDragOver = (event) => {
    if (!markDrag(event, "dragover")) {
      return;
    }
    event.dataTransfer.dropEffect = "copy";
    setPromptDropActive(true);
  };

  const handleDragLeave = (event) => {
    const accepted = hasDraggedFiles(event.dataTransfer);
    logDragEvent("dragleave", event, accepted);
    if (!accepted) {
      return;
    }
    event.preventDefault();
    state.promptDropDepth = Math.max(0, state.promptDropDepth - 1);
    if (state.promptDropDepth === 0 || event.currentTarget === event.target) {
      setPromptDropActive(false);
    }
  };

  const handleDrop = async (event) => {
    if (!markDrag(event, "drop")) {
      return;
    }
    clearDragVisualState();
    const files = Array.from(event.dataTransfer?.files || []);
    console.info("[drag-debug]", "drop-files", files.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
    })));
    if (!files.length) {
      return;
    }
    try {
      const count = await appendComposerFiles(files);
      if (count > 0) {
        setStatus(`??? ${count} ????`, "ok");
      }
    } catch (error) {
      console.error(error);
      setStatus(`???????${error}`, "fail");
    }
  };

  for (const node of [compactBar, dropzone, promptField]) {
    node.addEventListener("dragenter", handleDragEnter);
    node.addEventListener("dragover", handleDragOver);
    node.addEventListener("dragleave", handleDragLeave);
    node.addEventListener("drop", handleDrop);
  }

  renderComposerAttachments();
}
async function renderAppVersion() {
  const versionNode = document.querySelector("#app-version");
  if (!versionNode) {
    return;
  }

  try {
    const version = await getVersion();
    versionNode.textContent = `v${version}`;
    versionNode.title = `ChatDock 版本 ${version}`;
  } catch (_error) {
    versionNode.textContent = "";
    versionNode.removeAttribute("title");
  }
}

function ensureClearSelectionButton() {
  const compactSide = document.querySelector(".compact-side");
  const manageButton = document.querySelector("#manage-sites");
  if (!compactSide || !manageButton) {
    return null;
  }

  let button = document.querySelector("#clear-selection");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.id = "clear-selection";
    button.className = "ghost-button compact-manage";
    button.textContent = "清空选择";
    button.addEventListener("click", async () => {
      await clearSelectedSites();
    });
    compactSide.insertBefore(button, manageButton);
  }

  return button;
}

function restoreTextButtons() {
  const reloadButton = document.querySelector("#reload");
  const relayoutButton = document.querySelector("#relayout");
  const clearButton = ensureClearSelectionButton();
  const manageButton = document.querySelector("#manage-sites");

  if (reloadButton) {
    reloadButton.classList.remove("icon-button");
    delete reloadButton.dataset.iconOnly;
    reloadButton.textContent = "刷新";
    reloadButton.title = "刷新所有已选 AI";
    reloadButton.setAttribute("aria-label", "刷新所有已选 AI");
  }

  if (relayoutButton) {
    relayoutButton.classList.remove("icon-button");
    delete relayoutButton.dataset.iconOnly;
    relayoutButton.textContent = "适配";
    relayoutButton.title = "刷新当前页面布局";
    relayoutButton.setAttribute("aria-label", "刷新当前页面布局");
  }

  if (clearButton) {
    clearButton.classList.remove("icon-button");
    delete clearButton.dataset.iconOnly;
    clearButton.textContent = "清空选择";
  }

  if (manageButton) {
    manageButton.classList.remove("icon-button");
    delete manageButton.dataset.iconOnly;
    manageButton.textContent = "编辑 AI";
    manageButton.title = "编辑 AI";
    manageButton.setAttribute("aria-label", "编辑 AI");
  }
}

function syncClearSelectionButton() {
  const button = ensureClearSelectionButton();
  if (!button) {
    return;
  }

  const selectedCount = state.workspace?.selectedSiteLabels.length || 0;
  button.disabled = selectedCount === 0;
  const hint = selectedCount === 0 ? "当前没有已选 AI" : "清空当前已选 AI";
  button.title = hint;
  button.setAttribute("aria-label", hint);
}

function createLayoutPresetId() {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function getSiteTitles(labels) {
  return labels
    .map((label) => getSiteMeta(label)?.title || label)
    .join("、");
}

function renderLayoutPresetSelect() {
  const trigger = document.querySelector("#layout-preset-select");
  const current = document.querySelector("#layout-preset-current");
  if (!trigger || !current || !state.layoutPresets) {
    return;
  }

  const activePreset = state.layoutPresets.items.find(
    (preset) => preset.id === state.layoutPresets.activePresetId,
  );
  current.textContent = activePreset?.name || "选择布局";
  trigger.title = activePreset ? `当前布局：${activePreset.name}` : "切换布局";
  void syncLayoutPresetDropdownState();
}

function renderLayoutPresets() {
  const container = document.querySelector("#layout-presets-list");
  if (!container || !state.layoutPresets) {
    return;
  }

  container.innerHTML = "";
  for (const preset of state.layoutPresets.items) {
    const item = document.createElement("article");
    item.className = `layout-preset-item${preset.id === state.layoutPresets.activePresetId ? " active" : ""}`;

    const main = document.createElement("div");
    main.className = "layout-preset-main";

    const title = document.createElement("input");
    title.className = "layout-preset-title layout-preset-name-input";
    title.value = preset.name;
    title.maxLength = 24;
    title.setAttribute("aria-label", `重命名布局 ${preset.name}`);
    title.addEventListener("change", () => renameLayoutPreset(preset.id, title.value));

    const labels = preset.snapshot?.selectedSiteLabels || [];
    const meta = document.createElement("div");
    meta.className = "layout-preset-meta";
    meta.textContent = labels.length ? `${labels.length} 个 AI：${getSiteTitles(labels)}` : "空白布局";

    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "layout-preset-actions";

    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.className = "mini-button";
    applyButton.textContent = preset.id === state.layoutPresets.activePresetId ? "当前" : "应用";
    applyButton.disabled = preset.id === state.layoutPresets.activePresetId;
    applyButton.addEventListener("click", async () => {
      await applyLayoutPreset(preset.id);
    });
    actions.appendChild(applyButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "mini-button";
    deleteButton.textContent = "删除";
    deleteButton.disabled = preset.builtin || state.layoutPresets.items.length <= 1;
    deleteButton.title = preset.builtin ? "内置布局不可删除" : "删除布局";
    deleteButton.addEventListener("click", async () => {
      await deleteLayoutPreset(preset.id);
    });
    actions.appendChild(deleteButton);

    item.append(main, actions);
    container.appendChild(item);
  }
}

function saveLayoutPresetAs(name) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    setStatus("请先输入布局名称。", "warn");
    return false;
  }

  const id = createLayoutPresetId();
  state.layoutPresets.items.push({
    id,
    name: trimmedName,
    builtin: false,
    snapshot: createDefaultLayoutPresets(getAllSiteLabels(), normalizePageLayouts).items[0].snapshot,
  });
  state.layoutPresets.activePresetId = id;
  state.layoutPresets = updateActivePresetSnapshot(
    state.layoutPresets,
    state.workspace,
    normalizePageLayouts,
  );
  persistLayoutPresets();
  renderLayoutPresetSelect();
  renderLayoutPresets();
  setStatus(`已保存布局：${trimmedName}`, "ok");
  return true;
}

function renameLayoutPreset(presetId, name) {
  const preset = state.layoutPresets?.items?.find((item) => item.id === presetId);
  if (!preset) {
    return;
  }

  const nextName = name?.trim();
  if (!nextName) {
    renderLayoutPresets();
    return;
  }

  preset.name = nextName.slice(0, 24);
  persistLayoutPresets();
  renderLayoutPresetSelect();
  renderLayoutPresets();
  setStatus(`布局已重命名为：${preset.name}`, "ok");
}

async function deleteLayoutPreset(presetId) {
  if (!state.layoutPresets || state.layoutPresets.items.length <= 1) {
    return;
  }

  const preset = state.layoutPresets.items.find((item) => item.id === presetId);
  if (!preset || preset.builtin) {
    return;
  }

  state.layoutPresets.items = state.layoutPresets.items.filter((item) => item.id !== presetId);
  if (state.layoutPresets.activePresetId === presetId) {
    state.layoutPresets.activePresetId = state.layoutPresets.items[0]?.id || null;
  }
  persistLayoutPresets();
  renderLayoutPresetSelect();
  renderLayoutPresets();
  setStatus(`已删除布局：${preset.name}`, "ok");

  if (state.layoutPresets.activePresetId && presetId === preset.id) {
    await applyLayoutPreset(state.layoutPresets.activePresetId);
  }
}

async function applyLayoutPreset(presetId) {
  const preset = state.layoutPresets?.items?.find((item) => item.id === presetId);
  if (!preset) {
    return;
  }

  const selectedSiteLabels = (preset.snapshot?.selectedSiteLabels || []).filter((label) =>
    state.workspace.visibleSiteLabels.includes(label),
  );
  const pageCount = getPageCount(selectedSiteLabels.length);

  state.layoutPresets.activePresetId = preset.id;
  state.workspace.selectedSiteLabels = selectedSiteLabels;
  state.workspace.activePageIndex = clamp(preset.snapshot?.activePageIndex || 0, 0, pageCount - 1);
  state.workspace.pageLayouts = normalizePageLayouts(preset.snapshot?.pageLayouts, pageCount);
  state.maximizedLabel = null;
  persistLayoutPresets();
  state.isApplyingLayoutPreset = true;
  try {
    persistWorkspace();
  } finally {
    state.isApplyingLayoutPreset = false;
  }

  renderWorkspace();
  renderLayoutPresetSelect();
  renderLayoutPresets();
  await refreshLayout();

  const skippedCount = (preset.snapshot?.selectedSiteLabels || []).length - selectedSiteLabels.length;
  const suffix = skippedCount > 0 ? `，${skippedCount} 个隐藏 AI 已跳过` : "";
  setStatus(`已应用布局：${preset.name}${suffix}`, skippedCount > 0 ? "warn" : "ok");
}

async function closeLayoutPresetMenu() {
  const shell = document.querySelector("#layout-preset-menu");
  shell?.setAttribute("hidden", "");
  await hideLayoutPresetMenuWebview();
}

function getLayoutPresetMenuMetrics() {
  const trigger = document.querySelector("#layout-preset-more");
  if (!trigger) {
    return null;
  }

  const padding = 8;
  const gap = 8;
  const triggerRect = trigger.getBoundingClientRect();
  const width = 168;
  const height = 84;
  const left = clamp(triggerRect.right - width, padding, Math.max(padding, window.innerWidth - width - padding));
  const top = clamp(triggerRect.bottom + gap, padding, Math.max(padding, window.innerHeight - height - padding));

  return {
    x: left,
    y: top,
    width,
    height,
  };
}

function positionLayoutPresetMenu() {
  void positionLayoutPresetMenuWebview();
}

function getLayoutPresetDropdownMetrics() {
  const trigger = document.querySelector("#layout-preset-select");
  if (!trigger || !state.layoutPresets) {
    return null;
  }

  const padding = 8;
  const gap = 8;
  const rowHeight = 38;
  const itemCount = Math.max(1, state.layoutPresets.items.length);
  const triggerRect = trigger.getBoundingClientRect();
  const width = Math.min(
    Math.max(triggerRect.width, 176),
    Math.max(176, window.innerWidth - padding * 2),
  );
  const height = Math.min(16 + itemCount * rowHeight + Math.max(0, itemCount - 1) * 4, 280);
  const left = clamp(triggerRect.left, padding, Math.max(padding, window.innerWidth - width - padding));
  const top = clamp(triggerRect.bottom + gap, padding, Math.max(padding, window.innerHeight - height - padding));

  return {
    x: left,
    y: top,
    width,
    height,
  };
}

async function toPhysicalMetrics(metrics) {
  if (!metrics) {
    return null;
  }

  const windowSize = await appWindow.innerSize();
  const scaleX = windowSize.width / window.innerWidth;
  const scaleY = windowSize.height / window.innerHeight;

  return {
    x: Math.round(metrics.x * scaleX),
    y: Math.round(metrics.y * scaleY),
    width: Math.round(metrics.width * scaleX),
    height: Math.round(metrics.height * scaleY),
  };
}

async function ensureLayoutPresetDropdownWebview() {
  let current = state.layoutPresetDropdownWebview || (await Webview.getByLabel(LAYOUT_PRESET_DROPDOWN_LABEL));
  const metrics = await toPhysicalMetrics(getLayoutPresetDropdownMetrics());

  if (!current) {
    new Webview(appWindow, LAYOUT_PRESET_DROPDOWN_LABEL, {
      url: LAYOUT_PRESET_DROPDOWN_ROUTE,
      x: metrics?.x ?? 0,
      y: metrics?.y ?? 0,
      width: metrics?.width ?? 180,
      height: metrics?.height ?? 96,
      transparent: true,
      focus: false,
      dragDropEnabled: false,
      zoomHotkeysEnabled: false,
      generalAutofillEnabled: false,
      devtools: false,
    });

    current = await waitForWebview(LAYOUT_PRESET_DROPDOWN_LABEL);
    await current.hide();
  }

  await current.setAutoResize(false);
  state.layoutPresetDropdownWebview = current;
  return current;
}

async function ensureLayoutPresetMenuWebview() {
  let current = state.layoutPresetMenuWebview || (await Webview.getByLabel(LAYOUT_PRESET_MENU_LABEL));
  const metrics = await toPhysicalMetrics(getLayoutPresetMenuMetrics());

  if (!current) {
    new Webview(appWindow, LAYOUT_PRESET_MENU_LABEL, {
      url: LAYOUT_PRESET_MENU_ROUTE,
      x: metrics?.x ?? 0,
      y: metrics?.y ?? 0,
      width: metrics?.width ?? 168,
      height: metrics?.height ?? 84,
      transparent: true,
      focus: false,
      dragDropEnabled: false,
      zoomHotkeysEnabled: false,
      generalAutofillEnabled: false,
      devtools: false,
    });

    current = await waitForWebview(LAYOUT_PRESET_MENU_LABEL);
    await current.hide();
  }

  await current.setAutoResize(false);
  state.layoutPresetMenuWebview = current;
  return current;
}

async function positionLayoutPresetDropdownWebview() {
  if (!isLayoutPresetDropdownOpen()) {
    return;
  }

  const current = await ensureLayoutPresetDropdownWebview();
  const metrics = await toPhysicalMetrics(getLayoutPresetDropdownMetrics());
  if (!metrics) {
    await hideLayoutPresetDropdownWebview();
    return;
  }

  await current.setPosition(new PhysicalPosition(metrics.x, metrics.y));
  await current.setSize(new PhysicalSize(metrics.width, metrics.height));
}

async function positionLayoutPresetMenuWebview() {
  if (!isLayoutPresetMenuOpen()) {
    return;
  }

  const current = await ensureLayoutPresetMenuWebview();
  const metrics = await toPhysicalMetrics(getLayoutPresetMenuMetrics());
  if (!metrics) {
    await hideLayoutPresetMenuWebview();
    return;
  }

  await current.setPosition(new PhysicalPosition(metrics.x, metrics.y));
  await current.setSize(new PhysicalSize(metrics.width, metrics.height));
}

async function syncLayoutPresetDropdownState() {
  if (!state.layoutPresetDropdownWebview && !isLayoutPresetDropdownOpen()) {
    return;
  }

  await ensureLayoutPresetDropdownWebview();
  await tauriEvent.emitTo(LAYOUT_PRESET_DROPDOWN_LABEL, "layout-preset-dropdown-state", {
    theme: state.theme,
    activePresetId: state.layoutPresets?.activePresetId || "",
    presets: (state.layoutPresets?.items || []).map((preset) => ({
      id: preset.id,
      name: preset.name,
    })),
  });
}

async function syncLayoutPresetMenuState() {
  if (!state.layoutPresetMenuWebview && !isLayoutPresetMenuOpen()) {
    return;
  }

  await ensureLayoutPresetMenuWebview();
  await tauriEvent.emitTo(LAYOUT_PRESET_MENU_LABEL, "layout-preset-menu-state", {
    theme: state.theme,
  });
}

async function hideLayoutPresetDropdownWebview() {
  const trigger = document.querySelector("#layout-preset-select");
  const current = state.layoutPresetDropdownWebview || (await Webview.getByLabel(LAYOUT_PRESET_DROPDOWN_LABEL));

  state.layoutPresetDropdown.open = false;
  trigger?.setAttribute("aria-expanded", "false");

  if (current) {
    state.layoutPresetDropdownWebview = current;
    await current.hide();
  }
}

async function hideLayoutPresetMenuWebview() {
  const current = state.layoutPresetMenuWebview || (await Webview.getByLabel(LAYOUT_PRESET_MENU_LABEL));

  state.layoutPresetMenu.open = false;

  if (current) {
    state.layoutPresetMenuWebview = current;
    await current.hide();
  }
}

async function showLayoutPresetDropdownWebview() {
  const trigger = document.querySelector("#layout-preset-select");
  if (!trigger || !state.layoutPresets) {
    return;
  }

  if (isTargetContextMenuOpen()) {
    closeTargetContextMenu();
  }
  if (isLayoutPresetMenuOpen()) {
    await closeLayoutPresetMenu();
  }

  state.layoutPresetDropdown.open = true;
  trigger.setAttribute("aria-expanded", "true");

  const current = await ensureLayoutPresetDropdownWebview();
  await positionLayoutPresetDropdownWebview();
  await syncLayoutPresetDropdownState();
  await current.show();
  await current.setFocus();
}

async function showLayoutPresetMenuWebview() {
  const trigger = document.querySelector("#layout-preset-more");
  if (!trigger) {
    return;
  }

  if (isTargetContextMenuOpen()) {
    closeTargetContextMenu();
  }
  if (isLayoutPresetDropdownOpen()) {
    await closeLayoutPresetDropdown();
  }

  state.layoutPresetMenu.open = true;

  const current = await ensureLayoutPresetMenuWebview();
  await positionLayoutPresetMenuWebview();
  await syncLayoutPresetMenuState();
  await current.show();
  await current.setFocus();
}

async function closeLayoutPresetDropdown() {
  await hideLayoutPresetDropdownWebview();
}

async function openLayoutPresetDropdown() {
  await showLayoutPresetDropdownWebview();
}

async function openLayoutPresetMenu() {
  const shell = document.querySelector("#layout-preset-menu");
  shell?.setAttribute("hidden", "");
  await showLayoutPresetMenuWebview();
}

function isLayoutPresetMenuOpen() {
  return state.layoutPresetMenu.open === true;
}

function isLayoutPresetDropdownOpen() {
  return state.layoutPresetDropdown.open === true;
}

async function runLayoutPresetMenuAction(action) {
  await closeLayoutPresetMenu();
  if (action === "save-as") {
    await openLayoutPresets();
    const input = document.querySelector("#layout-preset-name");
    input?.focus();
    input?.select?.();
    return;
  }

  if (action === "edit") {
    await openLayoutPresets();
  }
}

function setStatus(message, level = "muted") {
  const status = document.querySelector("#status");
  if (!status) {
    return;
  }
  status.dataset.level = level;
  status.textContent = message;
}

function logAttachmentDebug(stage, payload = {}) {
  console.info("[attachment-debug]", stage, payload);
}

function renderResults(results) {
  const list = document.querySelector("#results");
  if (!list) {
    return;
  }
  list.innerHTML = "";

  results.forEach((item) => {
    const row = document.createElement("li");
    row.className = item.ok ? "ok" : "fail";
    row.textContent = `${item.label}: ${item.message}`;
    list.appendChild(row);
  });
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolveTheme(themeMode = state.themeMode) {
  return themeMode === "system" ? getSystemTheme() : themeMode;
}

function applyTheme(themeMode = state.themeMode) {
  const resolvedTheme = resolveTheme(themeMode);
  state.themeMode = themeMode;
  state.theme = resolvedTheme;
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.style.colorScheme = resolvedTheme;

  const toggle = document.querySelector("#theme-toggle");
  const toggleLabel = document.querySelector("#theme-toggle-label");
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
  const themeText = themeMode === "system" ? "\u8ddf\u968f\u7cfb\u7edf" : resolvedTheme === "dark" ? "\u6697\u8272" : "\u4eae\u8272";

  if (toggle) {
    const themeHint = themeMode === "system"
      ? `当前跟随系统，点击切换到${nextTheme === "light" ? "亮色" : "暗色"}主题`
      : nextTheme === "light"
        ? "切换到亮色主题"
        : "切换到暗色主题";
    toggle.setAttribute("aria-label", themeHint);
    toggle.setAttribute("title", themeHint);
  }

  if (toggleLabel) {
    toggleLabel.textContent = themeText;
  }
}

function setTheme(themeMode) {
  applyTheme(themeMode);
  window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
}

function toggleTheme() {
  const nextTheme = state.theme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
}

function wireSystemThemeWatcher() {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  state.systemThemeMedia = media;
  const handleChange = async () => {
    if (state.themeMode !== "system") {
      return;
    }
    applyTheme("system");
    await refreshLayout(2);
  };

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", handleChange);
  } else if (typeof media.addListener === "function") {
    media.addListener(handleChange);
  }
}

function createIcon(kind) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");

  const segments =
    kind === "reload"
      ? ["M20 11a8 8 0 1 1-2.34-5.66", "M20 4v6h-6"]
      : kind === "layout"
        ? [
            "M12 3v18",
            "M3 12h18",
            "M3 7h18",
            "M3 17h18",
          ]
        : kind === "clear"
          ? [
              "M4 7h16",
              "M9 7V5.5h6V7",
              "M7 7l1 12h8l1-12",
              "M10 11v5",
              "M14 11v5",
            ]
          : kind === "edit"
            ? [
                "M4 20l4.2-1 9.3-9.3-3.2-3.2L5 15.8 4 20",
                "M13.6 5.4l3.2 3.2",
              ]
      : kind === "restore"
        ? [
            "M7 4.8H4.8V7",
            "M13 4.8h2.2V7",
            "M15.2 13v2.2H13",
            "M7 15.2H4.8V13",
            "M8.2 8.2h3.6v3.6H8.2z",
          ]
        : kind === "maximize"
          ? ["M7 4.8H4.8V7", "M13 4.8h2.2V7", "M15.2 13v2.2H13", "M7 15.2H4.8V13"]
          : ["M5.2 5.2l9.6 9.6", "M14.8 5.2l-9.6 9.6"];

  for (const segment of segments) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", segment);
    svg.appendChild(path);
  }

  return svg;
}

function createDot(accentColor) {
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.background = accentColor;
  return dot;
}

function createStatusDot(accentColor) {
  const dot = document.createElement("span");
  dot.className = "status-dot";
  dot.style.background = accentColor;
  return dot;
}

async function ensureSiteAvailability(targetLabels = state.workspace?.visibleSiteLabels || [], options = {}) {
  const labelsToProbe = getLabelsToProbe(
    targetLabels,
    state.siteMap,
    state.siteAvailability,
    state.pendingSiteAvailability,
    options,
  );

  if (!labelsToProbe.length) {
    return;
  }

  labelsToProbe.forEach((label) => {
    state.pendingSiteAvailability.add(label);
  });
  renderGlobalTargets();

  try {
    const results = await invoke("probe_site_availability", {
      targets: labelsToProbe,
      timeoutMs: SITE_PROBE_TIMEOUT_MS,
    });

    applyAvailabilityResults(labelsToProbe, results).forEach((result, label) => {
      const current = state.siteAvailability.get(label);
      if (current?.verifiedByWebview && current.available) {
        return;
      }
      state.siteAvailability.set(label, {
        ...result,
        checkedAt: Date.now(),
      });
    });
  } catch (_error) {
    applyAvailabilityResults(labelsToProbe, [], "\u4e0d\u53ef\u8bbf\u95ee").forEach((result, label) => {
      const current = state.siteAvailability.get(label);
      if (current?.verifiedByWebview && current.available) {
        return;
      }
      state.siteAvailability.set(label, {
        ...result,
        checkedAt: Date.now(),
      });
    });
  } finally {
    labelsToProbe.forEach((label) => {
      state.pendingSiteAvailability.delete(label);
    });
    persistSiteAvailability();
    renderGlobalTargets();
  }
}

function createDragHandle() {
  const handle = document.createElement("div");
  handle.className = "manager-drag-handle";
  handle.setAttribute("role", "button");
  handle.setAttribute("tabindex", "0");
  handle.setAttribute("aria-label", "拖动排序");
  handle.setAttribute("title", "拖动排序");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");

  const dots = [
    [5, 4],
    [5, 8],
    [5, 12],
    [11, 4],
    [11, 8],
    [11, 12],
  ];

  for (const [cx, cy] of dots) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", "1.2");
    svg.appendChild(circle);
  }

  handle.append(svg);
  return handle;
}

function createPanelShell(site) {
  const article = document.createElement("article");
  article.className = "panel-shell";
  article.dataset.panel = site.label;

  const body = document.createElement("div");
  body.className = "panel-body";
  body.dataset.webviewHost = site.label;

  article.append(body);
  return article;
}

function ensurePanelShells() {
  const layer = document.querySelector("#panel-layer");
  layer.innerHTML = "";

  for (const site of state.sites) {
    layer.appendChild(createPanelShell(site));
  }
}

function getPanelElement(label) {
  return document.querySelector(`.panel-shell[data-panel="${label}"]`);
}

function getHostElement(label) {
  return document.querySelector(`.panel-body[data-webview-host="${label}"]`);
}

function isPanelCurrentlyVisible(label) {
  const panel = getPanelElement(label);
  return Boolean(panel && !panel.hidden && paneMetrics(label));
}

function paneMetrics(label) {
  const panel = getPanelElement(label);
  const host = getHostElement(label);
  if (!panel || panel.hidden || !host || host.closest("[hidden]")) {
    return null;
  }

  const rect = panel.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top + PANEL_TOPBAR_HEIGHT,
    width: rect.width,
    height: Math.max(0, rect.height - PANEL_TOPBAR_HEIGHT),
  };
}

function panelToolbarMetrics(label) {
  const panel = getPanelElement(label);
  if (!panel || panel.hidden) {
    return null;
  }

  const rect = panel.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: PANEL_TOPBAR_HEIGHT,
  };
}

async function panePhysicalMetrics(label) {
  const metrics = paneMetrics(label);
  if (!metrics) {
    return null;
  }

  const windowSize = await appWindow.innerSize();
  const scaleX = windowSize.width / window.innerWidth;
  const scaleY = windowSize.height / window.innerHeight;

  return {
    x: Math.round(metrics.x * scaleX),
    y: Math.round(metrics.y * scaleY),
    width: Math.round(metrics.width * scaleX),
    height: Math.round(metrics.height * scaleY),
  };
}

async function toolbarPhysicalMetrics(label) {
  const metrics = panelToolbarMetrics(label);
  if (!metrics) {
    return null;
  }

  const windowSize = await appWindow.innerSize();
  const scaleX = windowSize.width / window.innerWidth;
  const scaleY = windowSize.height / window.innerHeight;

  return {
    x: Math.round(metrics.x * scaleX),
    y: Math.round(metrics.y * scaleY),
    width: Math.round(metrics.width * scaleX),
    height: Math.round(metrics.height * scaleY),
  };
}

async function waitForWebview(label, timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const current = await Webview.getByLabel(label);
    if (current) {
      return current;
    }
    await sleep(120);
  }
  throw new Error(`Timed out while creating webview: ${label}`);
}

function getToolbarLabel(siteLabel) {
  return `${siteLabel}-toolbar`;
}

function buildToolbarUrl(site) {
  const params = new URLSearchParams({
    site: site.label,
    title: site.title,
    accent: site.accentColor,
  });
  return `${PANEL_TOOLBAR_ROUTE}?${params.toString()}`;
}

async function waitForToolbarWebview(label, timeoutMs = 12000) {
  return waitForWebview(label, timeoutMs);
}

async function ensureToolbarWebview(siteLabel, shouldShow = true) {
  const site = getSiteMeta(siteLabel);
  if (!site) {
    return null;
  }

  const toolbarLabel = getToolbarLabel(siteLabel);
  if (state.pendingToolbarWebviews.has(toolbarLabel)) {
    const pending = state.pendingToolbarWebviews.get(toolbarLabel);
    const current = await pending;
    if (shouldShow) {
      await current.show();
    } else {
      await current.hide();
    }
    return current;
  }

  const createPromise = (async () => {
    let current = state.toolbarWebviews.get(toolbarLabel) || (await Webview.getByLabel(toolbarLabel));
    const metrics = await toolbarPhysicalMetrics(siteLabel);

    if (!current) {
      new Webview(appWindow, toolbarLabel, {
        url: buildToolbarUrl(site),
        x: metrics?.x ?? 0,
        y: metrics?.y ?? 0,
        width: metrics?.width ?? 1200,
        height: metrics?.height ?? PANEL_TOPBAR_HEIGHT,
        zoomHotkeysEnabled: false,
        generalAutofillEnabled: false,
        devtools: false,
      });

      current = await waitForToolbarWebview(toolbarLabel);
    }

    await current.setAutoResize(false);
    if (metrics) {
      await current.setPosition(new PhysicalPosition(metrics.x, metrics.y));
      await current.setSize(new PhysicalSize(metrics.width, metrics.height));
    }

    if (shouldShow && metrics) {
      await current.show();
    } else {
      await current.hide();
    }

    state.toolbarWebviews.set(toolbarLabel, current);
    return current;
  })();

  state.pendingToolbarWebviews.set(toolbarLabel, createPromise);
  try {
    return await createPromise;
  } finally {
    state.pendingToolbarWebviews.delete(toolbarLabel);
  }
}

async function ensureWebview(siteLabel, shouldShow = true) {
  const site = getSiteMeta(siteLabel);
  if (!site) {
    return null;
  }

  const shouldKeepVisible = shouldShow || isPanelCurrentlyVisible(siteLabel);

  if (state.pendingWebviews.has(siteLabel)) {
    const pending = state.pendingWebviews.get(siteLabel);
    const current = await pending;
    if (shouldKeepVisible) {
      await current.show();
    } else {
      await current.hide();
    }
    return current;
  }

  const createPromise = (async () => {
    let current = state.webviews.get(siteLabel) || (await Webview.getByLabel(siteLabel));
    const metrics = await panePhysicalMetrics(siteLabel);

    if (!current) {
      const webviewInstance = new Webview(appWindow, site.label, {
        url: site.url,
        x: metrics?.x ?? 0,
        y: metrics?.y ?? 0,
        width: metrics?.width ?? 1200,
        height: metrics?.height ?? 800,
        dataDirectory: site.dataDirectory,
        zoomHotkeysEnabled: false,
        generalAutofillEnabled: true,
        devtools: true,
      });

      webviewInstance.once("tauri://created", () => {
        syncSiteAvailability(site.label, true, "", { fromWebview: true });
      }).catch(() => {});

      webviewInstance.once("tauri://error", (event) => {
        const message = typeof event?.payload === "string" ? event.payload : "不可访问";
        syncSiteAvailability(site.label, false, message, { fromWebview: true });
      }).catch(() => {});

      current = await waitForWebview(siteLabel);
    }

    await current.setAutoResize(false);
    if (metrics) {
      await current.setPosition(new PhysicalPosition(metrics.x, metrics.y));
      await current.setSize(new PhysicalSize(metrics.width, metrics.height));
    }

    if (shouldKeepVisible && metrics) {
      await current.show();
    } else if (!shouldKeepVisible || !metrics) {
      await current.hide();
    }

    await ensureWebviewDropListener(siteLabel, current);
    state.webviews.set(siteLabel, current);
    return current;
  })();

  state.pendingWebviews.set(siteLabel, createPromise);
  try {
    return await createPromise;
  } finally {
    state.pendingWebviews.delete(siteLabel);
  }
}

async function ensureTargetsReady(targetLabels, shouldShow = false) {
  const uniqueLabels = [...new Set(targetLabels)].filter((label) => getSiteMeta(label));
  await Promise.all(uniqueLabels.map((label) => ensureWebview(label, shouldShow)));
}

async function ensureToolbarTargetsReady(targetLabels, shouldShow = false) {
  const uniqueLabels = [...new Set(targetLabels)].filter((label) => getSiteMeta(label));
  await Promise.all(uniqueLabels.map((label) => ensureToolbarWebview(label, shouldShow)));
}

async function relayoutWebviews() {
  const visibleTargets = new Set(getVisibleTargets());

  for (const site of state.sites) {
    const current = state.webviews.get(site.label) || (await Webview.getByLabel(site.label));
    if (!current) {
      continue;
    }

    const metrics = await panePhysicalMetrics(site.label);
    if (!metrics || !visibleTargets.has(site.label)) {
      await current.hide();
      continue;
    }

    await current.setPosition(new PhysicalPosition(metrics.x, metrics.y));
    await current.setSize(new PhysicalSize(metrics.width, metrics.height));
    await current.show();
  }
}

async function relayoutToolbarWebviews() {
  const visibleTargets = new Set(getVisibleTargets());

  for (const site of state.sites) {
    const toolbarLabel = getToolbarLabel(site.label);
    const current =
      state.toolbarWebviews.get(toolbarLabel) || (await Webview.getByLabel(toolbarLabel));
    if (!current) {
      continue;
    }

    const metrics = await toolbarPhysicalMetrics(site.label);
    if (!metrics || !visibleTargets.has(site.label)) {
      await current.hide();
      continue;
    }

    await current.setPosition(new PhysicalPosition(metrics.x, metrics.y));
    await current.setSize(new PhysicalSize(metrics.width, metrics.height));
    await current.show();
  }
}

async function settleLayout(passes = 3) {
  const version = ++state.relayoutVersion;
  const delays = [0, 120, 260];

  for (let index = 0; index < passes; index += 1) {
    const delay = delays[index] ?? 260;
    if (delay > 0) {
      await sleep(delay);
    }
    if (version !== state.relayoutVersion) {
      return;
    }
    await relayoutWebviews();
    await relayoutToolbarWebviews();
  }
}

async function syncVisibleWebviews() {
  const suppress = isAnyOverlayOpen();
  const visibleTargets = new Set(getVisibleTargets());

  for (const site of state.sites) {
    const current = state.webviews.get(site.label) || (await Webview.getByLabel(site.label));
    if (!current) {
      continue;
    }

    if (!suppress && visibleTargets.has(site.label) && !getPanelElement(site.label)?.hidden) {
      await current.show();
    } else {
      await current.hide();
    }
  }
}

async function syncVisibleToolbarWebviews() {
  const suppress = isAnyOverlayOpen();
  const visibleTargets = new Set(getVisibleTargets());

  for (const site of state.sites) {
    const toolbarLabel = getToolbarLabel(site.label);
    const current =
      state.toolbarWebviews.get(toolbarLabel) || (await Webview.getByLabel(toolbarLabel));
    if (!current) {
      continue;
    }

    if (!suppress && visibleTargets.has(site.label) && !getPanelElement(site.label)?.hidden) {
      await current.show();
    } else {
      await current.hide();
    }
  }
}

function syncPanelShellStates() {
  const pageLabels = getPageLabels();
  const maximizedLabel = getMaximizedTarget(pageLabels);

  for (const site of state.sites) {
    const panel = getPanelElement(site.label);
    if (!panel) {
      continue;
    }
    panel.classList.toggle("is-maximized", maximizedLabel === site.label);
  }
}

async function syncToolbarStates() {
  const pageLabels = getPageLabels();
  const maximizedLabel = getMaximizedTarget(pageLabels);

  for (const site of state.sites) {
    const toolbarLabel = getToolbarLabel(site.label);
    const current =
      state.toolbarWebviews.get(toolbarLabel) || (await Webview.getByLabel(toolbarLabel));
    if (!current) {
      continue;
    }

    state.toolbarWebviews.set(toolbarLabel, current);
    await tauriEvent.emitTo(toolbarLabel, "panel-toolbar-state", {
      site: site.label,
      title: site.title,
      accent: site.accentColor,
      theme: state.theme,
      maximized: maximizedLabel === site.label,
    });
  }
}

function getLayoutRects(labels) {
  const count = labels.length;
  const gap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--grid-gap")) || 2;
  const container = document.querySelector(".grid-preview");
  const { width, height } = container.getBoundingClientRect();
  const rects = new Map();
  const handles = [];
  const layout = currentLayoutState();

  if (count === 0) {
    return { rects, handles };
  }

  if (count === 1) {
    rects.set(labels[0], createRect(0, 0, width, height));
    return { rects, handles };
  }

  if (count === 2) {
    const split = clamp(layout.twoWaySplit, 0.2, 0.8);
    const leftWidth = Math.round(width * split - gap / 2);
    const rightX = leftWidth + gap;
    rects.set(labels[0], createRect(0, 0, leftWidth, height));
    rects.set(labels[1], createRect(rightX, 0, Math.max(0, width - rightX), height));
    handles.push({
      key: "two-way",
      axis: "x",
      x: Math.round(width * split),
      y: 0,
      width: 12,
      height,
    });
    return { rects, handles };
  }

  if (count === 3) {
    let [first, second] = layout.threeWaySplits;
    first = clamp(first, 0.18, 0.7);
    second = clamp(second, first + 0.12, 0.82);
    layout.threeWaySplits = [first, second];

    const x1 = Math.round(width * first);
    const x2 = Math.round(width * second);
    const leftWidth = Math.max(0, x1 - gap / 2);
    const centerX = x1 + gap / 2;
    const centerWidth = Math.max(0, x2 - x1 - gap);
    const rightX = x2 + gap / 2;
    const rightWidth = Math.max(0, width - rightX);

    rects.set(labels[0], createRect(0, 0, leftWidth, height));
    rects.set(labels[1], createRect(centerX, 0, centerWidth, height));
    rects.set(labels[2], createRect(rightX, 0, rightWidth, height));
    handles.push(
      { key: "three-way-left", axis: "x", x: x1, y: 0, width: 12, height },
      { key: "three-way-right", axis: "x", x: x2, y: 0, width: 12, height },
    );
    return { rects, handles };
  }

  const colSplit = clamp(layout.quadCols, 0.24, 0.76);
  const rowSplit = clamp(layout.quadRows, 0.24, 0.76);
  const splitX = Math.round(width * colSplit);
  const splitY = Math.round(height * rowSplit);
  const leftWidth = Math.max(0, splitX - gap / 2);
  const rightX = splitX + gap / 2;
  const rightWidth = Math.max(0, width - rightX);
  const topHeight = Math.max(0, splitY - gap / 2);
  const bottomY = splitY + gap / 2;
  const bottomHeight = Math.max(0, height - bottomY);

  rects.set(labels[0], createRect(0, 0, leftWidth, topHeight));
  rects.set(labels[1], createRect(rightX, 0, rightWidth, topHeight));
  rects.set(labels[2], createRect(0, bottomY, leftWidth, bottomHeight));
  rects.set(labels[3], createRect(rightX, bottomY, rightWidth, bottomHeight));
  handles.push(
    { key: "quad-cols", axis: "x", x: splitX, y: 0, width: 12, height },
    { key: "quad-rows", axis: "y", x: 0, y: splitY, width, height: 12 },
  );
  return { rects, handles };
}

function applyPanelRects(rects) {
  for (const site of state.sites) {
    const panel = getPanelElement(site.label);
    const rect = rects.get(site.label);
    if (!panel) {
      continue;
    }

    if (!rect) {
      panel.hidden = true;
      continue;
    }

    panel.hidden = false;
    panel.style.left = `${rect.x}px`;
    panel.style.top = `${rect.y}px`;
    panel.style.width = `${rect.width}px`;
    panel.style.height = `${rect.height}px`;
  }
}

function renderLayoutHandles(handles) {
  const layer = document.querySelector("#layout-handles");
  layer.innerHTML = "";

  for (const handle of handles) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "layout-handle";
    element.dataset.axis = handle.axis;
    element.dataset.key = handle.key;
    element.style.left = `${handle.x}px`;
    element.style.top = `${handle.y}px`;
    element.style.width = `${handle.width}px`;
    element.style.height = `${handle.height}px`;
    element.addEventListener("pointerdown", (event) => startHandleDrag(event, handle));
    layer.appendChild(element);
  }
}

function renderEmptyState() {
  const container = document.querySelector("#layout-empty");
  const visibleCount = getVisibleTargets().length;
  container.innerHTML = "";
  container.hidden = visibleCount !== 0;

  if (visibleCount !== 0) {
    return;
  }

  const card = document.createElement("div");
  card.className = "layout-empty-card";

  const preview = document.createElement("div");
  preview.className = "layout-empty-preview";

  const glow = document.createElement("div");
  glow.className = "layout-empty-preview-glow";

  const mark = document.createElement("div");
  mark.className = "layout-empty-mark brand-mark-frame";

  const logo = document.createElement("img");
  logo.className = "brand-mark-logo layout-empty-mark-logo";
  logo.src = "./assets/chatdock-logo.png";
  logo.alt = "ChatDock logo";

  mark.appendChild(logo);
  preview.append(glow, mark);

  const title = document.createElement("h2");
  title.textContent = TEXT.emptyTitle;

  const message = document.createElement("p");
  message.textContent = TEXT.emptyMessage;

  const steps = document.createElement("div");
  steps.className = "layout-empty-steps";

  [
    "勾选你想观察的 AI",
    "支持同时展示最多 4 个",
    "超过 4 个会自动分页",
  ].forEach((label, index) => {
    const item = document.createElement("div");
    item.className = "layout-empty-step";

    const badge = document.createElement("span");
    badge.className = "layout-empty-step-index";
    badge.textContent = String(index + 1);

    const text = document.createElement("span");
    text.className = "layout-empty-step-text";
    text.textContent = label;

    item.append(badge, text);
    steps.appendChild(item);
  });

  const hint = document.createElement("div");
  hint.className = "layout-empty-hint";
  hint.textContent = "从底部开始组装你的 AI 工作台";

  card.append(preview, title, message, steps, hint);
  container.append(card);
}

function applyLayout() {
  const visibleTargets = getVisibleTargets();
  renderEmptyState();
  const { rects, handles } = getLayoutRects(visibleTargets);
  applyPanelRects(rects);
  renderLayoutHandles(handles);
}

async function refreshLayout(passes = 3) {
  syncCompactBarHeight();
  if (!hasUsableGridSize()) {
    return;
  }
  applyLayout();
  if (isAnyOverlayOpen()) {
    await syncVisibleWebviews();
    await syncVisibleToolbarWebviews();
    if (isOnboardingOpen()) {
      renderOnboardingStep();
    }
    return;
  }
  await ensureTargetsReady(getVisibleTargets(), true);
  await ensureToolbarTargetsReady(getVisibleTargets(), true);
  await syncVisibleWebviews();
  await syncVisibleToolbarWebviews();
  await syncToolbarStates();
  await settleLayout(passes);
}

function clearScheduledLayoutRefreshes() {
  for (const timer of state.layoutRefreshTimers) {
    window.clearTimeout(timer);
  }
  state.layoutRefreshTimers = [];
}

function scheduleLayoutRefresh(reason = "layout", delays = [0, 80, 180, 320, 520]) {
  const token = ++state.layoutRefreshToken;
  clearScheduledLayoutRefreshes();

  state.layoutRefreshTimers = delays.map((delay) =>
    window.setTimeout(() => {
      if (token !== state.layoutRefreshToken) {
        return;
      }
      if (!hasUsableGridSize()) {
        return;
      }
      void refreshLayout(reason === "window-state" ? 4 : 3);
    }, delay),
  );
}

function updateLayoutStateFromDrag(handleKey, ratio) {
  const layout = currentLayoutState();

  if (handleKey === "two-way") {
    layout.twoWaySplit = clamp(ratio, 0.2, 0.8);
  }
  if (handleKey === "three-way-left") {
    const [, right] = layout.threeWaySplits;
    layout.threeWaySplits = [clamp(ratio, 0.18, right - 0.12), right];
  }
  if (handleKey === "three-way-right") {
    const [left] = layout.threeWaySplits;
    layout.threeWaySplits = [left, clamp(ratio, left + 0.12, 0.82)];
  }
  if (handleKey === "quad-cols") {
    layout.quadCols = clamp(ratio, 0.24, 0.76);
  }
  if (handleKey === "quad-rows") {
    layout.quadRows = clamp(ratio, 0.24, 0.76);
  }
}

function startHandleDrag(event, handle) {
  const preview = document.querySelector(".grid-preview");
  const bounds = preview.getBoundingClientRect();
  const element = event.currentTarget;
  preview.classList.add("dragging");
  element.classList.add("dragging");
  state.activeDrag = {
    key: handle.key,
    axis: handle.axis,
    bounds,
    element,
    preview,
  };
  element.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function stopHandleDrag(pointerId) {
  if (!state.activeDrag) {
    return;
  }

  state.activeDrag.element.releasePointerCapture?.(pointerId);
  state.activeDrag.element.classList.remove("dragging");
  state.activeDrag.preview.classList.remove("dragging");
  state.activeDrag = null;
  persistWorkspace();
  void refreshLayout(1);
}

function handlePointerMove(event) {
  if (!state.activeDrag) {
    return;
  }

  const { axis, bounds, key } = state.activeDrag;
  const ratio = axis === "x"
    ? (event.clientX - bounds.left) / bounds.width
    : (event.clientY - bounds.top) / bounds.height;

  updateLayoutStateFromDrag(key, ratio);
  applyLayout();
  void syncVisibleWebviews();
  void syncVisibleToolbarWebviews();
  void relayoutWebviews();
  void relayoutToolbarWebviews();
}

function renderPageTabs() {
  const container = document.querySelector("#page-tabs");
  const pageCount = getPageCount();
  const selectedCount = state.workspace.selectedSiteLabels.length;
  container.innerHTML = "";

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageLabels = getPageLabels(pageIndex);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `page-tab${pageIndex === state.workspace.activePageIndex ? " active" : ""}`;
    button.textContent = `第 ${pageIndex + 1} 页`;
    button.title = `${pageLabels.length || 0}/${MAX_SITES_PER_PAGE} 个 AI`;
    button.addEventListener("click", async () => {
      if (state.workspace.activePageIndex === pageIndex) {
        return;
      }
      state.workspace.activePageIndex = pageIndex;
      persistWorkspace();
      renderWorkspace();
      await refreshLayout();
    });
    container.appendChild(button);
  }

  const counter = document.createElement("span");
  counter.className = "page-counter";
  counter.textContent = `${TEXT.selectedPrefix} ${selectedCount}`;
  container.appendChild(counter);
}

function renderGlobalTargets() {
  const container = document.querySelector("#global-targets");
  const selected = new Set(state.workspace.selectedSiteLabels);
  container.innerHTML = "";

  for (const site of getVisibleManagedSites()) {
    const isSelected = selected.has(site.label);
    const selectedIndex = state.workspace.selectedSiteLabels.indexOf(site.label);
    const availability = getSiteAvailability(site.label);
    const isUnavailable = isSiteUnavailable(site.label);
    const pill = document.createElement("label");
    pill.className = `target-pill${isSelected ? " active" : ""}${isUnavailable ? " unavailable" : ""}`;
    pill.dataset.siteLabel = site.label;
    if (getContextMenuState().open && getContextMenuState().siteLabel === site.label) {
      pill.classList.add("context-open");
    }
    if (isUnavailable) {
      pill.title = availability?.message || "不可访问";
      pill.setAttribute("aria-label", `${site.title}，${availability?.message || "不可访问"}`);
    }

    pill.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openTargetContextMenu(site.label, event.clientX, event.clientY);
    });

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = isSelected;
    input.value = site.label;
    input.addEventListener("change", async () => {
      setSiteSelected(site.label, input.checked);
      renderWorkspace();
      await refreshLayout();
    });

    pill.append(input, createDot(site.accentColor));

    if (isSelected) {
      const order = document.createElement("span");
      order.className = "target-order";
      order.textContent = String(selectedIndex + 1);
      pill.append(order);
    }

    const text = document.createElement("span");
    text.textContent = site.title;
    pill.append(text);
    container.appendChild(pill);
  }

}

async function handlePanelAction(action, target) {
  const site = getSiteMeta(target);
  if (!site) {
    return;
  }

  if (action === "reload") {
    setStatus(`正在刷新 ${site.title}...`, "working");
    await ensureTargetsReady([target], false);
    const filtered = await reloadTargets([target]);
    renderResults(filtered);
    const okCount = filtered.filter((item) => item.ok).length;
    setStatus(
      `刷新完成：${okCount}/${filtered.length} 成功。`,
      okCount === filtered.length ? "ok" : "warn",
    );
    return;
  }

  if (action === "maximize") {
    state.maximizedLabel = isTargetMaximized(target) ? null : target;
    renderWorkspace();
    await refreshLayout();
    setStatus(
      state.maximizedLabel === target ? `${site.title} 已最大化显示。` : `${site.title} 已恢复原布局。`,
      "ok",
    );
    return;
  }

  if (action === "close") {
    state.maximizedLabel = state.maximizedLabel === target ? null : state.maximizedLabel;
    setSiteSelected(target, false);
    renderWorkspace();
    await refreshLayout();
    setStatus(`${site.title} 已关闭显示。`, "ok");
  }
}

function renderWorkspace() {
  persistWorkspace();
  persistSiteAvailability();
  syncClearSelectionButton();
  renderPageTabs();
  renderLayoutPresetSelect();
  renderGlobalTargets();
  renderSiteManager();
  initSortableTargets();
  syncCompactBarHeight();
  syncPanelShellStates();
  applyLayout();
  void ensureSiteAvailability(state.workspace.visibleSiteLabels);
}

function setSiteSelected(label, selected) {
  const nextState = toggleSiteSelection({
    label,
    selected,
    visibleSiteLabels: state.workspace.visibleSiteLabels,
    selectedSiteLabels: state.workspace.selectedSiteLabels,
    maximizedLabel: state.maximizedLabel,
    activePageIndex: state.workspace.activePageIndex,
    normalizePageLayouts,
    pageLayouts: state.workspace.pageLayouts,
  });

  if (!nextState) {
    return;
  }

  state.workspace.selectedSiteLabels = nextState.selectedSiteLabels;
  state.maximizedLabel = nextState.maximizedLabel;
  state.workspace.activePageIndex = nextState.activePageIndex;
  state.workspace.pageLayouts = nextState.pageLayouts;
  persistWorkspace();
}

function moveItem(array, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return [...array];
  }
  const next = [...array];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function reorderVisibleSites(sourceLabel, targetLabel) {
  const visible = [...state.workspace.visibleSiteLabels];
  const fromIndex = visible.indexOf(sourceLabel);
  const toIndex = visible.indexOf(targetLabel);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return false;
  }

  const reorderedVisible = moveItem(visible, fromIndex, toIndex);
  const hidden = state.workspace.siteOrder.filter((label) => !visible.includes(label));
  state.workspace.visibleSiteLabels = reorderedVisible;
  state.workspace.siteOrder = [...reorderedVisible, ...hidden];
  state.workspace.selectedSiteLabels = state.workspace.selectedSiteLabels
    .filter((label) => reorderedVisible.includes(label))
    .sort((left, right) => reorderedVisible.indexOf(left) - reorderedVisible.indexOf(right));
  persistWorkspace();
  return true;
}

function addVisibleSite(label) {
  if (state.workspace.visibleSiteLabels.includes(label)) {
    return;
  }
  state.workspace.visibleSiteLabels = [...state.workspace.visibleSiteLabels, label];
  state.workspace.siteOrder = sanitizeSiteOrder([
    ...state.workspace.siteOrder.filter((item) => item !== label),
    label,
  ]);
  persistWorkspace();
}

function removeVisibleSite(label) {
  state.workspace.visibleSiteLabels = state.workspace.visibleSiteLabels.filter((item) => item !== label);
  state.workspace.selectedSiteLabels = state.workspace.selectedSiteLabels.filter((item) => item !== label);
  if (state.maximizedLabel === label) {
    state.maximizedLabel = null;
  }
  persistWorkspace();
}

function isSiteManagerOpen() {
  const modal = document.querySelector("#site-manager");
  return Boolean(modal && !modal.hidden);
}

function isCloseConfirmOpen() {
  const modal = document.querySelector("#close-confirm");
  return Boolean(modal && !modal.hidden);
}

function isAboutDialogOpen() {
  const modal = document.querySelector("#about-dialog");
  return Boolean(modal && !modal.hidden);
}

function isLayoutPresetsOpen() {
  const modal = document.querySelector("#layout-presets");
  return Boolean(modal && !modal.hidden);
}

async function openSiteManager() {
  const modal = document.querySelector("#site-manager");
  if (!modal) {
    return;
  }
  modal.hidden = false;
  renderSiteManager();
  initSortableTargets();
  syncCompactBarHeight();
  await syncVisibleWebviews();
  await syncVisibleToolbarWebviews();
  await refreshLayout(1);
}

async function closeSiteManager() {
  const modal = document.querySelector("#site-manager");
  if (!modal) {
    return;
  }
  modal.hidden = true;
  await refreshLayout();
}

async function openLayoutPresets() {
  const modal = document.querySelector("#layout-presets");
  if (!modal) {
    return;
  }

  if (isSiteManagerOpen()) {
    await closeSiteManager();
  }

  if (isOnboardingOpen()) {
    await closeOnboarding(true);
  }

  if (isTargetContextMenuOpen()) {
    closeTargetContextMenu();
  }

  if (isLayoutPresetMenuOpen()) {
    void closeLayoutPresetMenu();
  }
  if (isLayoutPresetDropdownOpen()) {
    void closeLayoutPresetDropdown();
  }

  modal.hidden = false;
  renderLayoutPresets();
  syncCompactBarHeight();
  await syncVisibleWebviews();
  await syncVisibleToolbarWebviews();
  await refreshLayout(1);
}

async function closeLayoutPresets() {
  const modal = document.querySelector("#layout-presets");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  await refreshLayout();
}

async function openAboutDialog() {
  const modal = document.querySelector("#about-dialog");
  if (!modal) {
    return;
  }

  if (isSiteManagerOpen()) {
    await closeSiteManager();
  }

  if (isOnboardingOpen()) {
    await closeOnboarding(true);
  }

  if (isTargetContextMenuOpen()) {
    closeTargetContextMenu();
  }

  modal.hidden = false;
  await syncVisibleWebviews();
  await syncVisibleToolbarWebviews();

  const closeButton = document.querySelector("#close-about");
  window.requestAnimationFrame(() => {
    closeButton?.focus();
  });
}

async function closeAboutDialog() {
  const modal = document.querySelector("#about-dialog");
  if (!modal) {
    return;
  }

  modal.hidden = true;
  await refreshLayout();
}

async function showCloseConfirm() {
  const modal = document.querySelector("#close-confirm");
  if (!modal) {
    return true;
  }

  if (state.closeConfirm.open) {
    return new Promise((resolve) => {
      const previousResolver = state.closeConfirm.resolver;
      state.closeConfirm.resolver = (result) => {
        previousResolver?.(result);
        resolve(result);
      };
    });
  }

  if (isSiteManagerOpen()) {
    await closeSiteManager();
  }

  if (isOnboardingOpen()) {
    await closeOnboarding(true);
  }

  state.closeConfirm.open = true;
  modal.hidden = false;
  await syncVisibleWebviews();
  await syncVisibleToolbarWebviews();

  const acceptButton = document.querySelector("#accept-close-confirm");
  window.requestAnimationFrame(() => {
    acceptButton?.focus();
  });

  return new Promise((resolve) => {
    state.closeConfirm.resolver = resolve;
  });
}

async function resolveCloseConfirm(accepted) {
  const modal = document.querySelector("#close-confirm");
  if (!modal || !state.closeConfirm.open) {
    return;
  }

  modal.hidden = true;
  state.closeConfirm.open = false;
  const resolver = state.closeConfirm.resolver;
  state.closeConfirm.resolver = null;
  resolver?.(accepted);
  await refreshLayout();
}

function createManagerItem(site, visible) {
  const item = document.createElement("div");
  item.className = "manager-item";
  item.dataset.siteLabel = site.label;

  const main = document.createElement("div");
  main.className = "manager-item-main";
  main.append(createDot(site.accentColor));

  const meta = document.createElement("div");
  meta.className = "manager-item-meta";

  const title = document.createElement("span");
  title.className = "manager-item-title";
  title.textContent = site.title;

  const label = document.createElement("span");
  label.className = "manager-item-label";
  label.textContent = site.label;

  meta.append(title, label);
  main.append(meta);

  const actions = document.createElement("div");
  actions.className = "manager-actions";

  if (visible) {
    actions.append(createDragHandle());

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "mini-button";
    remove.textContent = "移除";
    remove.addEventListener("click", async () => {
      removeVisibleSite(site.label);
      renderWorkspace();
      await refreshLayout();
    });
    actions.append(remove);
  } else {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "mini-button";
    add.textContent = "添加";
    add.addEventListener("click", async () => {
      addVisibleSite(site.label);
      renderWorkspace();
      await refreshLayout();
    });
    actions.append(add);
  }

  item.append(main, actions);
  return item;
}

function renderSiteManager() {
  const visibleContainer = document.querySelector("#visible-sites");
  const hiddenContainer = document.querySelector("#hidden-sites");
  const visibleCount = document.querySelector("#visible-sites-count");
  const hiddenCount = document.querySelector("#hidden-sites-count");
  if (!visibleContainer || !hiddenContainer || !visibleCount || !hiddenCount) {
    return;
  }

  visibleContainer.innerHTML = "";
  hiddenContainer.innerHTML = "";

  const visibleSites = getVisibleManagedSites();
  const hiddenSites = getHiddenManagedSites();

  visibleCount.textContent = `${visibleSites.length} 个`;
  hiddenCount.textContent = `${hiddenSites.length} 个`;

  for (const site of visibleSites) {
    visibleContainer.appendChild(createManagerItem(site, true));
  }

  for (const site of hiddenSites) {
    hiddenContainer.appendChild(createManagerItem(site, false));
  }
}

function destroySortables() {
  for (const sortable of state.sortables) {
    sortable.destroy();
  }
  state.sortables = [];
}

function syncVisibleSitesFromDom(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) {
    return false;
  }
  const reorderedVisible = [...container.querySelectorAll("[data-site-label]")]
    .map((node) => node.dataset.siteLabel)
    .filter(Boolean);
  if (!reorderedVisible.length) {
    return false;
  }

  const currentVisible = [...state.workspace.visibleSiteLabels];
  const changed = reorderedVisible.length === currentVisible.length
    && reorderedVisible.some((label, index) => currentVisible[index] !== label);
  if (!changed) {
    return false;
  }

  const hidden = state.workspace.siteOrder.filter((label) => !reorderedVisible.includes(label));
  state.workspace.visibleSiteLabels = reorderedVisible;
  state.workspace.siteOrder = [...reorderedVisible, ...hidden];
  state.workspace.selectedSiteLabels = state.workspace.selectedSiteLabels
    .filter((label) => reorderedVisible.includes(label))
    .sort((left, right) => reorderedVisible.indexOf(left) - reorderedVisible.indexOf(right));
  persistWorkspace();
  return true;
}

function initSortableTargets() {
  destroySortables();

  const bar = document.querySelector("#global-targets");
  if (bar) {
    state.sortables.push(
      Sortable.create(bar, {
        animation: 180,
        delay: 220,
        delayOnTouchOnly: false,
        ghostClass: "drag-ghost",
        chosenClass: "drag-chosen",
        dragClass: "drag-active",
        draggable: ".target-pill",
        filter: "input, button",
        preventOnFilter: false,
        forceFallback: true,
        fallbackTolerance: 4,
        fallbackOnBody: true,
        onEnd: async () => {
          if (syncVisibleSitesFromDom("#global-targets")) {
            renderWorkspace();
            await refreshLayout();
          } else {
            renderWorkspace();
          }
        },
      }),
    );
  }

  const manager = document.querySelector("#visible-sites");
  if (manager) {
    state.sortables.push(
      Sortable.create(manager, {
        animation: 180,
        delay: 0,
        delayOnTouchOnly: false,
        ghostClass: "drag-ghost",
        chosenClass: "drag-chosen",
        dragClass: "drag-active",
        draggable: ".manager-item",
        handle: ".manager-drag-handle",
        filter: ".mini-button",
        preventOnFilter: false,
        forceFallback: true,
        forceAutoScrollFallback: true,
        fallbackTolerance: 4,
        fallbackOnBody: true,
        scroll: true,
        bubbleScroll: true,
        scrollSensitivity: 80,
        scrollSpeed: 14,
        onEnd: async () => {
          if (syncVisibleSitesFromDom("#visible-sites")) {
            renderWorkspace();
            await refreshLayout();
          } else {
            renderWorkspace();
          }
        },
      }),
    );
  }
}

async function reloadTargets(targets) {
  await ensureTargetsReady(targets, false);
  await sleep(380);
  try {
    const results = await invoke("reload_webviews", { targets });
    return results.filter((item) => targets.includes(item.label));
  } finally {
    await refreshLayout();
  }
}

async function sendPrompt() {
  const promptField = document.querySelector("#prompt");
  const prompt = promptField.value.trim();
  const attachments = serializeComposerAttachments();
  if (!prompt && attachments.length === 0) {
    setStatus("发送前请先输入问题或添加附件。", "warn");
    return;
  }

  const targets = [...state.workspace.selectedSiteLabels];
  if (!targets.length) {
    setStatus("请先选择至少一个 AI。", "warn");
    return;
  }

  const attachmentSuffix = attachments.length ? `，附带 ${attachments.length} 个附件` : "";
  setStatus(`正在向 ${targets.length} 个 AI 发送内容${attachmentSuffix}...`, "working");
  await ensureTargetsReady(targets, false);
  await sleep(380);
  try {
    const results = await invoke("broadcast_prompt", { prompt, targets, attachments });
    renderResults(results);
    const okCount = results.filter((item) => item.ok).length;
    setStatus(
      `发送完成：${okCount}/${results.length} 成功。`,
      okCount === results.length ? "ok" : "warn",
    );
  } catch (error) {
    console.error(error);
    setStatus(`发送失败：${error}`, "fail");
  } finally {
    promptField.value = "";
    clearComposerAttachments();
    autosizePrompt();
    await refreshLayout();
  }
}

async function reloadAll() {
  const targets = [...state.workspace.selectedSiteLabels];
  if (!targets.length) {
    setStatus("请先选择至少一个 AI。", "warn");
    return;
  }

  setStatus(`正在刷新 ${targets.length} 个 AI...`, "working");
  const results = await reloadTargets(targets);
  renderResults(results);
  const okCount = results.filter((item) => item.ok).length;
  setStatus(
    `刷新完成：${okCount}/${results.length} 成功。`,
    okCount === results.length ? "ok" : "warn",
  );
}

function wireThemeToggle() {
  applyTheme(state.themeMode);
  wireSystemThemeWatcher();
  document.querySelector("#theme-toggle").addEventListener("click", async () => {
    toggleTheme();
    await refreshLayout(2);
  });
}

function wireLayoutDragging() {
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", (event) => {
    stopHandleDrag(event.pointerId);
  });
  window.addEventListener("pointercancel", (event) => {
    stopHandleDrag(event.pointerId);
  });
  window.addEventListener("pointerdown", (event) => {
    if (isTargetContextMenuOpen()) {
      const shell = document.querySelector("#target-context-menu");
      if (!shell?.contains(event.target)) {
        closeTargetContextMenu();
      }
    }

    if (isLayoutPresetMenuOpen()) {
      const trigger = document.querySelector("#layout-preset-more");
      if (!trigger?.contains(event.target)) {
        void closeLayoutPresetMenu();
      }
    }

    if (isLayoutPresetDropdownOpen()) {
      const trigger = document.querySelector("#layout-preset-select");
      if (!trigger?.contains(event.target)) {
        void closeLayoutPresetDropdown();
      }
    }
  });
}

function wireResponsiveRelayout() {
  const grid = document.querySelector(".grid-preview");
  if (typeof ResizeObserver === "function" && grid) {
    state.resizeObserver?.disconnect?.();
    state.resizeObserver = new ResizeObserver(() => {
      scheduleLayoutRefresh("container-resize", [0, 90, 220, 420]);
    });
    state.resizeObserver.observe(grid);
  }

  const compactBar = document.querySelector(".compact-bar");
  if (typeof ResizeObserver === "function" && compactBar) {
    state.compactBarObserver?.disconnect?.();
    state.compactBarObserver = new ResizeObserver(() => {
      if (syncCompactBarHeight()) {
        scheduleLayoutRefresh("compact-bar-resize", [0, 90, 220, 420]);
      }
    });
    state.compactBarObserver.observe(compactBar);
  }

  window.addEventListener("resize", () => {
    scheduleLayoutRefresh("window-resize", [0, 100, 240, 420]);
    if (isOnboardingOpen()) {
      renderOnboardingStep();
    }
    if (isTargetContextMenuOpen()) {
      positionTargetContextMenu();
    }
    if (isLayoutPresetMenuOpen()) {
      void positionLayoutPresetMenuWebview();
    }
    if (isLayoutPresetDropdownOpen()) {
      void positionLayoutPresetDropdownWebview();
    }
  });
}

async function fetchSites() {
  const sites = await invoke("list_sites");
  state.sites = sites;
  state.siteMap = new Map(sites.map((site) => [site.label, site]));
  state.siteAvailability = new Map(
    [...loadSiteAvailability().entries()].filter(([label]) => state.siteMap.has(label)),
  );
}

function wireCloseConfirmation() {
  return appWindow.onCloseRequested(async (event) => {
    await handleCloseRequest({
      event,
      showCloseConfirm,
      destroyWindow: () => appWindow.destroy(),
      setStatus,
      onError: console.error,
    });
  });
}

async function clearSelectedSites() {
  if (!state.workspace?.selectedSiteLabels.length) {
    return;
  }

  const nextState = clearSelectionState(state.workspace.pageLayouts, normalizePageLayouts);
  state.workspace.selectedSiteLabels = nextState.selectedSiteLabels;
  state.workspace.activePageIndex = nextState.activePageIndex;
  state.workspace.pageLayouts = nextState.pageLayouts;
  state.maximizedLabel = nextState.maximizedLabel;
  persistWorkspace();
  renderWorkspace();
  await refreshLayout();
  setStatus("已清空当前选择。", "ok");
}

async function boot() {
  if (!window.__TAURI__) {
    throw new Error("window.__TAURI__ is not available");
  }

  setStatus("\u6b63\u5728\u52a0\u8f7d AI \u5217\u8868...", "working");
  await fetchSites();
  state.onboarding.completed = loadOnboardingCompleted();
  state.workspace = loadWorkspace();
  state.workspace = sanitizeWorkspace(state.workspace);
  state.layoutPresets = loadLayoutPresets();
  persistWorkspace();
  syncCompactBarHeight();

  ensurePanelShells();
  await renderAppVersion();
  renderWorkspace();

  await tauriEvent.listen("panel-toolbar-action", async ({ payload }) => {
    const { action, site } = payload || {};
    if (!action || !site) {
      return;
    }
    await handlePanelAction(action, site);
  });

  await tauriEvent.listen("layout-preset-dropdown-action", async ({ payload }) => {
    if (payload?.action === "close") {
      await closeLayoutPresetDropdown();
      return;
    }

    if (payload?.action !== "apply" || !payload?.presetId) {
      return;
    }

    await closeLayoutPresetDropdown();
    await applyLayoutPreset(payload.presetId);
  });

  await tauriEvent.listen("layout-preset-menu-action", async ({ payload }) => {
    if (payload?.action === "close") {
      await closeLayoutPresetMenu();
      return;
    }

    await runLayoutPresetMenuAction(payload?.action);
  });

  await tauriEvent.listen(SITE_AVAILABILITY_SYNC_EVENT, ({ payload }) => {
    const label = payload?.label;
    if (!label) {
      return;
    }
    syncSiteAvailability(label, payload.available !== false, payload.message || "", { fromWebview: true });
  });

  await tauriEvent.listen(ATTACHMENT_DEBUG_EVENT, ({ payload }) => {
    logAttachmentDebug("backend-event", payload || {});
  });

  await appWindow.onDragDropEvent(async (event) => {
    console.info("[drag-debug][tauri]", event.payload);
    const dropTargetLabel = findPanelDropTarget(event.payload?.position);
    setPanelDropTarget(dropTargetLabel);
    logAttachmentDebug("tauri-drag:event", {
      type: event.payload?.type,
      position: event.payload?.position,
      paths: event.payload?.paths || [],
      dropTargetLabel,
    });

    if (event.payload?.type === "enter" || event.payload?.type === "over") {
      if (dropTargetLabel) {
        setPromptDropActive(false);
      } else {
        setPromptDropActive(true);
      }
      return;
    }

    if (event.payload?.type === "leave") {
      clearDragVisualState();
      return;
    }

    if (event.payload?.type !== "drop") {
      return;
    }

    clearDragVisualState();
    try {
      if (dropTargetLabel) {
        logAttachmentDebug("tauri-drag:panel-route", {
          dropTargetLabel,
          pathCount: (event.payload?.paths || []).length,
        });
        const result = await injectAttachmentsIntoPanel(dropTargetLabel, event.payload.paths || []);
        if (result?.ok) {
          const site = getSiteMeta(dropTargetLabel);
          setStatus(`已将附件注入 ${site?.title || dropTargetLabel} 面板。`, "ok");
        } else {
          setStatus(`注入附件失败：${result?.message || "未知错误"}`, "fail");
        }
        return;
      }

      logAttachmentDebug("tauri-drag:composer-route", {
        pathCount: (event.payload?.paths || []).length,
      });
      const count = await appendComposerPaths(event.payload.paths || []);
      if (count > 0) {
        setStatus(`已拖入 ${count} 个附件。`, "ok");
      }
    } catch (error) {
      console.error(error);
      setStatus(`添加附件失败：${error}`, "fail");
    }
  });

  void ensureSiteAvailability(state.workspace.visibleSiteLabels, { force: true });

  await refreshLayout();
  setStatus("\u9996\u6b21\u767b\u5f55\u5404 AI \u540e\uff0c\u540e\u7eed\u4f1a\u590d\u7528\u672c\u5730\u4f1a\u8bdd\u3002", "muted");

  document.querySelector("#prompt-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendPrompt();
  });

  const promptField = document.querySelector("#prompt");
  autosizePrompt();
  wirePromptAttachments();
  promptField.addEventListener("input", () => {
    autosizePrompt();
    scheduleLayoutRefresh("prompt-input", [0, 60, 180]);
  });

  promptField.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await sendPrompt();
    }
  });

  document.querySelector("#reload").addEventListener("click", reloadAll);
  document.querySelector("#relayout").addEventListener("click", async () => {
    await refreshLayout();
    setStatus("\u5e03\u5c40\u5df2\u91cd\u65b0\u8ba1\u7b97\u3002", "ok");
  });
  document.querySelector("#open-onboarding").addEventListener("click", async () => {
    await openOnboarding(true);
  });
  document.querySelector("#layout-preset-select").addEventListener("click", async () => {
    if (isLayoutPresetDropdownOpen()) {
      await closeLayoutPresetDropdown();
      return;
    }
    await openLayoutPresetDropdown();
  });
  document.querySelector("#layout-preset-more").addEventListener("click", async () => {
    if (isLayoutPresetMenuOpen()) {
      await closeLayoutPresetMenu();
      return;
    }
    await openLayoutPresetMenu();
  });
  document.querySelector("#open-about").addEventListener("click", async () => {
    await openAboutDialog();
  });
  document.querySelector("#manage-sites").addEventListener("click", async () => {
    await openSiteManager();
  });
  document.querySelector("#close-about").addEventListener("click", async () => {
    await closeAboutDialog();
  });
  document.querySelector("#about-dialog").addEventListener("click", async (event) => {
    if (event.target?.dataset?.closeAboutBackdrop === "true") {
      await closeAboutDialog();
    }
  });
  document.querySelector("#close-site-manager").addEventListener("click", async () => {
    await closeSiteManager();
  });
  document.querySelector("#site-manager").addEventListener("click", async (event) => {
    if (event.target?.dataset?.closeSiteManager === "true") {
      await closeSiteManager();
    }
  });
  document.querySelector("#close-layout-presets").addEventListener("click", async () => {
    await closeLayoutPresets();
  });
  document.querySelector("#layout-presets").addEventListener("click", async (event) => {
    if (event.target?.dataset?.closeLayoutPresets === "true") {
      await closeLayoutPresets();
    }
  });
  document.querySelector("#layout-preset-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#layout-preset-name");
    if (saveLayoutPresetAs(input.value)) {
      input.value = "";
    }
  });
  document.querySelector("#layout-preset-menu").addEventListener("click", async (event) => {
    if (event.target?.dataset?.closeLayoutPresetMenu === "true") {
      await closeLayoutPresetMenu();
      return;
    }

    const action = event.target?.dataset?.layoutPresetAction;
    if (!action) {
      return;
    }

    await runLayoutPresetMenuAction(action);
  });
  document.querySelector("#target-context-menu").addEventListener("click", async (event) => {
    if (event.target?.dataset?.closeTargetContextMenu === "true") {
      closeTargetContextMenu();
      return;
    }

    const action = event.target?.dataset?.contextAction;
    const siteLabel = state.targetContextMenu.siteLabel;
    if (!action || !siteLabel) {
      return;
    }

    closeTargetContextMenu();
    await runTargetContextAction(action, siteLabel);
  });
  document.querySelector("#cancel-close-confirm").addEventListener("click", async () => {
    await resolveCloseConfirm(false);
  });
  document.querySelector("#accept-close-confirm").addEventListener("click", async () => {
    await resolveCloseConfirm(true);
  });
  document.querySelector("#close-confirm").addEventListener("click", async (event) => {
    if (event.target?.dataset?.closeConfirmBackdrop === "true") {
      await resolveCloseConfirm(false);
    }
  });
  document.querySelector("#tour-prev").addEventListener("click", async () => {
    await stepOnboarding(-1);
  });
  document.querySelector("#tour-next").addEventListener("click", async () => {
    if (state.onboarding.stepIndex >= ONBOARDING_STEPS.length - 1) {
      await closeOnboarding(true);
      return;
    }
    await stepOnboarding(1);
  });
  document.querySelector("#tour-skip").addEventListener("click", async () => {
    await closeOnboarding(true);
  });
  window.addEventListener("keydown", async (event) => {
    if (event.key === "Escape" && isTargetContextMenuOpen()) {
      event.preventDefault();
      closeTargetContextMenu();
      return;
    }
    if (event.key === "Escape" && isCloseConfirmOpen()) {
      event.preventDefault();
      await resolveCloseConfirm(false);
      return;
    }
    if (event.key === "Escape" && isAboutDialogOpen()) {
      event.preventDefault();
      await closeAboutDialog();
      return;
    }
    if (event.key === "Escape" && isSiteManagerOpen()) {
      await closeSiteManager();
    }
    if (event.key === "Escape" && isOnboardingOpen()) {
      await closeOnboarding(true);
    }
    if (isOnboardingOpen() && event.key === "ArrowRight") {
      event.preventDefault();
      if (state.onboarding.stepIndex >= ONBOARDING_STEPS.length - 1) {
        await closeOnboarding(true);
      } else {
        await stepOnboarding(1);
      }
    }
    if (isOnboardingOpen() && event.key === "ArrowLeft") {
      event.preventDefault();
      await stepOnboarding(-1);
    }
  });

  wireThemeToggle();
  restoreTextButtons();
  syncClearSelectionButton();
  wireLayoutDragging();
  wireResponsiveRelayout();
  await wireCloseConfirmation();

  await appWindow.onResized(() => {
    scheduleLayoutRefresh("window-state", [0, 120, 260, 460, 720]);
    if (isLayoutPresetMenuOpen()) {
      void positionLayoutPresetMenuWebview();
    }
    if (isLayoutPresetDropdownOpen()) {
      void positionLayoutPresetDropdownWebview();
    }
  });

  await appWindow.onScaleChanged(() => {
    scheduleLayoutRefresh("scale-change", [0, 120, 260, 460, 720]);
    if (isLayoutPresetMenuOpen()) {
      void positionLayoutPresetMenuWebview();
    }
    if (isLayoutPresetDropdownOpen()) {
      void positionLayoutPresetDropdownWebview();
    }
  });

  await appWindow.onFocusChanged(({ payload: focused }) => {
    if (focused) {
      scheduleLayoutRefresh("focus-return", [0, 120, 260]);
      if (isLayoutPresetMenuOpen()) {
        void positionLayoutPresetMenuWebview();
      }
      if (isLayoutPresetDropdownOpen()) {
        void positionLayoutPresetDropdownWebview();
      }
    }
  });

  if (!state.onboarding.completed) {
    await openOnboarding(true);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  boot().catch((error) => {
    console.error(error);
    setStatus(`启动失败：${error}`, "fail");
  });
});
