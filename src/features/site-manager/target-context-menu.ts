import { clamp } from "../../geometry.js";
import type { SiteConfig } from "../../types/domain";

interface QueryableDocument {
  querySelector(selector: string): any;
}

interface WindowViewport {
  innerWidth: number;
  innerHeight: number;
}

interface TargetContextMenuState {
  open: boolean;
  siteLabel: string | null;
  x: number;
  y: number;
}

interface TargetContextMenuActions {
  getSiteMeta(label: string): Pick<SiteConfig, "title"> | null | undefined;
  syncVisibleWebviews(): Promise<void>;
  syncVisibleToolbarWebviews(): Promise<void>;
}

export function createTargetContextMenuController({
  document,
  window,
  state,
  actions,
}: {
  document: QueryableDocument;
  window: WindowViewport;
  state: TargetContextMenuState;
  actions: TargetContextMenuActions;
}) {
  const findPill = (siteLabel: string | null) =>
    siteLabel ? document.querySelector(`.target-pill[data-site-label="${siteLabel}"]`) : null;

  function getState(): TargetContextMenuState {
    return state;
  }

  function position(): void {
    const shell = document.querySelector("#target-context-menu");
    const menu = shell?.querySelector(".context-menu");
    if (!shell || !menu || shell.hidden) {
      return;
    }

    const padding = 10;
    const width = menu.offsetWidth || 156;
    const height = menu.offsetHeight || 94;
    const left = clamp(state.x, padding, Math.max(padding, window.innerWidth - width - padding));
    const top = clamp(state.y, padding, Math.max(padding, window.innerHeight - height - padding));

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function close(): void {
    const shell = document.querySelector("#target-context-menu");
    const menu = shell?.querySelector(".context-menu");
    const activePill = findPill(state.siteLabel);

    shell && (shell.hidden = true);
    menu?.style.removeProperty("left");
    menu?.style.removeProperty("top");
    activePill?.classList.remove("context-open");

    state.open = false;
    state.siteLabel = null;
    state.x = 0;
    state.y = 0;
    void actions.syncVisibleWebviews();
    void actions.syncVisibleToolbarWebviews();
  }

  function open(siteLabel: string, x: number, y: number): void {
    const site = actions.getSiteMeta(siteLabel);
    const shell = document.querySelector("#target-context-menu");
    const title = document.querySelector("#target-context-title");
    if (!site || !shell || !title) {
      return;
    }

    findPill(state.siteLabel)?.classList.remove("context-open");

    state.open = true;
    state.siteLabel = siteLabel;
    state.x = x;
    state.y = y;

    title.textContent = `${site.title} 操作`;
    shell.hidden = false;

    findPill(siteLabel)?.classList.add("context-open");

    position();
    void actions.syncVisibleWebviews();
    void actions.syncVisibleToolbarWebviews();
  }

  return {
    getState,
    close,
    position,
    open,
    isOpen: () => Boolean(document.querySelector("#target-context-menu") && !document.querySelector("#target-context-menu").hidden),
  };
}
