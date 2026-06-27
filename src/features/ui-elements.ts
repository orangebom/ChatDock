interface DocumentLike {
  createElement(tagName: "span"): HTMLSpanElement;
  createElement(tagName: "div"): HTMLDivElement;
  createElementNS(namespace: string, tagName: "svg"): SVGSVGElement;
  createElementNS(namespace: string, tagName: "path"): SVGPathElement;
  createElementNS(namespace: string, tagName: "circle"): SVGCircleElement;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function createIcon(document: DocumentLike, kind: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");

  const segments =
    kind === "reload"
      ? ["M20 11a8 8 0 1 1-2.34-5.66", "M20 4v6h-6"]
      : kind === "layout"
        ? [
            "M12 3v18",
            "M3 12h18",
            "M3 7h18",
            "M3 17h18",
          ]
        : kind === "clear"
          ? [
              "M4 7h16",
              "M9 7V5.5h6V7",
              "M7 7l1 12h8l1-12",
              "M10 11v5",
              "M14 11v5",
            ]
          : kind === "edit"
            ? [
                "M4 20l4.2-1 9.3-9.3-3.2-3.2L5 15.8 4 20",
                "M13.6 5.4l3.2 3.2",
              ]
            : kind === "restore"
              ? [
                  "M7 4.8H4.8V7",
                  "M13 4.8h2.2V7",
                  "M15.2 13v2.2H13",
                  "M7 15.2H4.8V13",
                  "M8.2 8.2h3.6v3.6H8.2z",
                ]
              : kind === "maximize"
                ? ["M7 4.8H4.8V7", "M13 4.8h2.2V7", "M15.2 13v2.2H13", "M7 15.2H4.8V13"]
                : ["M5.2 5.2l9.6 9.6", "M14.8 5.2l-9.6 9.6"];

  for (const segment of segments) {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", segment);
    svg.appendChild(path);
  }

  return svg;
}

export function createDot(document: DocumentLike, accentColor: string): HTMLSpanElement {
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.style.background = accentColor;
  return dot;
}

export function createStatusDot(document: DocumentLike, accentColor: string): HTMLSpanElement {
  const dot = document.createElement("span");
  dot.className = "status-dot";
  dot.style.background = accentColor;
  return dot;
}

export function createDragHandle(document: DocumentLike): HTMLDivElement {
  const handle = document.createElement("div");
  handle.className = "manager-drag-handle";
  handle.setAttribute("role", "button");
  handle.setAttribute("tabindex", "0");
  handle.setAttribute("aria-label", "拖动排序");
  handle.setAttribute("title", "拖动排序");

  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");

  const dots = [
    [5, 4],
    [5, 8],
    [5, 12],
    [11, 4],
    [11, 8],
    [11, 12],
  ];

  for (const [cx, cy] of dots) {
    const circle = document.createElementNS(SVG_NAMESPACE, "circle");
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", "1.2");
    svg.appendChild(circle);
  }

  handle.append(svg);
  return handle;
}
