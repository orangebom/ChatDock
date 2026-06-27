export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createRect(x, y, width, height) {
  return { x, y, width, height };
}

export function clampCardPosition(value, size, viewportSize, padding = 20) {
  return clamp(value, padding, Math.max(padding, viewportSize - size - padding));
}

export function physicalToViewportPosition(position, devicePixelRatio = window.devicePixelRatio) {
  if (!position) {
    return null;
  }

  return {
    x: position.x / devicePixelRatio,
    y: position.y / devicePixelRatio,
  };
}

export function cssToPhysicalMetrics(metrics, windowSize, viewportSize) {
  if (!metrics) {
    return null;
  }

  const scaleX = windowSize.width / viewportSize.width;
  const scaleY = windowSize.height / viewportSize.height;

  return {
    x: Math.round(metrics.x * scaleX),
    y: Math.round(metrics.y * scaleY),
    width: Math.round(metrics.width * scaleX),
    height: Math.round(metrics.height * scaleY),
  };
}
