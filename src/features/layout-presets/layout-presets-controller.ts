import type { LayoutPresetState, SiteConfig, WorkspaceState } from "../../types/domain";
import { createDefaultLayoutPresets, updateActivePresetSnapshot } from "../../ui-state.js";
import { clamp } from "../../geometry.js";
import {
  createLayoutPresetId,
  getLayoutPresetMenuIntent,
  normalizeLayoutPresetName,
} from "./layout-presets-actions.ts";
import {
  renderLayoutPresetList,
  renderLayoutPresetSelectLabel,
} from "./layout-presets-dom.ts";

interface QueryableDocument {
  querySelector(selector: string): any;
}

interface LayoutPresetControllerState {
  layoutPresets: LayoutPresetState;
  workspace: WorkspaceState;
  maximizedLabel: string | null;
  isApplyingLayoutPreset: boolean;
  editingLayoutPresetId?: string | null;
}

interface LayoutPresetControllerActions {
  getSiteMeta(label: string): Pick<SiteConfig, "title"> | null | undefined;
  getAllSiteLabels(): string[];
  normalizePageLayouts(layouts: unknown, pageCount: number): WorkspaceState["pageLayouts"];
  getPageCount(selectedCount?: number): number;
  persistLayoutPresets(): void;
  persistWorkspace(): void;
  renderWorkspace(): void;
  refreshLayout(): Promise<void>;
  setStatus(message: string, level?: string): void;
  syncLayoutPresetDropdownState(): Promise<void>;
  openLayoutPresets(): Promise<void>;
  closeLayoutPresetMenu(): Promise<void>;
}

export function createLayoutPresetController({
  document,
  state,
  actions,
}: {
  document: QueryableDocument;
  state: LayoutPresetControllerState;
  actions: LayoutPresetControllerActions;
}) {
  const getSiteTitle = (label: string) => actions.getSiteMeta(label)?.title || label;

  function renderSelect(): void {
    const trigger = document.querySelector("#layout-preset-select");
    const current = document.querySelector("#layout-preset-current");
    if (!trigger || !current || !state.layoutPresets) {
      return;
    }

    const activePreset = state.layoutPresets.items.find(
      (preset) => preset.id === state.layoutPresets.activePresetId,
    );
    renderLayoutPresetSelectLabel({ trigger, current, activePreset });
    void actions.syncLayoutPresetDropdownState();
  }

  function renderList(): void {
    const container = document.querySelector("#layout-presets-list");
    if (!container || !state.layoutPresets) {
      return;
    }

    renderLayoutPresetList({
      container,
      presets: state.layoutPresets.items,
      activePresetId: state.layoutPresets.activePresetId,
      editingPresetId: state.editingLayoutPresetId || null,
      getSiteTitle,
      onStartRename: startRename,
      onRename: rename,
      onCancelRename: cancelRename,
      onApply: apply,
      onDelete: remove,
    });
  }

  function saveAs(name: string): boolean {
    const trimmedName = normalizeLayoutPresetName(name);
    if (!trimmedName) {
      actions.setStatus("请先输入布局名称。", "warn");
      return false;
    }

    const id = createLayoutPresetId();
    state.layoutPresets.items.push({
      id,
      name: trimmedName,
      builtin: false,
      snapshot: createDefaultLayoutPresets(actions.getAllSiteLabels(), actions.normalizePageLayouts).items[0].snapshot,
    });
    state.layoutPresets.activePresetId = id;
    state.layoutPresets = updateActivePresetSnapshot(
      state.layoutPresets,
      state.workspace,
      actions.normalizePageLayouts,
    );
    actions.persistLayoutPresets();
    renderSelect();
    renderList();
    actions.setStatus(`已保存布局：${trimmedName}`, "ok");
    return true;
  }

  function startRename(presetId: string): void {
    const preset = state.layoutPresets?.items?.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    state.editingLayoutPresetId = presetId;
    renderList();
  }

  function cancelRename(presetId?: string): void {
    if (presetId && state.editingLayoutPresetId !== presetId) {
      return;
    }
    state.editingLayoutPresetId = null;
    renderList();
  }

  function rename(presetId: string, name: string): void {
    const preset = state.layoutPresets?.items?.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    const nextName = normalizeLayoutPresetName(name);
    if (!nextName) {
      state.editingLayoutPresetId = null;
      renderList();
      return;
    }

    preset.name = nextName.slice(0, 24);
    state.editingLayoutPresetId = null;
    actions.persistLayoutPresets();
    renderSelect();
    renderList();
    actions.setStatus(`布局已重命名为：${preset.name}`, "ok");
  }

  async function remove(presetId: string): Promise<void> {
    if (!state.layoutPresets || state.layoutPresets.items.length <= 1) {
      return;
    }

    const preset = state.layoutPresets.items.find((item) => item.id === presetId);
    if (!preset || preset.builtin) {
      return;
    }

    state.layoutPresets.items = state.layoutPresets.items.filter((item) => item.id !== presetId);
    if (state.layoutPresets.activePresetId === presetId) {
      state.layoutPresets.activePresetId = state.layoutPresets.items[0]?.id || "";
    }
    if (state.editingLayoutPresetId === presetId) {
      state.editingLayoutPresetId = null;
    }
    actions.persistLayoutPresets();
    renderSelect();
    renderList();
    actions.setStatus(`已删除布局：${preset.name}`, "ok");

    if (state.layoutPresets.activePresetId && presetId === preset.id) {
      await apply(state.layoutPresets.activePresetId);
    }
  }

  async function apply(presetId: string): Promise<void> {
    const preset = state.layoutPresets?.items?.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    const selectedSiteLabels = (preset.snapshot?.selectedSiteLabels || []).filter((label) =>
      state.workspace.visibleSiteLabels.includes(label),
    );
    const pageCount = actions.getPageCount(selectedSiteLabels.length);

    state.layoutPresets.activePresetId = preset.id;
    state.workspace.selectedSiteLabels = selectedSiteLabels;
    state.workspace.activePageIndex = clamp(preset.snapshot?.activePageIndex || 0, 0, pageCount - 1);
    state.workspace.pageLayouts = actions.normalizePageLayouts(preset.snapshot?.pageLayouts, pageCount);
    state.maximizedLabel = null;
    state.editingLayoutPresetId = null;
    actions.persistLayoutPresets();
    state.isApplyingLayoutPreset = true;
    try {
      actions.persistWorkspace();
    } finally {
      state.isApplyingLayoutPreset = false;
    }

    actions.renderWorkspace();
    renderSelect();
    renderList();
    await actions.refreshLayout();

    const skippedCount = (preset.snapshot?.selectedSiteLabels || []).length - selectedSiteLabels.length;
    const suffix = skippedCount > 0 ? `，${skippedCount} 个隐藏 AI 已跳过` : "";
    actions.setStatus(`已应用布局：${preset.name}${suffix}`, skippedCount > 0 ? "warn" : "ok");
  }

  async function runMenuAction(action: string): Promise<void> {
    await actions.closeLayoutPresetMenu();
    const intent = getLayoutPresetMenuIntent(action);
    if (intent === "save-as") {
      await actions.openLayoutPresets();
      const input = document.querySelector("#layout-preset-name");
      input?.focus();
      input?.select?.();
      return;
    }

    if (intent === "edit") {
      await actions.openLayoutPresets();
    }
  }

  return {
    getSiteTitle,
    renderSelect,
    renderList,
    saveAs,
    startRename,
    cancelRename,
    rename,
    remove,
    apply,
    runMenuAction,
  };
}
