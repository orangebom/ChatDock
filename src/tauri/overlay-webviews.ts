interface OverlayMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OverlayFallbackSize {
  width: number;
  height: number;
}

interface LayoutPresetLike {
  id: string;
  name: string;
}

interface LayoutPresetStateLike {
  activePresetId?: string;
  items?: LayoutPresetLike[];
}

export interface OverlayWebviewOptions extends OverlayMetrics {
  url: string;
  transparent: true;
  focus: false;
  dragDropEnabled: false;
  zoomHotkeysEnabled: false;
  generalAutofillEnabled: false;
  devtools: false;
}

export function buildOverlayWebviewOptions(
  url: string,
  metrics: OverlayMetrics | null | undefined,
  fallbackSize: OverlayFallbackSize = { width: 180, height: 96 },
): OverlayWebviewOptions {
  return {
    url,
    x: metrics?.x ?? 0,
    y: metrics?.y ?? 0,
    width: metrics?.width ?? fallbackSize.width,
    height: metrics?.height ?? fallbackSize.height,
    transparent: true,
    focus: false,
    dragDropEnabled: false,
    zoomHotkeysEnabled: false,
    generalAutofillEnabled: false,
    devtools: false,
  };
}

export function buildLayoutPresetDropdownState(
  theme: string,
  layoutPresets: LayoutPresetStateLike | null | undefined,
) {
  return {
    theme,
    activePresetId: layoutPresets?.activePresetId || "",
    presets: (layoutPresets?.items || []).map((preset) => ({
      id: preset.id,
      name: preset.name,
    })),
  };
}

export function buildLayoutPresetMenuState(theme: string) {
  return { theme };
}

export function shouldSyncOverlayState(webviewInstance: unknown, isOpen: boolean): boolean {
  return Boolean(webviewInstance || isOpen);
}

interface OverlayWebviewLike {
  hide(): Promise<void>;
  show(): Promise<void>;
  setFocus(): Promise<void>;
  setAutoResize(value: boolean): Promise<void>;
  setPosition(position: unknown): Promise<void>;
  setSize(size: unknown): Promise<void>;
}

interface OverlayWebviewConstructor<TWebview extends OverlayWebviewLike> {
  new (appWindow: unknown, label: string, options: OverlayWebviewOptions): TWebview;
}

interface OverlayWebviewControllerOptions<TWebview extends OverlayWebviewLike> {
  appWindow: unknown;
  Webview: OverlayWebviewConstructor<TWebview>;
  label: string;
  route: string;
  fallbackSize: OverlayFallbackSize;
  getCached(): TWebview | null | undefined;
  setCached(webview: TWebview): void;
  getByLabel(label: string): Promise<TWebview | null | undefined>;
  waitForWebview(label: string): Promise<TWebview>;
  getMetrics(): OverlayMetrics | null | undefined;
  toPhysicalMetrics(metrics: OverlayMetrics | null | undefined): Promise<OverlayMetrics | null | undefined>;
  isOpen(): boolean;
  onHide?(): void;
  createPosition(x: number, y: number): unknown;
  createSize(width: number, height: number): unknown;
  emitTo(label: string, eventName: string, payload: unknown): Promise<unknown>;
  eventName: string;
  getPayload(): unknown;
}

export function createOverlayWebviewController<TWebview extends OverlayWebviewLike>(
  options: OverlayWebviewControllerOptions<TWebview>,
) {
  async function getExistingWebview(): Promise<TWebview | null | undefined> {
    return options.getCached() || (await options.getByLabel(options.label));
  }

  async function ensure(): Promise<TWebview> {
    let current = await getExistingWebview();
    const metrics = await options.toPhysicalMetrics(options.getMetrics());

    if (!current) {
      new options.Webview(
        options.appWindow,
        options.label,
        buildOverlayWebviewOptions(options.route, metrics, options.fallbackSize),
      );

      current = await options.waitForWebview(options.label);
      await current.hide();
    }

    await current.setAutoResize(false);
    options.setCached(current);
    return current;
  }

  async function hide(): Promise<void> {
    const current = await getExistingWebview();

    options.onHide?.();

    if (current) {
      options.setCached(current);
      await current.hide();
    }
  }

  async function position(): Promise<void> {
    if (!options.isOpen()) {
      return;
    }

    const current = await ensure();
    const metrics = await options.toPhysicalMetrics(options.getMetrics());
    if (!metrics) {
      await hide();
      return;
    }

    await current.setPosition(options.createPosition(metrics.x, metrics.y));
    await current.setSize(options.createSize(metrics.width, metrics.height));
  }

  async function sync(): Promise<void> {
    if (!shouldSyncOverlayState(options.getCached(), options.isOpen())) {
      return;
    }

    await ensure();
    await options.emitTo(options.label, options.eventName, options.getPayload());
  }

  async function show(): Promise<TWebview> {
    const current = await ensure();
    await position();
    await sync();
    await current.show();
    await current.setFocus();
    return current;
  }

  return {
    ensure,
    hide,
    position,
    sync,
    show,
  };
}
