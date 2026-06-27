interface AppWindowLayoutEventSource {
  onResized(handler: () => void | Promise<void>): Promise<unknown>;
  onScaleChanged(handler: () => void | Promise<void>): Promise<unknown>;
  onFocusChanged(handler: (event: { payload: boolean }) => void | Promise<void>): Promise<unknown>;
}

interface WindowLayoutEventActions {
  scheduleLayoutRefresh(reason: string, delays?: number[]): void;
  isLayoutPresetMenuOpen(): boolean;
  isLayoutPresetDropdownOpen(): boolean;
  positionLayoutPresetMenuWebview(): Promise<void>;
  positionLayoutPresetDropdownWebview(): Promise<void>;
  onError(error: unknown): void;
}

async function repositionLayoutPresetOverlays(actions: WindowLayoutEventActions): Promise<void> {
  if (actions.isLayoutPresetMenuOpen()) {
    await actions.positionLayoutPresetMenuWebview();
  }
  if (actions.isLayoutPresetDropdownOpen()) {
    await actions.positionLayoutPresetDropdownWebview();
  }
}

export async function wireWindowLayoutEvents({
  appWindow,
  actions,
}: {
  appWindow: AppWindowLayoutEventSource;
  actions: WindowLayoutEventActions;
}): Promise<void> {
  await appWindow.onResized(async () => {
    actions.scheduleLayoutRefresh("window-state", [0, 120, 260, 460, 720]);
    try {
      await repositionLayoutPresetOverlays(actions);
    } catch (error) {
      actions.onError(error);
    }
  });

  await appWindow.onScaleChanged(async () => {
    actions.scheduleLayoutRefresh("scale-change", [0, 120, 260, 460, 720]);
    try {
      await repositionLayoutPresetOverlays(actions);
    } catch (error) {
      actions.onError(error);
    }
  });

  await appWindow.onFocusChanged(async ({ payload: focused }) => {
    if (!focused) {
      return;
    }

    actions.scheduleLayoutRefresh("focus-return", [0, 120, 260]);
    try {
      await repositionLayoutPresetOverlays(actions);
    } catch (error) {
      actions.onError(error);
    }
  });
}
