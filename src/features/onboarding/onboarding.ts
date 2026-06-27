import { clampCardPosition } from "../../geometry.js";

export interface OnboardingStep {
  title: string;
  body: string;
  target: string | null;
  placement: "top" | "bottom" | "center";
}

interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
  bottom?: number;
}

interface SizeLike {
  width: number;
  height: number;
}

interface OnboardingState {
  open: boolean;
  completed: boolean;
  stepIndex: number;
}

interface OnboardingControllerOptions {
  document: Document;
  window: Window;
  steps: OnboardingStep[];
  state: OnboardingState;
  isSiteManagerOpen(): boolean;
  closeSiteManager(): Promise<void>;
  syncVisibleWebviews(): Promise<void>;
  syncVisibleToolbarWebviews(): Promise<void>;
  refreshLayout(passes?: number): Promise<void>;
  persistCompleted(): void;
}

const VIEWPORT_PADDING = 20;
const FOCUS_PADDING = 10;
const CARD_PADDING = 20;
const CARD_GAP = 18;

export function getOnboardingStep(steps: OnboardingStep[], stepIndex: number): OnboardingStep {
  return steps[stepIndex] || steps[0];
}

export function clampOnboardingStep(stepIndex: number, direction: number, total: number): number {
  return Math.max(0, Math.min(Math.max(0, total - 1), stepIndex + direction));
}

export function getOnboardingViewModel(steps: OnboardingStep[], stepIndex: number) {
  const total = steps.length;
  const current = Math.max(1, Math.min(total, stepIndex + 1));

  return {
    step: getOnboardingStep(steps, stepIndex),
    current,
    total,
    progress: `${current} / ${total}`,
    isFirst: stepIndex === 0,
    isLast: current === total,
    nextText: current === total ? "完成" : "下一步",
    dots: steps.map((_, index) => index === stepIndex),
  };
}

export function getOnboardingFocusMetrics(targetRect: RectLike | null, viewport: SizeLike) {
  if (!targetRect) {
    return null;
  }

  const focusLeft = Math.max(VIEWPORT_PADDING, targetRect.left - FOCUS_PADDING);
  const focusTop = Math.max(VIEWPORT_PADDING, targetRect.top - FOCUS_PADDING);
  const focusWidth = Math.min(viewport.width - VIEWPORT_PADDING * 2, targetRect.width + FOCUS_PADDING * 2);
  const focusHeight = Math.min(viewport.height - VIEWPORT_PADDING * 2, targetRect.height + FOCUS_PADDING * 2);
  const focusRight = Math.min(viewport.width - VIEWPORT_PADDING, focusLeft + focusWidth);
  const focusBottom = Math.min(viewport.height - VIEWPORT_PADDING, focusTop + focusHeight);
  const width = Math.max(0, focusRight - focusLeft);
  const height = Math.max(0, focusBottom - focusTop);

  return {
    focus: {
      left: focusLeft,
      top: focusTop,
      width,
      height,
    },
    shades: {
      top: { left: 0, top: 0, width: "100%", height: Math.max(0, focusTop) },
      left: { left: 0, top: focusTop, width: Math.max(0, focusLeft), height },
      right: {
        left: focusRight,
        top: focusTop,
        width: Math.max(0, viewport.width - focusRight),
        height,
      },
      bottom: {
        left: 0,
        top: focusBottom,
        width: "100%",
        height: Math.max(0, viewport.height - focusBottom),
      },
    },
  };
}

export function getOnboardingCardPosition({
  targetRect,
  cardRect,
  viewport,
  placement,
}: {
  targetRect: (RectLike & { bottom: number }) | null;
  cardRect: SizeLike;
  viewport: SizeLike;
  placement: OnboardingStep["placement"];
}) {
  let left = (viewport.width - cardRect.width) / 2;
  let top = (viewport.height - cardRect.height) / 2;

  if (targetRect) {
    const centeredLeft = targetRect.left + targetRect.width / 2 - cardRect.width / 2;
    left = clampCardPosition(centeredLeft, cardRect.width, viewport.width, CARD_PADDING);

    if (placement === "top") {
      top = targetRect.top - cardRect.height - CARD_GAP;
      if (top < CARD_PADDING) {
        top = clampCardPosition(targetRect.bottom + CARD_GAP, cardRect.height, viewport.height, CARD_PADDING);
      }
    } else if (placement === "bottom") {
      top = targetRect.bottom + CARD_GAP;
      if (top + cardRect.height > viewport.height - CARD_PADDING) {
        top = clampCardPosition(targetRect.top - cardRect.height - CARD_GAP, cardRect.height, viewport.height, CARD_PADDING);
      }
    } else {
      top = clampCardPosition(
        targetRect.top + targetRect.height / 2 - cardRect.height / 2,
        cardRect.height,
        viewport.height,
        CARD_PADDING,
      );
    }
  }

  return {
    left: clampCardPosition(left, cardRect.width, viewport.width, CARD_PADDING),
    top: clampCardPosition(top, cardRect.height, viewport.height, CARD_PADDING),
  };
}

function getTargetRect(document: Document, selector: string | null): DOMRect | null {
  if (!selector) {
    return null;
  }
  const element = document.querySelector(selector);
  if (!element) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return rect;
}

function setStyleRect(element: HTMLElement | null, rect: Record<string, number | string>): void {
  if (!element) {
    return;
  }

  for (const [key, value] of Object.entries(rect)) {
    element.style.setProperty(key, typeof value === "number" ? `${value}px` : value);
  }
}

