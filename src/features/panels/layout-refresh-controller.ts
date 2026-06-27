interface LayoutRefreshState {
  relayoutVersion: number;
  layoutRefreshToken: number;
  layoutRefreshTimers: unknown[];
}

interface TimerApi {
  setTimeout(handler: () => void, delay: number): unknown;
  clearTimeout(timer: unknown): void;
}

interface LayoutRefreshActions {
  syncCompactBarHeight(): void;
  hasUsableGridSize(): boolean;
  applyLayout(): void;
  isAnyOverlayOpen(): boolean;
  syncVisibleWebviews(): Promise<void>;
  syncVisibleToolbarWebviews(): Promise<void>;
  isOnboardingOpen(): boolean;
  renderOnboardingStep(): void;
  ensureTargetsReady(targetLabels: string[], shouldShow: boolean): Promise<void>;
  ensureToolbarTargetsReady(targetLabels: string[], shouldShow: boolean): Promise<void>;
  getVisibleTargets(): string[];
  syncToolbarStates(): Promise<void>;
  relayoutWebviews(): Promise<void>;
  relayoutToolbarWebviews(): Promise<void>;
  sleep(ms: number): Promise<void>;
}

export function createLayoutRefreshController({
  state,
  timerApi,
  actions,
}: {
  state: LayoutRefreshState;
  timerApi: TimerApi;
  actions: LayoutRefreshActions;
}) {
  async function settle(passes = 3): Promise<void> {
    const version = ++state.relayoutVersion;
    const delays = [0, 120, 260];

    for (let index = 0; index < passes; index += 1) {
      const delay = delays[index] ?? 260;
      if (delay > 0) {
        await actions.sleep(delay);
      }
      if (version !== state.relayoutVersion) {
        return;
      }
      await actions.relayoutWebviews();
      await actions.relayoutToolbarWebviews();
    }
  }

  async function refresh(passes = 3): Promise<void> {
    actions.syncCompactBarHeight();
    if (!actions.hasUsableGridSize()) {
      return;
    }
    actions.applyLayout();
    if (actions.isAnyOverlayOpen()) {
      await actions.syncVisibleWebviews();
      await actions.syncVisibleToolbarWebviews();
      if (actions.isOnboardingOpen()) {
        actions.renderOnboardingStep();
      }
      return;
    }
    await actions.ensureTargetsReady(actions.getVisibleTargets(), true);
    await actions.ensureToolbarTargetsReady(actions.getVisibleTargets(), true);
    await actions.syncVisibleWebviews();
    await actions.syncVisibleToolbarWebviews();
    await actions.syncToolbarStates();
    await settle(passes);
  }

  function clearScheduled(): void {
    for (const timer of state.layoutRefreshTimers) {
      timerApi.clearTimeout(timer);
    }
    state.layoutRefreshTimers = [];
  }

  function schedule(reason = "layout", delays = [0, 80, 180, 320, 520]): void {
    const token = ++state.layoutRefreshToken;
    clearScheduled();

    state.layoutRefreshTimers = delays.map((delay) =>
      timerApi.setTimeout(() => {
        if (token !== state.layoutRefreshToken) {
          return;
        }
        if (!actions.hasUsableGridSize()) {
          return;
        }
        void refresh(reason === "window-state" ? 4 : 3);
      }, delay)
    );
  }

  return {
    settle,
    refresh,
    clearScheduled,
    schedule,
  };
}
