import type { LayoutHandle } from "./panel-layout";

interface DocumentLike {
  createElement(tagName: "button"): HTMLButtonElement;
  createElement(tagName: "img"): HTMLImageElement;
  createElement(tagName: string): HTMLElement;
}

interface RenderLayoutHandlesOptions {
  document: DocumentLike;
  layer: HTMLElement;
  handles: LayoutHandle[];
  onPointerDown(event: PointerEvent, handle: LayoutHandle): void;
}

interface RenderEmptyPanelStateOptions {
  document: DocumentLike;
  container: HTMLElement;
  visibleCount: number;
  title: string;
  message: string;
}

const EMPTY_STEPS = [
  "勾选你想观察的 AI",
  "支持同时展示最多 4 个",
  "超过 4 个会自动分页",
];

export function renderLayoutHandles({
  document,
  layer,
  handles,
  onPointerDown,
}: RenderLayoutHandlesOptions): void {
  layer.innerHTML = "";

  for (const handle of handles) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "layout-handle";
    element.dataset.axis = handle.axis;
    element.dataset.key = handle.key;
    element.style.left = `${handle.x}px`;
    element.style.top = `${handle.y}px`;
    element.style.width = `${handle.width}px`;
    element.style.height = `${handle.height}px`;
    element.addEventListener("pointerdown", (event) => onPointerDown(event, handle));
    layer.appendChild(element);
  }
}

export function renderEmptyPanelState({
  document,
  container,
  visibleCount,
  title,
  message,
}: RenderEmptyPanelStateOptions): void {
  container.innerHTML = "";
  container.hidden = visibleCount !== 0;

  if (visibleCount !== 0) {
    return;
  }

  const card = document.createElement("div");
  card.className = "layout-empty-card";

  const preview = document.createElement("div");
  preview.className = "layout-empty-preview";

  const glow = document.createElement("div");
  glow.className = "layout-empty-preview-glow";

  const mark = document.createElement("div");
  mark.className = "layout-empty-mark brand-mark-frame";

  const logo = document.createElement("img");
  logo.className = "brand-mark-logo layout-empty-mark-logo";
  logo.src = "./assets/chatdock-logo.png";
  logo.alt = "ChatDock logo";

  mark.appendChild(logo);
  preview.append(glow, mark);

  const titleElement = document.createElement("h2");
  titleElement.textContent = title;

  const messageElement = document.createElement("p");
  messageElement.textContent = message;

  const steps = document.createElement("div");
  steps.className = "layout-empty-steps";

  EMPTY_STEPS.forEach((label, index) => {
    const item = document.createElement("div");
    item.className = "layout-empty-step";

    const badge = document.createElement("span");
    badge.className = "layout-empty-step-index";
    badge.textContent = String(index + 1);

    const text = document.createElement("span");
    text.className = "layout-empty-step-text";
    text.textContent = label;

    item.append(badge, text);
    steps.appendChild(item);
  });

  const hint = document.createElement("div");
  hint.className = "layout-empty-hint";
  hint.textContent = "从底部开始组装你的 AI 工作台";

  card.append(preview, titleElement, messageElement, steps, hint);
  container.append(card);
}
