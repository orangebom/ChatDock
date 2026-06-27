import {
  focusElementOnNextFrame,
  hideModalElement,
  isModalElementOpen,
  showModalElement,
} from "./dialogs-dom.ts";

interface QueryableDocument {
  querySelector(selector: string): any;
}

type RequestAnimationFrameLike = (callback: () => void) => unknown;

interface StandardDialogActions {
  isSiteManagerOpen(): boolean;
  closeSiteManager(): Promise<void>;
  isOnboardingOpen(): boolean;
  closeOnboarding(markCompleted?: boolean): Promise<void>;
  isTargetContextMenuOpen(): boolean;
  closeTargetContextMenu(): void;
  isLayoutPresetMenuOpen(): boolean;
  closeLayoutPresetMenu(): Promise<void>;
  isLayoutPresetDropdownOpen(): boolean;
  closeLayoutPresetDropdown(): Promise<void>;
  renderLayoutPresets(): void;
  syncCompactBarHeight(): void;
  syncVisibleWebviews(): Promise<void>;
  syncVisibleToolbarWebviews(): Promise<void>;
  refreshLayout(passes?: number): Promise<void>;
}

export function createStandardDialogsController({
  document,
  requestAnimationFrame,
  actions,
}: {
  document: QueryableDocument;
  requestAnimationFrame: RequestAnimationFrameLike;
  actions: StandardDialogActions;
}) {
  function isAboutOpen(): boolean {
    return isModalElementOpen(document.querySelector("#about-dialog"));
  }

  function isLayoutPresetsOpen(): boolean {
    return isModalElementOpen(document.querySelector("#layout-presets"));
  }

  async function prepareForStandardDialog(): Promise<void> {
    if (actions.isSiteManagerOpen()) {
      await actions.closeSiteManager();
    }

    if (actions.isOnboardingOpen()) {
      await actions.closeOnboarding(true);
    }

    if (actions.isTargetContextMenuOpen()) {
      actions.closeTargetContextMenu();
    }
  }

  async function openLayoutPresets(): Promise<void> {
    const modal = document.querySelector("#layout-presets");
    if (!modal) {
      return;
    }

    await prepareForStandardDialog();

    if (actions.isLayoutPresetMenuOpen()) {
      await actions.closeLayoutPresetMenu();
    }
    if (actions.isLayoutPresetDropdownOpen()) {
      await actions.closeLayoutPresetDropdown();
    }

    showModalElement(modal);
    actions.renderLayoutPresets();
    actions.syncCompactBarHeight();
    await actions.syncVisibleWebviews();
    await actions.syncVisibleToolbarWebviews();
    await actions.refreshLayout(1);
  }

  async function closeLayoutPresets(): Promise<void> {
    const modal = document.querySelector("#layout-presets");
    if (!hideModalElement(modal)) {
      return;
    }

    await actions.refreshLayout();
  }

  async function openAbout(): Promise<void> {
    const modal = document.querySelector("#about-dialog");
    if (!modal) {
      return;
    }

    await prepareForStandardDialog();

    showModalElement(modal);
    await actions.syncVisibleWebviews();
    await actions.syncVisibleToolbarWebviews();

    const closeButton = document.querySelector("#close-about");
    focusElementOnNextFrame(closeButton, requestAnimationFrame);
  }

  async function closeAbout(): Promise<void> {
    const modal = document.querySelector("#about-dialog");
    if (!hideModalElement(modal)) {
      return;
    }

    await actions.refreshLayout();
  }

  return {
    isAboutOpen,
    isLayoutPresetsOpen,
    openLayoutPresets,
    closeLayoutPresets,
    openAbout,
    closeAbout,
  };
}
