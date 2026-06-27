interface SiteLike {
  label: string;
}

interface DocumentLike {
  createElement(tagName: "article"): HTMLElement;
  createElement(tagName: string): HTMLElement;
}

interface RectLike {
  left: number;
  top: number;
  width: number;
  height?: number;
}

export function createPanelShell(document: DocumentLike, site: SiteLike): HTMLElement {
  const article = document.createElement("article");
  article.className = "panel-shell";
  article.dataset.panel = site.label;

  const body = document.createElement("div");
  body.className = "panel-body";
  body.dataset.webviewHost = site.label;

  article.append(body);
  return article;
}

export function renderPanelShells({
  document,
  layer,
  sites,
}: {
  document: DocumentLike;
  layer: HTMLElement;
  sites: SiteLike[];
}): void {
  layer.innerHTML = "";

  for (const site of sites) {
    layer.appendChild(createPanelShell(document, site));
  }
}

export function getPaneMetricsFromRect(rect: Required<RectLike>, toolbarHeight: number) {
  return {
    x: rect.left,
    y: rect.top + toolbarHeight,
    width: rect.width,
    height: Math.max(0, rect.height - toolbarHeight),
  };
}

export function getToolbarMetricsFromRect(rect: RectLike, toolbarHeight: number) {
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: toolbarHeight,
  };
}
