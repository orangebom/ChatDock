import { focusElementOnNextFrame, hideModalElement, showModalElement } from "./dialogs-dom.ts";

interface QueryableDocument {
  querySelector(selector: string): any;
}

type RequestAnimationFrameLike = (callback: () => void) => unknown;

interface CloseConfirmState {
  open: boolean;
  resolver: ((accepted: boolean) => void) | null;
}

interface CloseConfirmActions {
  isSiteManagerOpen(): boolean;
  closeSiteManager(): Promise<void>;
  isOnboardingOpen(): boolean;
  closeOnboarding(markCompleted?: boolean): Promise<void>;
  syncVisibleWebviews(): Promise<void>;
  syncVisibleToolbarWebviews(): Promise<void>;
  refreshLayout(): Promise<void>;
}

export function createCloseConfirmController({
  document,
  requestAnimationFrame,
  state,
  actions,
}: {
  document: QueryableDocument;
  requestAnimationFrame: RequestAnimationFrameLike;
  state: CloseConfirmState;
  actions: CloseConfirmActions;
}) {
  async function show(): Promise<boolean> {
    const modal = document.querySelector("#close-confirm");
    if (!modal) {
      return true;
    }

    if (state.open) {
      return new Promise((resolve) => {
        const previousResolver = state.resolver;
        state.resolver = (result) => {
          previousResolver?.(result);
          resolve(result);
        };
      });
    }

    if (actions.isSiteManagerOpen()) {
      await actions.closeSiteManager();
    }

    if (actions.isOnboardingOpen()) {
      await actions.closeOnboarding(true);
    }

    state.open = true;
    showModalElement(modal);
    await actions.syncVisibleWebviews();
    await actions.syncVisibleToolbarWebviews();

    const acceptButton = document.querySelector("#accept-close-confirm");
    focusElementOnNextFrame(acceptButton, requestAnimationFrame);

    return new Promise((resolve) => {
      state.resolver = resolve;
    });
  }

  async function resolve(accepted: boolean): Promise<void> {
    const modal = document.querySelector("#close-confirm");
    if (!modal || !state.open) {
      return;
    }

    hideModalElement(modal);
    state.open = false;
    const resolver = state.resolver;
    state.resolver = null;
    resolver?.(accepted);
    await actions.refreshLayout();
  }

  return {
    show,
    resolve,
    isOpen: () => state.open === true,
  };
}