function renderFocus(document: Document, window: Window, step: OnboardingStep): void {
  const focus = document.querySelector<HTMLElement>("#tour-focus");
  const shadeTop = document.querySelector<HTMLElement>(".tour-shade-top");
  const shadeLeft = document.querySelector<HTMLElement>(".tour-shade-left");
  const shadeRight = document.querySelector<HTMLElement>(".tour-shade-right");
  const shadeBottom = document.querySelector<HTMLElement>(".tour-shade-bottom");
  if (!focus) {
    return;
  }

  const metrics = getOnboardingFocusMetrics(getTargetRect(document, step.target), {
    width: window.innerWidth,
    height: window.innerHeight,
  });

  if (!metrics) {
    focus.hidden = true;
    setStyleRect(shadeTop, { top: 0, left: 0, width: "100%", height: "100%" });
    setStyleRect(shadeLeft, { width: 0, height: 0 });
    setStyleRect(shadeRight, { width: 0, height: 0 });
    setStyleRect(shadeBottom, { width: 0, height: 0 });
    return;
  }

  focus.hidden = false;
  setStyleRect(focus, metrics.focus);
  setStyleRect(shadeTop, metrics.shades.top);
  setStyleRect(shadeLeft, metrics.shades.left);
  setStyleRect(shadeRight, metrics.shades.right);
  setStyleRect(shadeBottom, metrics.shades.bottom);
}

function positionCard(document: Document, window: Window, step: OnboardingStep): void {
  const card = document.querySelector<HTMLElement>("#tour-card");
  if (!card) {
    return;
  }

  const cardRect = card.getBoundingClientRect();
  const position = getOnboardingCardPosition({
    targetRect: getTargetRect(document, step.target),
    cardRect: { width: cardRect.width, height: cardRect.height },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    placement: step.placement,
  });

  card.style.left = `${position.left}px`;
  card.style.top = `${position.top}px`;
}

function renderStep(options: OnboardingControllerOptions): void {
  const shell = options.document.querySelector<HTMLElement>("#onboarding");
  const title = options.document.querySelector<HTMLElement>("#tour-title");
  const body = options.document.querySelector<HTMLElement>("#tour-body");
  const progress = options.document.querySelector<HTMLElement>("#tour-progress");
  const dots = options.document.querySelector<HTMLElement>("#tour-dots");
  const prev = options.document.querySelector<HTMLButtonElement>("#tour-prev");
  const next = options.document.querySelector<HTMLButtonElement>("#tour-next");

  if (!shell || shell.hidden || !title || !body || !progress || !dots || !prev || !next) {
    return;
  }

  const viewModel = getOnboardingViewModel(options.steps, options.state.stepIndex);

  title.textContent = viewModel.step.title;
  body.textContent = viewModel.step.body;
  progress.textContent = viewModel.progress;
  prev.disabled = viewModel.isFirst;
  next.textContent = viewModel.nextText;

  dots.innerHTML = "";
  for (const active of viewModel.dots) {
    const dot = options.document.createElement("span");
    dot.className = `tour-dot${active ? " active" : ""}`;
    dots.append(dot);
  }

  renderFocus(options.document, options.window, viewModel.step);
  options.window.requestAnimationFrame(() => {
    positionCard(options.document, options.window, viewModel.step);
  });
}

export function createOnboardingController(options: OnboardingControllerOptions) {
  function isOpen(): boolean {
    const shell = options.document.querySelector<HTMLElement>("#onboarding");
    return Boolean(shell && !shell.hidden);
  }

  async function open(resetToFirst = false): Promise<void> {
    const shell = options.document.querySelector<HTMLElement>("#onboarding");
    if (!shell) {
      return;
    }
    if (options.isSiteManagerOpen()) {
      await options.closeSiteManager();
    }
    if (resetToFirst) {
      options.state.stepIndex = 0;
    }
    options.state.open = true;
    shell.hidden = false;
    renderStep(options);
    await options.syncVisibleWebviews();
    await options.syncVisibleToolbarWebviews();
    await options.refreshLayout(1);
  }

  async function close(markCompleted = false): Promise<void> {
    const shell = options.document.querySelector<HTMLElement>("#onboarding");
    if (!shell) {
      return;
    }
    shell.hidden = true;
    options.state.open = false;
    if (markCompleted) {
      options.state.completed = true;
      options.persistCompleted();
    }
    await options.refreshLayout();
  }

  async function step(direction: number): Promise<void> {
    const nextIndex = clampOnboardingStep(options.state.stepIndex, direction, options.steps.length);
    if (nextIndex === options.state.stepIndex) {
      return;
    }
    options.state.stepIndex = nextIndex;
    renderStep(options);
    await options.refreshLayout(1);
  }

  async function nextOrClose(): Promise<void> {
    if (options.state.stepIndex >= options.steps.length - 1) {
      await close(true);
      return;
    }
    await step(1);
  }

  function wire(): void {
    options.document.querySelector("#tour-prev")?.addEventListener("click", async () => {
      await step(-1);
    });
    options.document.querySelector("#tour-next")?.addEventListener("click", async () => {
      await nextOrClose();
    });
    options.document.querySelector("#tour-skip")?.addEventListener("click", async () => {
      await close(true);
    });
  }

  async function handleKeydown(event: KeyboardEvent): Promise<boolean> {
    if (event.key === "Escape" && isOpen()) {
      await close(true);
      return true;
    }
    if (isOpen() && event.key === "ArrowRight") {
      event.preventDefault();
      await nextOrClose();
      return true;
    }
    if (isOpen() && event.key === "ArrowLeft") {
      event.preventDefault();
      await step(-1);
      return true;
    }
    return false;
  }

  return {
    isOpen,
    render: () => renderStep(options),
    open,
    close,
    step,
    wire,
    handleKeydown,
  };
}
