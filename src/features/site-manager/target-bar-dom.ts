interface SiteLike {
  label: string;
  title: string;
  accentColor: string;
}

interface DocumentLike {
  createElement(tagName: "button"): HTMLButtonElement;
  createElement(tagName: "input"): HTMLInputElement;
  createElement(tagName: "label"): HTMLLabelElement;
  createElement(tagName: string): HTMLElement;
}

interface RenderPageTabsOptions {
  document: DocumentLike;
  container: HTMLElement;
  pageCount: number;
  activePageIndex: number;
  selectedCount: number;
  maxSitesPerPage: number;
  selectedPrefix: string;
  getPageLabels(pageIndex: number): string[];
  onPageChange(pageIndex: number): Promise<void> | void;
}

interface RenderTargetBarOptions {
  document: DocumentLike;
  container: HTMLElement;
  sites: SiteLike[];
  selectedLabels: string[];
  contextMenu: {
    open: boolean;
    siteLabel: string | null;
  };
  getAvailability(label: string): { message?: string } | null | undefined;
  isUnavailable(label: string): boolean;
  createDot(color: string): Node;
  onContextMenu(label: string, x: number, y: number): void;
  onSelectionChange(label: string, selected: boolean): Promise<void> | void;
}

export function renderPageTabs({
  document,
  container,
  pageCount,
  activePageIndex,
  selectedCount,
  maxSitesPerPage,
  selectedPrefix,
  getPageLabels,
  onPageChange,
}: RenderPageTabsOptions): void {
  container.innerHTML = "";

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageLabels = getPageLabels(pageIndex);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `page-tab${pageIndex === activePageIndex ? " active" : ""}`;
    button.textContent = `第 ${pageIndex + 1} 页`;
    button.title = `${pageLabels.length || 0}/${maxSitesPerPage} 个 AI`;
    button.addEventListener("click", async () => {
      if (activePageIndex === pageIndex) {
        return;
      }
      await onPageChange(pageIndex);
    });
    container.appendChild(button);
  }

  const counter = document.createElement("span");
  counter.className = "page-counter";
  counter.textContent = `${selectedPrefix} ${selectedCount}`;
  container.appendChild(counter);
}

export function renderTargetBar({
  document,
  container,
  sites,
  selectedLabels,
  contextMenu,
  getAvailability,
  isUnavailable,
  createDot,
  onContextMenu,
  onSelectionChange,
}: RenderTargetBarOptions): void {
  const selected = new Set(selectedLabels);
  container.innerHTML = "";

  for (const site of sites) {
    const isSelected = selected.has(site.label);
    const selectedIndex = selectedLabels.indexOf(site.label);
    const availability = getAvailability(site.label);
    const unavailable = isUnavailable(site.label);
    const pill = document.createElement("label");
    pill.className = `target-pill${isSelected ? " active" : ""}${unavailable ? " unavailable" : ""}`;
    pill.dataset.siteLabel = site.label;
    if (contextMenu.open && contextMenu.siteLabel === site.label) {
      pill.classList.add("context-open");
    }
    if (unavailable) {
      pill.title = availability?.message || "不可访问";
      pill.setAttribute("aria-label", `${site.title}，${availability?.message || "不可访问"}`);
    }

    pill.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      onContextMenu(site.label, event.clientX, event.clientY);
    });

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = isSelected;
    input.value = site.label;
    input.addEventListener("change", async () => {
      await onSelectionChange(site.label, input.checked);
    });

    pill.append(input, createDot(site.accentColor));

    if (isSelected) {
      const order = document.createElement("span");
      order.className = "target-order";
      order.textContent = String(selectedIndex + 1);
      pill.append(order);
    }

    const text = document.createElement("span");
    text.textContent = site.title;
    pill.append(text);
    container.appendChild(pill);
  }
}
