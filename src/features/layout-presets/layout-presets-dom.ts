import type { LayoutPreset } from "../../types/domain";

export function getLayoutPresetSelectLabel(activePreset: Pick<LayoutPreset, "name"> | null | undefined): string {
  return activePreset?.name || "选择布局";
}

export function getLayoutPresetMetaLabel(
  labels: string[],
  getSiteTitle: (label: string) => string,
): string {
  return labels.length ? `${labels.length} 个 AI：${labels.map(getSiteTitle).join("、")}` : "空白布局";
}

export function getLayoutPresetApplyLabel(presetId: string, activePresetId: string | null | undefined): string {
  return presetId === activePresetId ? "当前" : "应用";
}

export function getLayoutPresetDeleteState(
  preset: Pick<LayoutPreset, "builtin">,
  presetCount: number,
): { disabled: boolean; title: string } {
  return {
    disabled: preset.builtin || presetCount <= 1,
    title: preset.builtin ? "内置布局不可删除" : "删除布局",
  };
}

export function renderLayoutPresetSelectLabel({
  trigger,
  current,
  activePreset,
}: {
  trigger: HTMLElement;
  current: HTMLElement;
  activePreset: Pick<LayoutPreset, "name"> | null | undefined;
}): void {
  current.textContent = getLayoutPresetSelectLabel(activePreset);
  trigger.title = activePreset ? `当前布局：${activePreset.name}` : "切换布局";
}

function createMiniButton(label: string, onClick: () => void | Promise<void>) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mini-button";
  button.textContent = label;
  button.addEventListener("click", async () => {
    await onClick();
  });
  return button;
}

export function renderLayoutPresetList({
  container,
  presets,
  activePresetId,
  editingPresetId,
  getSiteTitle,
  onStartRename,
  onRename,
  onCancelRename,
  onApply,
  onDelete,
}: {
  container: HTMLElement;
  presets: LayoutPreset[];
  activePresetId: string | null | undefined;
  editingPresetId: string | null | undefined;
  getSiteTitle: (label: string) => string;
  onStartRename: (presetId: string) => void;
  onRename: (presetId: string, name: string) => void;
  onCancelRename: (presetId: string) => void;
  onApply: (presetId: string) => void | Promise<void>;
  onDelete: (presetId: string) => void | Promise<void>;
}): void {
  container.innerHTML = "";

  for (const preset of presets) {
    const isEditing = preset.id === editingPresetId;

    const item = document.createElement("article");
    item.className = `layout-preset-item${preset.id === activePresetId ? " active" : ""}`;

    const main = document.createElement("div");
    main.className = "layout-preset-main";

    const title = document.createElement("input");
    title.className = "layout-preset-title layout-preset-name-input";
    title.value = preset.name;
    title.maxLength = 24;
    title.readOnly = !isEditing;
    title.setAttribute("aria-label", `重命名布局 ${preset.name}`);
    title.addEventListener("change", () => {
      if (isEditing) {
        onRename(preset.id, title.value);
      }
    });
    title.addEventListener("keydown", (event: KeyboardEvent) => {
      if (!isEditing) {
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        onRename(preset.id, title.value);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRename(preset.id);
      }
    });

    const labels = preset.snapshot?.selectedSiteLabels || [];
    const meta = document.createElement("div");
    meta.className = "layout-preset-meta";
    meta.textContent = getLayoutPresetMetaLabel(labels, getSiteTitle);

    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "layout-preset-actions";

    if (isEditing) {
      actions.appendChild(createMiniButton("保存", () => onRename(preset.id, title.value)));
      actions.appendChild(createMiniButton("取消", () => onCancelRename(preset.id)));
    } else {
      actions.appendChild(createMiniButton("重命名", () => onStartRename(preset.id)));

      const applyButton = createMiniButton(
        getLayoutPresetApplyLabel(preset.id, activePresetId),
        () => onApply(preset.id),
      );
      applyButton.disabled = preset.id === activePresetId;
      actions.appendChild(applyButton);

      const deleteButton = createMiniButton("删除", () => onDelete(preset.id));
      const deleteState = getLayoutPresetDeleteState(preset, presets.length);
      deleteButton.disabled = deleteState.disabled;
      deleteButton.title = deleteState.title;
      actions.appendChild(deleteButton);
    }

    item.append(main, actions);
    container.appendChild(item);
  }
}
