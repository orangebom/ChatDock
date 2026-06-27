import { clamp } from "../../geometry.js";

interface RectLike {
  left: number;
  right: number;
  bottom: number;
  width: number;
}

interface ViewportLike {
  width: number;
  height: number;
}

export interface LayoutPresetMetrics {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getMenuMetricsFromRect(
  triggerRect: RectLike,
  viewport: ViewportLike,
): LayoutPresetMetrics {
  const padding = 8;
  const gap = 8;
  const width = 168;
  const height = 84;
  const left = clamp(triggerRect.right - width, padding, Math.max(padding, viewport.width - width - padding));
  const top = clamp(triggerRect.bottom + gap, padding, Math.max(padding, viewport.height - height - padding));

  return {
    x: left,
    y: top,
    width,
    height,
  };
}

export function getDropdownMetricsFromRect(
  triggerRect: RectLike,
  itemCount: number,
  viewport: ViewportLike,
): LayoutPresetMetrics {
  const padding = 8;
  const gap = 8;
  const rowHeight = 38;
  const normalizedItemCount = Math.max(1, itemCount);
  const width = Math.min(
    Math.max(triggerRect.width, 176),
    Math.max(176, viewport.width - padding * 2),
  );
  const height = Math.min(
    16 + normalizedItemCount * rowHeight + Math.max(0, normalizedItemCount - 1) * 4,
    280,
  );
  const left = clamp(triggerRect.left, padding, Math.max(padding, viewport.width - width - padding));
  const top = clamp(triggerRect.bottom + gap, padding, Math.max(padding, viewport.height - height - padding));

  return {
    x: left,
    y: top,
    width,
    height,
  };
}
