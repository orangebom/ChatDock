import { hideModalElement, isModalElementOpen, showModalElement } from "../dialogs/dialogs-dom.ts";

interface QueryableDocument {
  querySelector(selector: string): any;
}

interface SortableLike {
  destroy(): void;
}

interface SortableFactory {
  create(element: unknown, options: Record<string, unknown>): SortableLike;
}

interface SiteManagerState {
  sortables: SortableLike[];
}

interface SiteManagerActions {
  createManagerItem(site: unknown, visible: boolean): unknown;
  getVisibleManagedSites(): unknown[];
  getHiddenManagedSites(): unknown[];
  renderLists(payload: Record<string, unknown>): void;
  syncCompactBarHeight(): void;
  syncVisibleWebviews(): Promise<void>;
  syncVisibleToolbarWebviews(): Promise<void>;
  refreshLayout(passes?: number): Promise<void>;
  persistWorkspace(): void;
  renderWorkspace(): void;
  syncVisibleSiteOrder(workspace: unknown, reorderedVisible: string[]): boolean;
  workspace?: unknown;
}

export function createSiteManagerController({
  document,
  Sortable,
  state,
  actions,
}: {
  document: QueryableDocument;
  Sortable: SortableFactory;
  state: SiteManagerState;
  actions: SiteManagerActions;
}) {
  function isOpen(): boolean {
    return isModalElementOpen(document.querySelector("#site-manager"));
  }

  function render(): void {
    const visibleContainer = document.querySelector("#visible-sites");
    const hiddenContainer = document.querySelector("#hidden-sites");
    const visibleCount = document.querySelector("#visible-sites-count");
    const hiddenCount = document.querySelector("#hidden-sites-count");
    if (!visibleContainer || !hiddenContainer || !visibleCount || !hiddenCount) {
      return;
    }

    actions.renderLists({
      visibleContainer,
      hiddenContainer,
      visibleCount,
      hiddenCount,
      visibleSites: actions.getVisibleManagedSites(),
      hiddenSites: actions.getHiddenManagedSites(),
      createItem: actions.createManagerItem,
    });
  }

  function destroySortables(): void {
    for (const sortable of state.sortables) {
      sortable.destroy();
    }
    state.sortables = [];
  }

  function syncVisibleSitesFromDom(containerSelector: string): boolean {
    const container = document.querySelector(containerSelector);
    if (!container) {
      return false;
    }
    const reorderedVisible = [...container.querySelectorAll("[data-site-label]")]
      .map((node: any) => node.dataset.siteLabel)
      .filter(Boolean);
    if (!reorderedVisible.length) {
      return false;
    }

    if (!actions.syncVisibleSiteOrder(actions.workspace, reorderedVisible)) {
      return false;
    }
    actions.persistWorkspace();
    return true;
  }

  function initSortableTargets(): void {
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
              actions.renderWorkspace();
              await actions.refreshLayout();
            } else {
              actions.renderWorkspace();
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
              actions.renderWorkspace();
              await actions.refreshLayout();
            } else {
              actions.renderWorkspace();
            }
          },
        }),
      );
    }
  }

  async function open(): Promise<void> {
    const modal = document.querySelector("#site-manager");
    if (!showModalElement(modal)) {
      return;
    }
    render();
    initSortableTargets();
    actions.syncCompactBarHeight();
    await actions.syncVisibleWebviews();
    await actions.syncVisibleToolbarWebviews();
    await actions.refreshLayout(1);
  }

  async function close(): Promise<void> {
    const modal = document.querySelector("#site-manager");
    if (!hideModalElement(modal)) {
      return;
    }
    await actions.refreshLayout();
  }

  return {
    isOpen,
    render,
    destroySortables,
    syncVisibleSitesFromDom,
    initSortableTargets,
    open,
    close,
  };
}
