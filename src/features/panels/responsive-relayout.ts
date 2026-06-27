interface QueryableDocument {
  querySelector(selector: string): Element | null;
}

interface EventWindowLike {
  addEventListener(type: "resize", handler: () => void): void;
}

interface ResizeObserverLike {
  observe(element: Element): void;
  disconnect(): void;
}

interface ResizeObserverConstructorLike {
  new (callback: () => void): ResizeObserverLike;
}

interface ResponsiveRelayoutState {
  resizeObserver?: ResizeObserverLike | null;
  compactBarObserver?: ResizeObserverLike | null;
}

interface ResponsiveRelayoutActions {
  scheduleLayoutRefresh(reason: string, delays?: number[]): void;
  syncCompactBarHeight(): boolean;
  isOnboardingOpen(): boolean;
  renderOnboardingStep(): void;
  isTargetContextMenuOpen(): boolean;
  positionTargetContextMenu(): void;
  isLayoutPresetMenuOpen(): boolean;
  positionLayoutPresetMenuWebview(): Promise<void>;
  isLayoutPresetDropdownOpen(): boolean;
  positionLayoutPresetDropdownWebview(): Promise<void>;
}

export function wireResponsiveRelayout({
  document,
  window,
  ResizeObserver,
  state,
  actions,
}: {
  document: QueryableDocument;
  window: EventWindowLike;
  ResizeObserver?: ResizeObserverConstructorLike;
  state: ResponsiveRelayoutState;
  actions: ResponsiveRelayoutActions;
}): void {
  const grid = document.querySelector(".grid-preview");
  if (ResizeObserver && grid) {
    state.resizeObserver?.disconnect?.();
    state.resizeObserver = new ResizeObserver(() => {
      actions.scheduleLayoutRefresh("container-resize", [0, 90, 220, 420]);
    });
    state.resizeObserver.observe(grid);
  }

  const compactBar = document.querySelector(".compact-bar");
  if (ResizeObserver && compactBar) {
    state.compactBarObserver?.disconnect?.();
    state.compactBarObserver = new ResizeObserver(() => {
      if (actions.syncCompactBarHeight()) {
        actions.scheduleLayoutRefresh("compact-bar-resize", [0, 90, 220, 420]);
      }
    });
    state.compactBarObserver.observe(compactBar);
  }

  window.addEventListener("resize", () => {
    actions.scheduleLayoutRefresh("window-resize", [0, 100, 240, 420]);
    if (actions.isOnboardingOpen()) {
      actions.renderOnboardingStep();
    }
    if (actions.isTargetContextMenuOpen()) {
      actions.positionTargetContextMenu();
    }
    if (actions.isLayoutPresetMenuOpen()) {
      void actions.positionLayoutPresetMenuWebview();
    }
    if (actions.isLayoutPresetDropdownOpen()) {
      void actions.positionLayoutPresetDropdownWebview();
    }
  });
}
