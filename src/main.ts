// @ts-nocheck
import Sortable from "./vendor/sortable.esm.js";
import { mountVueApp } from "./app/bootstrap";
import { useWorkspaceStore } from "./app/stores/workspace";
import { handleCloseRequest, hasBlockingOverlay } from "./close-confirm.js";
import {
  dataUrlToBase64 as composerDataUrlToBase64,
  formatAttachmentSize as formatComposerAttachmentSize,
  guessMimeTypeFromName as guessComposerMimeTypeFromName,
  isImageType as isComposerImageType,
  normalizeAttachment as normalizeComposerAttachment,
  pathToAttachment as pathToComposerAttachment,
  readFileAsDataUrl as readComposerFileAsDataUrl,
  serializeAttachments as serializeComposerAttachmentPayloads,
  uniqueAttachments as uniqueComposerAttachments,
} from "./features/composer/attachments";
import { renderComposerAttachmentList } from "./features/composer/composer-dom";
import { wirePromptAttachments as wireComposerPromptAttachments } from "./features/composer/composer-events";
import { createLayoutPresetController } from "./features/layout-presets/layout-presets-controller";
import { createLayoutPresetOverlayController } from "./features/layout-presets/layout-preset-overlays";
import {
  focusElementOnNextFrame,
  hideModalElement,
  isModalElementOpen,
  showModalElement,
} from "./features/dialogs/dialogs-dom";
import { createStandardDialogsController } from "./features/dialogs/dialogs-controller";
import { createCloseConfirmController } from "./features/dialogs/close-confirm-controller";
import {
  createManagerItem as createSiteManagerItem,
  renderSiteManagerLists,
} from "./features/site-manager/site-manager-dom";
import {
  addVisibleSiteToWorkspace,
  removeVisibleSiteFromWorkspace,
  reorderVisibleSitesInWorkspace,
  syncVisibleSiteOrder,
} from "./features/site-manager/site-manager-state";
import {
  renderPageTabs as renderPageTabsDom,
  renderTargetBar,
} from "./features/site-manager/target-bar-dom";
import { createSiteManagerController } from "./features/site-manager/site-manager-controller";
import { createTargetContextMenuController } from "./features/site-manager/target-context-menu";
import {
  createOnboardingController,
} from "./features/onboarding/onboarding";
import { wireAppDomEvents } from "./features/app-events";
import {
  getPanelLayoutRects,
  updateLayoutFromHandleDrag,
} from "./features/panels/panel-layout";
import {
  renderEmptyPanelState,
  renderLayoutHandles as renderPanelLayoutHandles,
} from "./features/panels/panels-dom";
import { wireResponsiveRelayout as wirePanelResponsiveRelayout } from "./features/panels/responsive-relayout";
import { createLayoutRefreshController } from "./features/panels/layout-refresh-controller";
import {
  createDot as createUiDot,
  createDragHandle as createUiDragHandle,
  createIcon as createUiIcon,
  createStatusDot as createUiStatusDot,
} from "./features/ui-elements";
import { applyThemeToDocument, resolveThemeMode } from "./features/theme";
import {
  getPaneMetricsFromRect,
  getToolbarMetricsFromRect,
  renderPanelShells,
} from "./features/panels/panel-shells";
import {
  getDropdownMetricsFromRect,
  getMenuMetricsFromRect,
} from "./features/layout-presets/layout-presets-metrics";
import {
  clamp,
  cssToPhysicalMetrics,
  physicalToViewportPosition,
} from "./geometry.js";
import {
  DEFAULT_LAYOUT_STATE,
  MAX_SITES_PER_PAGE,
  cloneLayout as cloneWorkspaceLayout,
  createDefaultWorkspace as createWorkspace,
  getPageCount as getWorkspacePageCount,
  migrateLegacyWorkspace as migrateLegacyWorkspaceState,
  normalizePageLayouts as normalizeWorkspacePageLayouts,
  sanitizeSiteOrder as sanitizeWorkspaceSiteOrder,
  sanitizeVisibleSiteLabels as sanitizeWorkspaceVisibleSiteLabels,
  sanitizeWorkspace as sanitizeWorkspaceState,
} from "./state/workspace";
import {
  buildPanelToolbarState,
  buildPanelWebviewOptions,
  buildToolbarWebviewOptions,
  buildToolbarUrl as buildToolbarWebviewUrl,
  createPanelWebviewController,
  getToolbarLabel as getToolbarWebviewLabel,
  shouldKeepWebviewVisible,
} from "./tauri/webview-panels";
import {
  buildLayoutPresetDropdownState,
  buildLayoutPresetMenuState,
  createOverlayWebviewController,
} from "./tauri/overlay-webviews";
import { wireTauriAppEvents } from "./tauri/app-events";
import { wireWindowLayoutEvents } from "./tauri/window-events";
import {
  loadSiteAvailability as loadSiteAvailabilityState,
  persistSiteAvailability as persistSiteAvailabilityState,
} from "./state/availability.ts";
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
let workspaceStore = null;
let onboardingController = null;
let layoutPresetController = null;
let layoutPresetOverlayController = null;
let targetContextMenuController = null;
let standardDialogsController = null;
let siteManagerController = null;
let closeConfirmController = null;
let layoutRefreshController = null;
const THEME_STORAGE_KEY = "ai-compare-theme";
const WORKSPACE_STORAGE_KEY = "ai-compare-workspace-v2";
const LEGACY_WORKSPACE_STORAGE_KEY = "ai-compare-workspace-v1";
const LAYOUT_PRESETS_STORAGE_KEY = "chatdock-layout-presets-v1";
const ONBOARDING_STORAGE_KEY = "chatdock-onboarding-v1";
const SITE_AVAILABILITY_STORAGE_KEY = "chatdock-site-availability-v1";
const PANEL_TOPBAR_HEIGHT = 34;
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

