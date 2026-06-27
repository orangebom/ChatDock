import { clamp, createRect } from "../../geometry.js";

interface LayoutStateLike {
  twoWaySplit: number;
  threeWaySplits: number[];
  quadCols: number;
  quadRows: number;
}

interface SizeLike {
  width: number;
  height: number;
}

export interface LayoutHandle {
  key: string;
  axis: "x" | "y";
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getPanelLayoutRects(
  labels: string[],
  layout: LayoutStateLike,
  container: SizeLike,
  gap: number,
) {
  const count = labels.length;
  const { width, height } = container;
  const rects = new Map<string, ReturnType<typeof createRect>>();
  const handles: LayoutHandle[] = [];

  if (count === 0) {
    return { rects, handles };
  }

  if (count === 1) {
    rects.set(labels[0], createRect(0, 0, width, height));
    return { rects, handles };
  }

  if (count === 2) {
    const split = clamp(layout.twoWaySplit, 0.2, 0.8);
    const leftWidth = Math.round(width * split - gap / 2);
    const rightX = leftWidth + gap;
    rects.set(labels[0], createRect(0, 0, leftWidth, height));
    rects.set(labels[1], createRect(rightX, 0, Math.max(0, width - rightX), height));
    handles.push({
      key: "two-way",
      axis: "x",
      x: Math.round(width * split),
      y: 0,
      width: 12,
      height,
    });
    return { rects, handles };
  }

  if (count === 3) {
    let [first, second] = layout.threeWaySplits;
    first = clamp(first, 0.18, 0.7);
    second = clamp(second, first + 0.12, 0.82);
    layout.threeWaySplits = [first, second];

    const x1 = Math.round(width * first);
    const x2 = Math.round(width * second);
    const leftWidth = Math.max(0, x1 - gap / 2);
    const centerX = x1 + gap / 2;
    const centerWidth = Math.max(0, x2 - x1 - gap);
    const rightX = x2 + gap / 2;
    const rightWidth = Math.max(0, width - rightX);

    rects.set(labels[0], createRect(0, 0, leftWidth, height));
    rects.set(labels[1], createRect(centerX, 0, centerWidth, height));
    rects.set(labels[2], createRect(rightX, 0, rightWidth, height));
    handles.push(
      { key: "three-way-left", axis: "x", x: x1, y: 0, width: 12, height },
      { key: "three-way-right", axis: "x", x: x2, y: 0, width: 12, height },
    );
    return { rects, handles };
  }

  const colSplit = clamp(layout.quadCols, 0.24, 0.76);
  const rowSplit = clamp(layout.quadRows, 0.24, 0.76);
  const splitX = Math.round(width * colSplit);
  const splitY = Math.round(height * rowSplit);
  const leftWidth = Math.max(0, splitX - gap / 2);
  const rightX = splitX + gap / 2;
  const rightWidth = Math.max(0, width - rightX);
  const topHeight = Math.max(0, splitY - gap / 2);
  const bottomY = splitY + gap / 2;
  const bottomHeight = Math.max(0, height - bottomY);

  rects.set(labels[0], createRect(0, 0, leftWidth, topHeight));
  rects.set(labels[1], createRect(rightX, 0, rightWidth, topHeight));
  rects.set(labels[2], createRect(0, bottomY, leftWidth, bottomHeight));
  rects.set(labels[3], createRect(rightX, bottomY, rightWidth, bottomHeight));
  handles.push(
    { key: "quad-cols", axis: "x", x: splitX, y: 0, width: 12, height },
    { key: "quad-rows", axis: "y", x: 0, y: splitY, width, height: 12 },
  );
  return { rects, handles };
}

export function updateLayoutFromHandleDrag(
  layout: LayoutStateLike,
  handleKey: string,
  ratio: number,
): void {
  if (handleKey === "two-way") {
    layout.twoWaySplit = clamp(ratio, 0.2, 0.8);
  }
  if (handleKey === "three-way-left") {
    const [, right] = layout.threeWaySplits;
    layout.threeWaySplits = [clamp(ratio, 0.18, right - 0.12), right];
  }
  if (handleKey === "three-way-right") {
    const [left] = layout.threeWaySplits;
    layout.threeWaySplits = [left, clamp(ratio, left + 0.12, 0.82)];
  }
  if (handleKey === "quad-cols") {
    layout.quadCols = clamp(ratio, 0.24, 0.76);
  }
  if (handleKey === "quad-rows") {
    layout.quadRows = clamp(ratio, 0.24, 0.76);
  }
}
