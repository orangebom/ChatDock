interface QueryableDocument {
  querySelector(selector: string): any;
}

interface OverlayFacade {
  ensure(): Promise<unknown>;
  hide(): Promise<void>;
  position(): Promise<void>;
  sync(): Promise<void>;
  show(): Promise<unknown>;
}

interface LayoutPresetOverlayState {
  layoutPresets: unknown;
  layoutPresetDropdown: { open: boolean };
  layoutPresetMenu: { open: boolean };
}

interface LayoutPresetOverlayActions {
  isTargetContextMenuOpen(): boolean;
  closeTargetContextMenu(): void;
}

export function createLayoutPresetOverlayController({
  document,
  state,
  overlays,
  actions,
}: {
  document: QueryableDocument;
  state: LayoutPresetOverlayState;
  overlays: {
    dropdown: OverlayFacade;
    menu: OverlayFacade;
  };
  actions: LayoutPresetOverlayActions;
}) {
  async function closeDropdown(): Promise<void> {
    await overlays.dropdown.hide();
    const trigger = document.querySelector("#layout-preset-select");
    state.layoutPresetDropdown.open = false;
    trigger?.setAttribute("aria-expanded", "false");
  }

  async function closeMenu(): Promise<void> {
    const shell = document.querySelector("#layout-preset-menu");
    shell?.setAttribute("hidden", "");
    await overlays.menu.hide();
    state.layoutPresetMenu.open = false;
  }

  async function openDropdown(): Promise<void> {
    const trigger = document.querySelector("#layout-preset-select");
    if (!trigger || !state.layoutPresets) {
      return;
    }

    if (actions.isTargetContextMenuOpen()) {
      actions.closeTargetContextMenu();
    }
    if (state.layoutPresetMenu.open) {
      await closeMenu();
    }

    state.layoutPresetDropdown.open = true;
    trigger.setAttribute("aria-expanded", "true");

    await overlays.dropdown.show();
  }

  async function openMenu(): Promise<void> {
    const trigger = document.querySelector("#layout-preset-more");
    if (!trigger) {
      return;
    }

    const shell = document.querySelector("#layout-preset-menu");
    shell?.setAttribute("hidden", "");

    if (actions.isTargetContextMenuOpen()) {
      actions.closeTargetContextMenu();
    }
    if (state.layoutPresetDropdown.open) {
      await closeDropdown();
    }

    state.layoutPresetMenu.open = true;

    await overlays.menu.show();
  }

  return {
    ensureDropdown: overlays.dropdown.ensure,
    ensureMenu: overlays.menu.ensure,
    positionDropdown: overlays.dropdown.position,
    positionMenu: overlays.menu.position,
    syncDropdown: overlays.dropdown.sync,
    syncMenu: overlays.menu.sync,
    hideDropdown: closeDropdown,
    hideMenu: closeMenu,
    closeDropdown,
    closeMenu,
    openDropdown,
    openMenu,
    isMenuOpen: () => state.layoutPresetMenu.open === true,
    isDropdownOpen: () => state.layoutPresetDropdown.open === true,
  };
}
