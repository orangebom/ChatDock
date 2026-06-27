interface QueryableDocument {
  querySelector(selector: string): any;
}

interface EventWindow {
  addEventListener(type: string, listener: (event: any) => void | Promise<void>): void;
}

interface AppEventActions {
  sendPrompt(): Promise<void>;
  autosizePrompt(): void;
  wirePromptAttachments(): void;
  scheduleLayoutRefresh(reason: string, delays?: number[]): void;
  reloadAll(): Promise<void>;
  refreshLayout(passes?: number): Promise<void>;
  setStatus(message: string, level?: string): void;
  openOnboarding(resetToFirst?: boolean): Promise<void>;
  isLayoutPresetDropdownOpen(): boolean;
  closeLayoutPresetDropdown(): Promise<void>;
  openLayoutPresetDropdown(): Promise<void>;
  isLayoutPresetMenuOpen(): boolean;
  closeLayoutPresetMenu(): Promise<void>;
  openLayoutPresetMenu(): Promise<void>;
  openAboutDialog(): Promise<void>;
  openSiteManager(): Promise<void>;
  closeAboutDialog(): Promise<void>;
  closeSiteManager(): Promise<void>;
  closeLayoutPresets(): Promise<void>;
  saveLayoutPresetAs(name: string): boolean;
  runLayoutPresetMenuAction(action: string): Promise<void>;
  closeTargetContextMenu(): void;
  runTargetContextAction(action: string, siteLabel: string): Promise<void>;
  getTargetContextSiteLabel(): string | null;
  resolveCloseConfirm(accepted: boolean): Promise<void>;
  isTargetContextMenuOpen(): boolean;
  isCloseConfirmOpen(): boolean;
  isAboutDialogOpen(): boolean;
  isSiteManagerOpen(): boolean;
  onboarding?: {
    wire(): void;
    handleKeydown(event: KeyboardEvent): Promise<boolean>;
  } | null;
}

export function wireAppDomEvents({
  document,
  window,
  actions,
}: {
  document: QueryableDocument;
  window: EventWindow;
  actions: AppEventActions;
}): void {
  document.querySelector("#prompt-form").addEventListener("submit", async (event: Event) => {
    event.preventDefault();
    await actions.sendPrompt();
  });

  const promptField = document.querySelector("#prompt");
  actions.autosizePrompt();
  actions.wirePromptAttachments();
  promptField.addEventListener("input", () => {
    actions.autosizePrompt();
    actions.scheduleLayoutRefresh("prompt-input", [0, 60, 180]);
  });

  promptField.addEventListener("keydown", async (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await actions.sendPrompt();
    }
  });

  document.querySelector("#reload").addEventListener("click", actions.reloadAll);
  document.querySelector("#relayout").addEventListener("click", async () => {
    await actions.refreshLayout();
    actions.setStatus("布局已重新计算。", "ok");
  });
  document.querySelector("#open-onboarding").addEventListener("click", async () => {
    await actions.openOnboarding(true);
  });
  document.querySelector("#layout-preset-select").addEventListener("click", async () => {
    if (actions.isLayoutPresetDropdownOpen()) {
      await actions.closeLayoutPresetDropdown();
      return;
    }
    await actions.openLayoutPresetDropdown();
  });
  document.querySelector("#layout-preset-more").addEventListener("click", async () => {
    if (actions.isLayoutPresetMenuOpen()) {
      await actions.closeLayoutPresetMenu();
      return;
    }
    await actions.openLayoutPresetMenu();
  });
  document.querySelector("#open-about").addEventListener("click", async () => {
    await actions.openAboutDialog();
  });
  document.querySelector("#manage-sites").addEventListener("click", async () => {
    await actions.openSiteManager();
  });
  document.querySelector("#close-about").addEventListener("click", async () => {
    await actions.closeAboutDialog();
  });
  document.querySelector("#about-dialog").addEventListener("click", async (event: any) => {
    if (event.target?.dataset?.closeAboutBackdrop === "true") {
      await actions.closeAboutDialog();
    }
  });
  document.querySelector("#close-site-manager").addEventListener("click", async () => {
    await actions.closeSiteManager();
  });
  document.querySelector("#site-manager").addEventListener("click", async (event: any) => {
    if (event.target?.dataset?.closeSiteManager === "true") {
      await actions.closeSiteManager();
    }
  });
  document.querySelector("#close-layout-presets").addEventListener("click", async () => {
    await actions.closeLayoutPresets();
  });
  document.querySelector("#layout-presets").addEventListener("click", async (event: any) => {
    if (event.target?.dataset?.closeLayoutPresets === "true") {
      await actions.closeLayoutPresets();
    }
  });
  document.querySelector("#layout-preset-form").addEventListener("submit", (event: any) => {
    event.preventDefault();
    const input = document.querySelector("#layout-preset-name");
    if (actions.saveLayoutPresetAs(input.value)) {
      input.value = "";
    }
  });
  document.querySelector("#layout-preset-menu").addEventListener("click", async (event: any) => {
    if (event.target?.dataset?.closeLayoutPresetMenu === "true") {
      await actions.closeLayoutPresetMenu();
      return;
    }

    const action = event.target?.dataset?.layoutPresetAction;
    if (!action) {
      return;
    }

    await actions.runLayoutPresetMenuAction(action);
  });
  document.querySelector("#target-context-menu").addEventListener("click", async (event: any) => {
    if (event.target?.dataset?.closeTargetContextMenu === "true") {
      actions.closeTargetContextMenu();
      return;
    }

    const action = event.target?.dataset?.contextAction;
    const siteLabel = actions.getTargetContextSiteLabel();
    if (!action || !siteLabel) {
      return;
    }

    actions.closeTargetContextMenu();
    await actions.runTargetContextAction(action, siteLabel);
  });
  document.querySelector("#cancel-close-confirm").addEventListener("click", async () => {
    await actions.resolveCloseConfirm(false);
  });
  document.querySelector("#accept-close-confirm").addEventListener("click", async () => {
    await actions.resolveCloseConfirm(true);
  });
  document.querySelector("#close-confirm").addEventListener("click", async (event: any) => {
    if (event.target?.dataset?.closeConfirmBackdrop === "true") {
      await actions.resolveCloseConfirm(false);
    }
  });

  actions.onboarding?.wire();
  window.addEventListener("keydown", async (event: any) => {
    if (event.key === "Escape" && actions.isTargetContextMenuOpen()) {
      event.preventDefault();
      actions.closeTargetContextMenu();
      return;
    }
    if (event.key === "Escape" && actions.isCloseConfirmOpen()) {
      event.preventDefault();
      await actions.resolveCloseConfirm(false);
      return;
    }
    if (event.key === "Escape" && actions.isAboutDialogOpen()) {
      event.preventDefault();
      await actions.closeAboutDialog();
      return;
    }
    if (event.key === "Escape" && actions.isSiteManagerOpen()) {
      await actions.closeSiteManager();
    }
    await actions.onboarding?.handleKeydown(event);
  });
}
