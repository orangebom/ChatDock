interface SiteLike {
  label: string;
  title: string;
  accentColor: string;
}

interface DocumentLike {
  createElement(tagName: "button"): HTMLButtonElement;
  createElement(tagName: string): HTMLElement;
}

interface ManagerItemOptions {
  document: DocumentLike;
  site: SiteLike;
  visible: boolean;
  createDot(color: string): Node;
  createDragHandle(): Node;
  onAdd(label: string): Promise<void> | void;
  onRemove(label: string): Promise<void> | void;
}

interface RenderSiteManagerListsOptions {
  visibleContainer: HTMLElement;
  hiddenContainer: HTMLElement;
  visibleCount: HTMLElement;
  hiddenCount: HTMLElement;
  visibleSites: SiteLike[];
  hiddenSites: SiteLike[];
  createItem(site: SiteLike, visible: boolean): Node;
}

export function createManagerItem({
  document,
  site,
  visible,
  createDot,
  createDragHandle,
  onAdd,
  onRemove,
}: ManagerItemOptions): HTMLElement {
  const item = document.createElement("div");
  item.className = "manager-item";
  item.dataset.siteLabel = site.label;

  const main = document.createElement("div");
  main.className = "manager-item-main";
  main.append(createDot(site.accentColor));

  const meta = document.createElement("div");
  meta.className = "manager-item-meta";

  const title = document.createElement("span");
  title.className = "manager-item-title";
  title.textContent = site.title;

  const label = document.createElement("span");
  label.className = "manager-item-label";
  label.textContent = site.label;

  meta.append(title, label);
  main.append(meta);

  const actions = document.createElement("div");
  actions.className = "manager-actions";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "mini-button";

  if (visible) {
    actions.append(createDragHandle());
    button.textContent = "移除";
    button.addEventListener("click", async () => {
      await onRemove(site.label);
    });
  } else {
    button.textContent = "添加";
    button.addEventListener("click", async () => {
      await onAdd(site.label);
    });
  }

  actions.append(button);
  item.append(main, actions);
  return item;
}

export function renderSiteManagerLists({
  visibleContainer,
  hiddenContainer,
  visibleCount,
  hiddenCount,
  visibleSites,
  hiddenSites,
  createItem,
}: RenderSiteManagerListsOptions): void {
  visibleContainer.innerHTML = "";
  hiddenContainer.innerHTML = "";

  visibleCount.textContent = `${visibleSites.length} 个`;
  hiddenCount.textContent = `${hiddenSites.length} 个`;

  for (const site of visibleSites) {
    visibleContainer.appendChild(createItem(site, true));
  }

  for (const site of hiddenSites) {
    hiddenContainer.appendChild(createItem(site, false));
  }
}
