import type { SiteConfig } from "../types/domain";

export const PANEL_TOOLBAR_ROUTE = "/panel-toolbar.html";

export function getToolbarLabel(siteLabel: string): string {
  return `${siteLabel}-toolbar`;
}

export function buildToolbarUrl(site: Pick<SiteConfig, "label" | "title" | "accentColor">): string {
  const params = new URLSearchParams({
    site: site.label,
    title: site.title,
    accent: site.accentColor,
  });
  return `${PANEL_TOOLBAR_ROUTE}?${params.toString()}`;
}

export function shouldKeepWebviewVisible(shouldShow: boolean, currentlyVisible: boolean): boolean {
  return shouldShow || currentlyVisible;
}

interface PhysicalMetricsLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function buildToolbarWebviewOptions(
  url: string,
  metrics: PhysicalMetricsLike | null | undefined,
  toolbarHeight: number,
) {
  return {
    url,
    x: metrics?.x ?? 0,
    y: metrics?.y ?? 0,
    width: metrics?.width ?? 1200,
    height: metrics?.height ?? toolbarHeight,
    zoomHotkeysEnabled: false,
    generalAutofillEnabled: false,
    devtools: false,
  };
}

export function buildPanelWebviewOptions(
  site: Pick<SiteConfig, "url" | "dataDirectory">,
  metrics: PhysicalMetricsLike | null | undefined,
) {
  return {
    url: site.url,
    x: metrics?.x ?? 0,
    y: metrics?.y ?? 0,
    width: metrics?.width ?? 1200,
    height: metrics?.height ?? 800,
    dataDirectory: site.dataDirectory,
    zoomHotkeysEnabled: false,
    generalAutofillEnabled: true,
    devtools: true,
  };
}

export function buildPanelToolbarState(
  site: Pick<SiteConfig, "label" | "title" | "accentColor">,
  theme: string,
  maximized: boolean,
) {
  return {
    site: site.label,
    title: site.title,
    accent: site.accentColor,
    theme,
    maximized,
  };
}

interface WebviewLike {
  hide(): Promise<void>;
  show(): Promise<void>;
  setAutoResize(value: boolean): Promise<void>;
  setPosition(position: unknown): Promise<void>;
  setSize(size: unknown): Promise<void>;
}

interface WebviewConstructor<TWebview extends WebviewLike> {
  new (appWindow: unknown, label: string, options: unknown): TWebview;
}

interface ControllerMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ControllerSite {
  label: string;
  url?: string;
  title?: string;
  accentColor?: string;
  dataDirectory?: string;
}

interface PanelWebviewControllerOptions<TWebview extends WebviewLike> {
  appWindow: unknown;
  Webview: WebviewConstructor<TWebview>;
  cache: Map<string, TWebview>;
  pending: Map<string, Promise<TWebview>>;
  getByLabel(label: string): Promise<TWebview | null | undefined>;
  waitForWebview(label: string): Promise<TWebview>;
  getSite(label: string): ControllerSite | null | undefined;
  getMetrics(label: string): Promise<ControllerMetrics | null | undefined>;
  buildOptions(site: ControllerSite, metrics: ControllerMetrics | null | undefined): unknown;
  shouldKeepVisible(shouldShow: boolean, label: string): boolean;
  createPosition(x: number, y: number): unknown;
  createSize(width: number, height: number): unknown;
  onCreated?(site: ControllerSite, webview: TWebview): void;
  onError?(site: ControllerSite, event: unknown): void;
  afterEnsure?(label: string, webview: TWebview): Promise<void>;
}

async function applyMetrics<TWebview extends WebviewLike>(
  webview: TWebview,
  metrics: ControllerMetrics,
  createPosition: (x: number, y: number) => unknown,
  createSize: (width: number, height: number) => unknown,
): Promise<void> {
  await webview.setPosition(createPosition(metrics.x, metrics.y));
  await webview.setSize(createSize(metrics.width, metrics.height));
}

export function createPanelWebviewController<TWebview extends WebviewLike>(
  options: PanelWebviewControllerOptions<TWebview>,
) {
  async function ensure(label: string, shouldShow = true): Promise<TWebview | null> {
    const site = options.getSite(label);
    if (!site) {
      return null;
    }

    if (options.pending.has(label)) {
      const pending = options.pending.get(label);
      if (!pending) {
        return null;
      }
      const current = await pending;
      if (options.shouldKeepVisible(shouldShow, label)) {
        await current.show();
      } else {
        await current.hide();
      }
      return current;
    }

    const createPromise = (async () => {
      let current = options.cache.get(label) || (await options.getByLabel(label));
      const metrics = await options.getMetrics(label);

      if (!current) {
        const webviewInstance = new options.Webview(
          options.appWindow,
          label,
          options.buildOptions(site, metrics),
        );
        options.onCreated?.(site, webviewInstance);
        current = await options.waitForWebview(label);
      }

      await current.setAutoResize(false);
      if (metrics) {
        await applyMetrics(current, metrics, options.createPosition, options.createSize);
      }

      if (options.shouldKeepVisible(shouldShow, label) && metrics) {
        await current.show();
      } else if (!metrics || !options.shouldKeepVisible(shouldShow, label)) {
        await current.hide();
      }

      await options.afterEnsure?.(label, current);
      options.cache.set(label, current);
      return current;
    })();

    options.pending.set(label, createPromise);
    try {
      return await createPromise;
    } finally {
      options.pending.delete(label);
    }
  }

  async function ensureMany(labels: string[], shouldShow = false): Promise<void> {
    const uniqueLabels = [...new Set(labels)].filter((label) => options.getSite(label));
    await Promise.all(uniqueLabels.map((label) => ensure(label, shouldShow)));
  }

  async function relayout(
    sites: ControllerSite[],
    visibleTargets: Set<string>,
    shouldSuppress = false,
  ): Promise<void> {
    for (const site of sites) {
      const current = options.cache.get(site.label) || (await options.getByLabel(site.label));
      if (!current) {
        continue;
      }

      const metrics = await options.getMetrics(site.label);
      if (!metrics || !visibleTargets.has(site.label) || shouldSuppress) {
        await current.hide();
        continue;
      }

      await applyMetrics(current, metrics, options.createPosition, options.createSize);
      await current.show();
    }
  }

  async function syncVisible(
    sites: ControllerSite[],
    visibleTargets: Set<string>,
    shouldSuppress: boolean,
    isPanelVisible: (label: string) => boolean,
    getLabel: (site: ControllerSite) => string = (site) => site.label,
  ): Promise<void> {
    for (const site of sites) {
      const label = getLabel(site);
      const current = options.cache.get(label) || (await options.getByLabel(label));
      if (!current) {
        continue;
      }

      if (!shouldSuppress && visibleTargets.has(site.label) && isPanelVisible(site.label)) {
        await current.show();
      } else {
        await current.hide();
      }
    }
  }

  return {
    ensure,
    ensureMany,
    relayout,
    syncVisible,
  };
}