function cloneLayout(layout) {
  return cloneWorkspaceLayout(layout);
}

function createDefaultWorkspace() {
  return createWorkspace(getAllSiteLabels());
}

function getAllSiteLabels() {
  return state.sites.map((site) => site.label);
}

function getPageCount(selectedCount = state.workspace?.selectedSiteLabels.length || 0) {
  return getWorkspacePageCount(selectedCount);
}

function normalizePageLayouts(rawLayouts, pageCount) {
  return normalizeWorkspacePageLayouts(rawLayouts, pageCount);
}

function migrateLegacyWorkspace(rawWorkspace) {
  return migrateLegacyWorkspaceState(rawWorkspace, getAllSiteLabels());
}

function sanitizeWorkspace(rawWorkspace) {
  return sanitizeWorkspaceState(rawWorkspace, getAllSiteLabels());
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
  return sanitizeWorkspaceSiteOrder(order, getAllSiteLabels());
}

function sanitizeVisibleSiteLabels(visibleLabels, siteOrder = state.workspace?.siteOrder || getAllSiteLabels()) {
  return sanitizeWorkspaceVisibleSiteLabels(visibleLabels, siteOrder, getAllSiteLabels());
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

function loadSiteAvailability() {
  return loadSiteAvailabilityState(window.localStorage, SITE_AVAILABILITY_STORAGE_KEY);
}

function persistSiteAvailability() {
  persistSiteAvailabilityState(
    window.localStorage,
    SITE_AVAILABILITY_STORAGE_KEY,
    state.siteAvailability,
    new Set(state.siteMap.keys()),
  );
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
  return targetContextMenuController?.getState() || state.targetContextMenu;
}

function closeTargetContextMenu() {
  targetContextMenuController?.close();
}

function positionTargetContextMenu() {
  targetContextMenuController?.position();
}

function openTargetContextMenu(siteLabel, x, y) {
  targetContextMenuController?.open(siteLabel, x, y);
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
  return onboardingController?.isOpen() === true;
}

function isTargetContextMenuOpen() {
  return targetContextMenuController?.isOpen() === true;
}

function renderOnboardingStep() {
  onboardingController?.render();
}

async function openOnboarding(resetToFirst = false) {
  await onboardingController?.open(resetToFirst);
}

async function closeOnboarding(markCompleted = false) {
  await onboardingController?.close(markCompleted);
}

async function stepOnboarding(direction) {
  await onboardingController?.step(direction);
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
  return isComposerImageType(file);
}

function formatAttachmentSize(size) {
  return formatComposerAttachmentSize(size);
}

function dataUrlToBase64(dataUrl) {
  return composerDataUrlToBase64(dataUrl);
}

function readFileAsDataUrl(file) {
  return readComposerFileAsDataUrl(file);
}

async function normalizeAttachment(file) {
  return normalizeComposerAttachment(file);
}

function renderComposerAttachments() {
  const container = document.querySelector("#prompt-attachments");
  const dropzone = document.querySelector("#prompt-dropzone");
  if (!container || !dropzone) {
    return;
  }

  renderComposerAttachmentList({
    container,
    dropzone,
    attachments: state.composerAttachments,
  });
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
  setPromptDropActive(false);
}

function guessMimeTypeFromName(name) {
  return guessComposerMimeTypeFromName(name);
}

async function pathToAttachment(path) {
  return pathToComposerAttachment(path, (targetPath) => invoke("read_file_bytes", { path: targetPath }));
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
  return uniqueComposerAttachments(existing, incoming);
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
  return serializeComposerAttachmentPayloads(state.composerAttachments);
}

async function serializeAttachmentsFromPaths(paths) {
  const validPaths = Array.from(paths || []).filter(Boolean);
  if (!validPaths.length) {
    return [];
  }

  const attachments = await Promise.all(validPaths.map((path) => pathToAttachment(path)));
  return serializeComposerAttachmentPayloads(attachments);
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
  wireComposerPromptAttachments({
    appendFiles: appendComposerFiles,
    clearDragVisualState,
    renderAttachments: renderComposerAttachments,
    removeAttachment: removeComposerAttachment,
    setPromptDropActive,
    setStatus,
  });
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

function getSiteTitles(labels) {
  return labels
    .map((label) => getSiteMeta(label)?.title || label)
    .join("、");
}

function getSiteTitle(label) {
  return layoutPresetController?.getSiteTitle(label) || getSiteMeta(label)?.title || label;
}

function renderLayoutPresetSelect() {
  layoutPresetController?.renderSelect();
}

function renderLayoutPresets() {
  layoutPresetController?.renderList();
}

function saveLayoutPresetAs(name) {
  return layoutPresetController?.saveAs(name) || false;
}

function renameLayoutPreset(presetId, name) {
  layoutPresetController?.rename(presetId, name);
}

async function deleteLayoutPreset(presetId) {
  await layoutPresetController?.remove(presetId);
}

async function applyLayoutPreset(presetId) {
  await layoutPresetController?.apply(presetId);
}

async function closeLayoutPresetMenu() {
  await hideLayoutPresetMenuWebview();
}

function getLayoutPresetMenuMetrics() {
  const trigger = document.querySelector("#layout-preset-more");
  if (!trigger) {
    return null;
  }

  return getMenuMetricsFromRect(trigger.getBoundingClientRect(), {
    width: window.innerWidth,
    height: window.innerHeight,
  });
}

function positionLayoutPresetMenu() {
  void positionLayoutPresetMenuWebview();
}

function getLayoutPresetDropdownMetrics() {
  const trigger = document.querySelector("#layout-preset-select");
  if (!trigger || !state.layoutPresets) {
    return null;
  }

  const itemCount = Math.max(1, state.layoutPresets.items.length);
  return getDropdownMetricsFromRect(trigger.getBoundingClientRect(), itemCount, {
    width: window.innerWidth,
    height: window.innerHeight,
  });
}

async function toPhysicalMetrics(metrics) {
  const windowSize = await appWindow.innerSize();
  return cssToPhysicalMetrics(metrics, windowSize, {
    width: window.innerWidth,
    height: window.innerHeight,
  });
}

const layoutPresetDropdownOverlay = createOverlayWebviewController({
  appWindow,
  Webview,
  label: LAYOUT_PRESET_DROPDOWN_LABEL,
  route: LAYOUT_PRESET_DROPDOWN_ROUTE,
  fallbackSize: { width: 180, height: 96 },
  getCached: () => state.layoutPresetDropdownWebview,
  setCached: (current) => {
    state.layoutPresetDropdownWebview = current;
  },
  getByLabel: (label) => Webview.getByLabel(label),
  waitForWebview,
  getMetrics: getLayoutPresetDropdownMetrics,
  toPhysicalMetrics,
  isOpen: isLayoutPresetDropdownOpen,
  onHide: () => {
    const trigger = document.querySelector("#layout-preset-select");
    state.layoutPresetDropdown.open = false;
    trigger?.setAttribute("aria-expanded", "false");
  },
  createPosition: (x, y) => new PhysicalPosition(x, y),
  createSize: (width, height) => new PhysicalSize(width, height),
  emitTo: (label, eventName, payload) => tauriEvent.emitTo(label, eventName, payload),
  eventName: "layout-preset-dropdown-state",
  getPayload: () => buildLayoutPresetDropdownState(state.theme, state.layoutPresets),
});

const layoutPresetMenuOverlay = createOverlayWebviewController({
  appWindow,
  Webview,
  label: LAYOUT_PRESET_MENU_LABEL,
  route: LAYOUT_PRESET_MENU_ROUTE,
  fallbackSize: { width: 168, height: 84 },
  getCached: () => state.layoutPresetMenuWebview,
  setCached: (current) => {
    state.layoutPresetMenuWebview = current;
  },
  getByLabel: (label) => Webview.getByLabel(label),
  waitForWebview,
  getMetrics: getLayoutPresetMenuMetrics,
  toPhysicalMetrics,
  isOpen: isLayoutPresetMenuOpen,
  onHide: () => {
    state.layoutPresetMenu.open = false;
  },
  createPosition: (x, y) => new PhysicalPosition(x, y),
  createSize: (width, height) => new PhysicalSize(width, height),
  emitTo: (label, eventName, payload) => tauriEvent.emitTo(label, eventName, payload),
  eventName: "layout-preset-menu-state",
  getPayload: () => buildLayoutPresetMenuState(state.theme),
});

layoutPresetOverlayController = createLayoutPresetOverlayController({
  document,
  state,
  overlays: {
    dropdown: layoutPresetDropdownOverlay,
    menu: layoutPresetMenuOverlay,
  },
  actions: {
    isTargetContextMenuOpen,
    closeTargetContextMenu,
  },
});

async function ensureLayoutPresetDropdownWebview() {
  return layoutPresetOverlayController.ensureDropdown();
}

async function ensureLayoutPresetMenuWebview() {
  return layoutPresetOverlayController.ensureMenu();
}

async function positionLayoutPresetDropdownWebview() {
  await layoutPresetOverlayController.positionDropdown();
}

async function positionLayoutPresetMenuWebview() {
  await layoutPresetOverlayController.positionMenu();
}

async function syncLayoutPresetDropdownState() {
  await layoutPresetOverlayController.syncDropdown();
}

async function syncLayoutPresetMenuState() {
  await layoutPresetOverlayController.syncMenu();
}

async function hideLayoutPresetDropdownWebview() {
  await layoutPresetOverlayController.hideDropdown();
}

async function hideLayoutPresetMenuWebview() {
  await layoutPresetOverlayController.hideMenu();
}

async function showLayoutPresetDropdownWebview() {
  await layoutPresetOverlayController.openDropdown();
}

async function showLayoutPresetMenuWebview() {
  await layoutPresetOverlayController.openMenu();
}

async function closeLayoutPresetDropdown() {
  await hideLayoutPresetDropdownWebview();
}

async function openLayoutPresetDropdown() {
  await showLayoutPresetDropdownWebview();
}

async function openLayoutPresetMenu() {
  await showLayoutPresetMenuWebview();
}

function isLayoutPresetMenuOpen() {
  return layoutPresetOverlayController?.isMenuOpen() === true;
}

function isLayoutPresetDropdownOpen() {
  return layoutPresetOverlayController?.isDropdownOpen() === true;
}

async function runLayoutPresetMenuAction(action) {
  await layoutPresetController?.runMenuAction(action);
}

function setStatus(message, level = "muted") {
  const status = document.querySelector("#status");
  if (!status) {
    syncVueBridgeState({ status: { message, level } });
    return;
  }
  status.dataset.level = level;
  status.textContent = message;
  syncVueBridgeState({ status: { message, level } });
}

function syncVueBridgeState(patch = {}) {
  if (!workspaceStore) {
    return;
  }

  workspaceStore.hydrate({
    sites: state.sites,
    workspace: state.workspace,
    layoutPresets: state.layoutPresets,
    themeMode: state.themeMode,
    ...patch,
  });
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
  return resolveThemeMode(themeMode, getSystemTheme);
}

function applyTheme(themeMode = state.themeMode) {
  const nextTheme = applyThemeToDocument(document, themeMode, getSystemTheme);
  state.themeMode = nextTheme.themeMode;
  state.theme = nextTheme.theme;
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
  return createUiIcon(document, kind);
}

function createDot(accentColor) {
  return createUiDot(document, accentColor);
}

function createStatusDot(accentColor) {
  return createUiStatusDot(document, accentColor);
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
  return createUiDragHandle(document);
}

function ensurePanelShells() {
  const layer = document.querySelector("#panel-layer");
  renderPanelShells({ document, layer, sites: state.sites });
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
  return getPaneMetricsFromRect(rect, PANEL_TOPBAR_HEIGHT);
}

function panelToolbarMetrics(label) {
  const panel = getPanelElement(label);
  if (!panel || panel.hidden) {
    return null;
  }

  const rect = panel.getBoundingClientRect();
  return getToolbarMetricsFromRect(rect, PANEL_TOPBAR_HEIGHT);
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
  return getToolbarWebviewLabel(siteLabel);
}

function buildToolbarUrl(site) {
  return buildToolbarWebviewUrl(site);
}

async function waitForToolbarWebview(label, timeoutMs = 12000) {
  return waitForWebview(label, timeoutMs);
}

const toolbarWebviewController = createPanelWebviewController({
  appWindow,
  Webview,
  cache: state.toolbarWebviews,
  pending: state.pendingToolbarWebviews,
  getByLabel: (label) => Webview.getByLabel(label),
  waitForWebview: waitForToolbarWebview,
  getSite: (label) => {
    const siteLabel = label.endsWith("-toolbar") ? label.slice(0, -"toolbar".length - 1) : label;
    return getSiteMeta(siteLabel);
  },
  getMetrics: (label) => {
    const siteLabel = label.endsWith("-toolbar") ? label.slice(0, -"toolbar".length - 1) : label;
    return toolbarPhysicalMetrics(siteLabel);
  },
  buildOptions: (site, metrics) => buildToolbarWebviewOptions(buildToolbarUrl(site), metrics, PANEL_TOPBAR_HEIGHT),
  shouldKeepVisible: (shouldShow) => shouldShow,
  createPosition: (x, y) => new PhysicalPosition(x, y),
  createSize: (width, height) => new PhysicalSize(width, height),
});

const panelWebviewController = createPanelWebviewController({
  appWindow,
  Webview,
  cache: state.webviews,
  pending: state.pendingWebviews,
  getByLabel: (label) => Webview.getByLabel(label),
  waitForWebview,
  getSite: getSiteMeta,
  getMetrics: panePhysicalMetrics,
  buildOptions: buildPanelWebviewOptions,
  shouldKeepVisible: (shouldShow, label) => shouldKeepWebviewVisible(shouldShow, isPanelCurrentlyVisible(label)),
  createPosition: (x, y) => new PhysicalPosition(x, y),
  createSize: (width, height) => new PhysicalSize(width, height),
  onCreated: (site, webviewInstance) => {
    webviewInstance.once("tauri://created", () => {
      syncSiteAvailability(site.label, true, "", { fromWebview: true });
    }).catch(() => {});

    webviewInstance.once("tauri://error", (event) => {
      const message = typeof event?.payload === "string" ? event.payload : "不可访问";
      syncSiteAvailability(site.label, false, message, { fromWebview: true });
    }).catch(() => {});
  },
  afterEnsure: ensureWebviewDropListener,
});

async function ensureToolbarWebview(siteLabel, shouldShow = true) {
  return toolbarWebviewController.ensure(getToolbarLabel(siteLabel), shouldShow);
}

async function ensureWebview(siteLabel, shouldShow = true) {
  return panelWebviewController.ensure(siteLabel, shouldShow);
}

async function ensureTargetsReady(targetLabels, shouldShow = false) {
  await panelWebviewController.ensureMany(targetLabels, shouldShow);
}

async function ensureToolbarTargetsReady(targetLabels, shouldShow = false) {
  await toolbarWebviewController.ensureMany(targetLabels.map(getToolbarLabel), shouldShow);
}

async function relayoutWebviews() {
  await panelWebviewController.relayout(state.sites, new Set(getVisibleTargets()), isAnyOverlayOpen());
}

async function relayoutToolbarWebviews() {
  const visibleTargets = new Set(getVisibleTargets());
  const toolbarSites = state.sites.map((site) => ({ ...site, label: getToolbarLabel(site.label) }));
  const visibleToolbars = new Set([...visibleTargets].map(getToolbarLabel));
  await toolbarWebviewController.relayout(toolbarSites, visibleToolbars, isAnyOverlayOpen());
}

async function settleLayout(passes = 3) {
  await layoutRefreshController?.settle(passes);
}

async function syncVisibleWebviews() {
  await panelWebviewController.syncVisible(
    state.sites,
    new Set(getVisibleTargets()),
    isAnyOverlayOpen(),
    (label) => !getPanelElement(label)?.hidden,
  );
}

async function syncVisibleToolbarWebviews() {
  await toolbarWebviewController.syncVisible(
    state.sites,
    new Set(getVisibleTargets()),
    isAnyOverlayOpen(),
    (label) => !getPanelElement(label)?.hidden,
    (site) => getToolbarLabel(site.label),
  );
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
    await tauriEvent.emitTo(
      toolbarLabel,
      "panel-toolbar-state",
      buildPanelToolbarState(site, state.theme, maximizedLabel === site.label),
    );
  }
}

function getLayoutRects(labels) {
  const gap = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--grid-gap")) || 2;
  const container = document.querySelector(".grid-preview");
  const { width, height } = container.getBoundingClientRect();
  return getPanelLayoutRects(labels, currentLayoutState(), { width, height }, gap);
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
  renderPanelLayoutHandles({
    document,
    layer,
    handles,
    onPointerDown: startHandleDrag,
  });
}

function renderEmptyState() {
  const container = document.querySelector("#layout-empty");
  renderEmptyPanelState({
    document,
    container,
    visibleCount: getVisibleTargets().length,
    title: TEXT.emptyTitle,
    message: TEXT.emptyMessage,
  });
}

function applyLayout() {
  const visibleTargets = getVisibleTargets();
  renderEmptyState();
  const { rects, handles } = getLayoutRects(visibleTargets);
  applyPanelRects(rects);
  renderLayoutHandles(handles);
}

async function refreshLayout(passes = 3) {
  await layoutRefreshController?.refresh(passes);
}

function clearScheduledLayoutRefreshes() {
  layoutRefreshController?.clearScheduled();
}

function scheduleLayoutRefresh(reason = "layout", delays = [0, 80, 180, 320, 520]) {
  layoutRefreshController?.schedule(reason, delays);
}

function updateLayoutStateFromDrag(handleKey, ratio) {
  updateLayoutFromHandleDrag(currentLayoutState(), handleKey, ratio);
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
  renderPageTabsDom({
    document,
    container,
    pageCount: getPageCount(),
    activePageIndex: state.workspace.activePageIndex,
    selectedCount: state.workspace.selectedSiteLabels.length,
    maxSitesPerPage: MAX_SITES_PER_PAGE,
    selectedPrefix: TEXT.selectedPrefix,
    getPageLabels,
    onPageChange: async (pageIndex) => {
      state.workspace.activePageIndex = pageIndex;
      persistWorkspace();
      renderWorkspace();
      await refreshLayout();
    },
  });
}

function renderGlobalTargets() {
  const container = document.querySelector("#global-targets");
  renderTargetBar({
    document,
    container,
    sites: getVisibleManagedSites(),
    selectedLabels: state.workspace.selectedSiteLabels,
    contextMenu: getContextMenuState(),
    getAvailability: getSiteAvailability,
    isUnavailable: isSiteUnavailable,
    createDot,
    onContextMenu: openTargetContextMenu,
    onSelectionChange: async (label, selected) => {
      setSiteSelected(label, selected);
      renderWorkspace();
      await refreshLayout();
    },
  });
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
  syncVueBridgeState();
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

function reorderVisibleSites(sourceLabel, targetLabel) {
  if (!reorderVisibleSitesInWorkspace(state.workspace, sourceLabel, targetLabel)) {
    return false;
  }
  persistWorkspace();
  return true;
}

function addVisibleSite(label) {
  addVisibleSiteToWorkspace(state.workspace, label, sanitizeSiteOrder);
  persistWorkspace();
}

function removeVisibleSite(label) {
  const next = removeVisibleSiteFromWorkspace(state.workspace, label, state.maximizedLabel);
  state.maximizedLabel = next.maximizedLabel;
  persistWorkspace();
}

function isSiteManagerOpen() {
  return siteManagerController?.isOpen() === true;
}

function isCloseConfirmOpen() {
  const modal = document.querySelector("#close-confirm");
  return isModalElementOpen(modal);
}

function isAboutDialogOpen() {
  return standardDialogsController?.isAboutOpen() === true;
}

function isLayoutPresetsOpen() {
  return standardDialogsController?.isLayoutPresetsOpen() === true;
}

async function openSiteManager() {
  await siteManagerController?.open();
}

async function closeSiteManager() {
  await siteManagerController?.close();
}

async function openLayoutPresets() {
  await standardDialogsController?.openLayoutPresets();
}

async function closeLayoutPresets() {
  await standardDialogsController?.closeLayoutPresets();
}

async function openAboutDialog() {
  await standardDialogsController?.openAbout();
}

async function closeAboutDialog() {
  await standardDialogsController?.closeAbout();
}

async function showCloseConfirm() {
  return closeConfirmController?.show() ?? true;
}

async function resolveCloseConfirm(accepted) {
  await closeConfirmController?.resolve(accepted);
}

function createManagerItem(site, visible) {
  return createSiteManagerItem({
    document,
    site,
    visible,
    createDot,
    createDragHandle,
    onRemove: async () => {
      removeVisibleSite(site.label);
      renderWorkspace();
      await refreshLayout();
    },
    onAdd: async () => {
      addVisibleSite(site.label);
      renderWorkspace();
      await refreshLayout();
    },
  });
}

function renderSiteManager() {
  siteManagerController?.render();
}

function destroySortables() {
  siteManagerController?.destroySortables();
}

function syncVisibleSitesFromDom(containerSelector) {
  return siteManagerController?.syncVisibleSitesFromDom(containerSelector) || false;
}

function initSortableTargets() {
  siteManagerController?.initSortableTargets();
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
  wirePanelResponsiveRelayout({
    document,
    window,
    ResizeObserver: typeof ResizeObserver === "function" ? ResizeObserver : undefined,
    state,
    actions: {
      scheduleLayoutRefresh,
      syncCompactBarHeight,
      isOnboardingOpen,
      renderOnboardingStep,
      isTargetContextMenuOpen,
      positionTargetContextMenu,
      isLayoutPresetMenuOpen,
      positionLayoutPresetMenuWebview,
      isLayoutPresetDropdownOpen,
      positionLayoutPresetDropdownWebview,
    },
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

  mountVueApp();
  workspaceStore = useWorkspaceStore();

  setStatus("\u6b63\u5728\u52a0\u8f7d AI \u5217\u8868...", "working");
  await fetchSites();
  state.onboarding.completed = loadOnboardingCompleted();
  state.workspace = loadWorkspace();
  state.workspace = sanitizeWorkspace(state.workspace);
  state.layoutPresets = loadLayoutPresets();
  targetContextMenuController = createTargetContextMenuController({
    document,
    window,
    state: state.targetContextMenu,
    actions: {
      getSiteMeta,
      syncVisibleWebviews,
      syncVisibleToolbarWebviews,
    },
  });
  siteManagerController = createSiteManagerController({
    document,
    Sortable,
    state,
    actions: {
      createManagerItem,
      getVisibleManagedSites,
      getHiddenManagedSites,
      renderLists: renderSiteManagerLists,
      syncCompactBarHeight,
      syncVisibleWebviews,
      syncVisibleToolbarWebviews,
      refreshLayout,
      persistWorkspace,
      renderWorkspace,
      syncVisibleSiteOrder,
      workspace: state.workspace,
    },
  });
  standardDialogsController = createStandardDialogsController({
    document,
    requestAnimationFrame: window.requestAnimationFrame,
    actions: {
      isSiteManagerOpen,
      closeSiteManager,
      isOnboardingOpen,
      closeOnboarding,
      isTargetContextMenuOpen,
      closeTargetContextMenu,
      isLayoutPresetMenuOpen,
      closeLayoutPresetMenu,
      isLayoutPresetDropdownOpen,
      closeLayoutPresetDropdown,
      renderLayoutPresets,
      syncCompactBarHeight,
      syncVisibleWebviews,
      syncVisibleToolbarWebviews,
      refreshLayout,
    },
  });
  closeConfirmController = createCloseConfirmController({
    document,
    requestAnimationFrame: window.requestAnimationFrame,
    state: state.closeConfirm,
    actions: {
      isSiteManagerOpen,
      closeSiteManager,
      isOnboardingOpen,
      closeOnboarding,
      syncVisibleWebviews,
      syncVisibleToolbarWebviews,
      refreshLayout,
    },
  });
  layoutRefreshController = createLayoutRefreshController({
    state,
    timerApi: {
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
    },
    actions: {
      syncCompactBarHeight,
      hasUsableGridSize,
      applyLayout,
      isAnyOverlayOpen,
      syncVisibleWebviews,
      syncVisibleToolbarWebviews,
      isOnboardingOpen,
      renderOnboardingStep,
      ensureTargetsReady,
      ensureToolbarTargetsReady,
      getVisibleTargets,
      syncToolbarStates,
      relayoutWebviews,
      relayoutToolbarWebviews,
      sleep,
    },
  });
  layoutPresetController = createLayoutPresetController({
    document,
    state,
    actions: {
      getSiteMeta,
      getAllSiteLabels,
      normalizePageLayouts,
      getPageCount,
      persistLayoutPresets,
      persistWorkspace,
      renderWorkspace,
      refreshLayout,
      setStatus,
      syncLayoutPresetDropdownState,
      openLayoutPresets,
      closeLayoutPresetMenu,
    },
  });
  onboardingController = createOnboardingController({
    document,
    window,
    steps: ONBOARDING_STEPS,
    state: state.onboarding,
    isSiteManagerOpen,
    closeSiteManager,
    syncVisibleWebviews,
    syncVisibleToolbarWebviews,
    refreshLayout,
    persistCompleted: persistOnboardingCompleted,
  });
  persistWorkspace();
  syncCompactBarHeight();

  ensurePanelShells();
  await renderAppVersion();
  renderWorkspace();

  await wireTauriAppEvents({
    tauriEvent,
    appWindow,
    siteAvailabilitySyncEvent: SITE_AVAILABILITY_SYNC_EVENT,
    attachmentDebugEvent: ATTACHMENT_DEBUG_EVENT,
    actions: {
      handlePanelAction,
      closeLayoutPresetDropdown,
      applyLayoutPreset,
      closeLayoutPresetMenu,
      runLayoutPresetMenuAction,
      syncSiteAvailability,
      logAttachmentDebug,
      findPanelDropTarget,
      setPanelDropTarget,
      setPromptDropActive,
      clearDragVisualState,
      injectAttachmentsIntoPanel,
      getSiteMeta,
      setStatus,
      appendComposerPaths,
      onError: console.error,
    },
  });

  void ensureSiteAvailability(state.workspace.visibleSiteLabels, { force: true });

  await refreshLayout();
  setStatus("\u9996\u6b21\u767b\u5f55\u5404 AI \u540e\uff0c\u540e\u7eed\u4f1a\u590d\u7528\u672c\u5730\u4f1a\u8bdd\u3002", "muted");

  wireAppDomEvents({
    document,
    window,
    actions: {
      sendPrompt,
      autosizePrompt,
      wirePromptAttachments,
      scheduleLayoutRefresh,
      reloadAll,
      refreshLayout,
      setStatus,
      openOnboarding,
      isLayoutPresetDropdownOpen,
      closeLayoutPresetDropdown,
      openLayoutPresetDropdown,
      isLayoutPresetMenuOpen,
      closeLayoutPresetMenu,
      openLayoutPresetMenu,
      openAboutDialog,
      openSiteManager,
      closeAboutDialog,
      closeSiteManager,
      closeLayoutPresets,
      saveLayoutPresetAs,
      runLayoutPresetMenuAction,
      closeTargetContextMenu,
      runTargetContextAction,
      getTargetContextSiteLabel: () => state.targetContextMenu.siteLabel,
      resolveCloseConfirm,
      isTargetContextMenuOpen,
      isCloseConfirmOpen,
      isAboutDialogOpen,
      isSiteManagerOpen,
      onboarding: onboardingController,
    },
  });

  wireThemeToggle();
  restoreTextButtons();
  syncClearSelectionButton();
  wireLayoutDragging();
  wireResponsiveRelayout();
  await wireCloseConfirmation();
  await wireWindowLayoutEvents({
    appWindow,
    actions: {
      scheduleLayoutRefresh,
      isLayoutPresetMenuOpen,
      isLayoutPresetDropdownOpen,
      positionLayoutPresetMenuWebview,
      positionLayoutPresetDropdownWebview,
      onError: console.error,
    },
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
