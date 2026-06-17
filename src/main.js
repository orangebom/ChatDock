import Sortable from "./vendor/sortable.esm.js";

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
const ONBOARDING_STORAGE_KEY = "chatdock-onboarding-v1";
const MAX_SITES_PER_PAGE = 4;

const DEFAULT_LAYOUT_STATE = {
  twoWaySplit: 0.5,
  threeWaySplits: [1 / 3, 2 / 3],
  quadCols: 0.5,
  quadRows: 0.5,
};
const PANEL_TOPBAR_HEIGHT = 34;
const PANEL_TOOLBAR_ROUTE = "/panel-toolbar.html";
const PROMPT_MIN_HEIGHT = 36;
const PROMPT_MAX_HEIGHT = 116;

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
    body: "你可以在这里切换分页、查看版本、刷新全部已选 AI、重新适配布局，以及切换明暗主题。",
    target: ".topbar",
    placement: "bottom",
  },
  {
    title: "这里勾选要显示的 AI",
    body: "底部这一排是全局 AI 选择区。按勾选顺序自动分页，每页最多显示 4 个 AI。",
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
];

const state = {
  sites: [],
  siteMap: new Map(),
  webviews: new Map(),
  pendingWebviews: new Map(),
  toolbarWebviews: new Map(),
  pendingToolbarWebviews: new Map(),
  theme: document.documentElement.dataset.theme || "dark",
  themeMode: document.documentElement.dataset.themeMode || "system",
  systemThemeMedia: null,
  workspace: null,
  maximizedLabel: null,
  activeDrag: null,
  relayoutVersion: 0,
  layoutRefreshToken: 0,
  layoutRefreshTimers: [],
  resizeObserver: null,
  compactBarObserver: null,
  sortables: [],
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

function persistOnboardingCompleted() {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "done");
  } catch (_error) {
    // Ignore storage errors and continue.
  }
}

function isAnyOverlayOpen() {
  return isSiteManagerOpen() || isOnboardingOpen();
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

function setStatus(message, level = "muted") {
  const status = document.querySelector("#status");
  if (!status) {
    return;
  }
  status.dataset.level = level;
  status.textContent = message;
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
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");

  const segments =
    kind === "reload"
      ? ["M16.1 10a6.1 6.1 0 1 1-1.79-4.31", "M16.1 4.9v3.7h-3.7"]
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
      new Webview(appWindow, site.label, {
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

  const title = document.createElement("h2");
  title.textContent = TEXT.emptyTitle;

  const message = document.createElement("p");
  message.textContent = TEXT.emptyMessage;

  card.append(title, message);
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
    const pill = document.createElement("label");
    pill.className = `target-pill${isSelected ? " active" : ""}`;
    pill.dataset.siteLabel = site.label;

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
  renderPageTabs();
  renderGlobalTargets();
  renderSiteManager();
  initSortableTargets();
  syncCompactBarHeight();
  syncPanelShellStates();
  applyLayout();
}

function setSiteSelected(label, selected) {
  if (!state.workspace.visibleSiteLabels.includes(label)) {
    return;
  }
  const current = state.workspace.selectedSiteLabels.filter((item) => item !== label);
  if (selected) {
    current.push(label);
  }

  state.workspace.selectedSiteLabels = current;
  if (!selected && state.maximizedLabel === label) {
    state.maximizedLabel = null;
  }
  const pageCount = getPageCount();
  state.workspace.pageLayouts = normalizePageLayouts(state.workspace.pageLayouts, pageCount);
  state.workspace.activePageIndex = selected
    ? Math.floor((current.length - 1) / MAX_SITES_PER_PAGE)
    : clamp(state.workspace.activePageIndex, 0, pageCount - 1);
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

async function openSiteManager() {
  const modal = document.querySelector("#site-manager");
  if (!modal) {
    return;
  }
  modal.hidden = false;
  renderSiteManager();
  initSortableTargets();
  syncCompactBarHeight();
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
    remove.textContent = "\u79fb\u9664";
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
    add.textContent = "\u6dfb\u52a0";
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
  if (!prompt) {
    setStatus("\u53d1\u9001\u524d\u8bf7\u5148\u8f93\u5165\u95ee\u9898\u3002", "warn");
    return;
  }

  const targets = [...state.workspace.selectedSiteLabels];
  if (!targets.length) {
    setStatus("\u8bf7\u5148\u9009\u62e9\u81f3\u5c11\u4e00\u4e2a AI\u3002", "warn");
    return;
  }

  setStatus(`\u6b63\u5728\u5411 ${targets.length} \u4e2a AI \u53d1\u9001\u95ee\u9898...`, "working");
  await ensureTargetsReady(targets, false);
  await sleep(380);
  try {
    const results = await invoke("broadcast_prompt", { prompt, targets });
    renderResults(results);
    const okCount = results.filter((item) => item.ok).length;
    setStatus(
      `\u53d1\u9001\u5b8c\u6210\uff1a${okCount}/${results.length} \u6210\u529f\u3002`,
      okCount === results.length ? "ok" : "warn",
    );
  } catch (error) {
    console.error(error);
    setStatus(`\u53d1\u9001\u5931\u8d25\uff1a${error}`, "fail");
  } finally {
    promptField.value = "";
    autosizePrompt();
    await refreshLayout();
  }
}

async function reloadAll() {
  const targets = [...state.workspace.selectedSiteLabels];
  if (!targets.length) {
    setStatus("\u8bf7\u5148\u9009\u62e9\u81f3\u5c11\u4e00\u4e2a AI\u3002", "warn");
    return;
  }

  setStatus(`\u6b63\u5728\u5237\u65b0 ${targets.length} \u4e2a AI...`, "working");
  const results = await reloadTargets(targets);
  renderResults(results);
  const okCount = results.filter((item) => item.ok).length;
  setStatus(
    `\u5237\u65b0\u5b8c\u6210\uff1a${okCount}/${results.length} \u6210\u529f\u3002`,
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
  });
}

async function fetchSites() {
  const sites = await invoke("list_sites");
  state.sites = sites;
  state.siteMap = new Map(sites.map((site) => [site.label, site]));
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

  await refreshLayout();
  setStatus("\u9996\u6b21\u767b\u5f55\u5404 AI \u540e\uff0c\u540e\u7eed\u4f1a\u590d\u7528\u672c\u5730\u4f1a\u8bdd\u3002", "muted");

  document.querySelector("#prompt-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendPrompt();
  });

  const promptField = document.querySelector("#prompt");
  autosizePrompt();
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
  document.querySelector("#manage-sites").addEventListener("click", async () => {
    await openSiteManager();
  });
  document.querySelector("#close-site-manager").addEventListener("click", async () => {
    await closeSiteManager();
  });
  document.querySelector("#site-manager").addEventListener("click", async (event) => {
    if (event.target?.dataset?.closeSiteManager === "true") {
      await closeSiteManager();
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
  wireLayoutDragging();
  wireResponsiveRelayout();

  await appWindow.onResized(() => {
    scheduleLayoutRefresh("window-state", [0, 120, 260, 460, 720]);
  });

  await appWindow.onScaleChanged(() => {
    scheduleLayoutRefresh("scale-change", [0, 120, 260, 460, 720]);
  });

  await appWindow.onFocusChanged(({ payload: focused }) => {
    if (focused) {
      scheduleLayoutRefresh("focus-return", [0, 120, 260]);
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
