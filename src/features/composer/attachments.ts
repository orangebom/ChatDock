export interface ComposerAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  kind: "image" | "file";
  previewUrl: string;
  base64: string;
}

export interface SerializedAttachment {
  name: string;
  mimeType: string;
  size: number;
  kind: "image" | "file";
  base64: string;
}

interface FileLike {
  name?: string;
  type?: string;
  size?: number;
}

export function createAttachmentId(): string {
  return `attachment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isImageType(file: FileLike): boolean {
  return String(file?.type || "").startsWith("image/");
}

export function formatAttachmentSize(size: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = Math.max(0, Number(size) || 0);
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

export function dataUrlToBase64(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function normalizeAttachment(file: File): Promise<ComposerAttachment> {
  const dataUrl = await readFileAsDataUrl(file);
  const type = file.type || "application/octet-stream";
  const kind = isImageType(file) ? "image" : "file";
  return {
    id: createAttachmentId(),
    name: file.name || "attachment",
    type,
    size: Number(file.size) || 0,
    kind,
    previewUrl: kind === "image" ? dataUrl : "",
    base64: dataUrlToBase64(dataUrl),
  };
}

export function collectFilesFromItems(items: DataTransferItemList | DataTransferItem[] | null | undefined): File[] {
  const files: File[] = [];
  if (!items) {
    return files;
  }

  for (const item of Array.from(items)) {
    if (!item || item.kind !== "file") {
      continue;
    }
    const file = item.getAsFile?.();
    if (file) {
      files.push(file);
    }
  }
  return files;
}

export function hasDraggedFiles(dataTransfer: DataTransfer | null | undefined | Record<string, any>): boolean {
  if (!dataTransfer) {
    return false;
  }

  if (Number(dataTransfer.files?.length) > 0) {
    return true;
  }

  const itemList = Array.from(dataTransfer.items || []) as Array<{ kind?: string }>;
  if (itemList.some((item) => item?.kind === "file")) {
    return true;
  }

  return Array.from(dataTransfer.types || []).includes("Files");
}

export function describeDragTransfer(dataTransfer: DataTransfer | null | undefined) {
  if (!dataTransfer) {
    return {
      hasTransfer: false,
      files: 0,
      items: [],
      types: [],
    };
  }

  return {
    hasTransfer: true,
    files: Number(dataTransfer.files?.length) || 0,
    items: Array.from(dataTransfer.items || []).map((item) => ({
      kind: item?.kind || "",
      type: item?.type || "",
    })),
    types: Array.from(dataTransfer.types || []),
  };
}

export function guessMimeTypeFromName(name: string): string {
  const lowerName = String(name || "").toLowerCase();
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".gif")) return "image/gif";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".bmp")) return "image/bmp";
  if (lowerName.endsWith(".svg")) return "image/svg+xml";
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".txt")) return "text/plain";
  if (lowerName.endsWith(".md")) return "text/markdown";
  if (lowerName.endsWith(".json")) return "application/json";
  if (lowerName.endsWith(".csv")) return "text/csv";
  if (lowerName.endsWith(".doc")) return "application/msword";
  if (lowerName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lowerName.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lowerName.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lowerName.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lowerName.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lowerName.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

export async function pathToAttachment(
  path: string,
  readFileBytes: (path: string) => Promise<number[] | Uint8Array>,
): Promise<ComposerAttachment> {
  const name = String(path || "").split(/[/\\]/).pop() || "attachment";
  const bytes = await readFileBytes(path);
  const uint8 = Uint8Array.from(bytes || []);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < uint8.length; index += chunkSize) {
    const chunk = uint8.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const type = guessMimeTypeFromName(name);
  const base64 = btoa(binary);
  const kind = type.startsWith("image/") ? "image" : "file";
  return {
    id: createAttachmentId(),
    name,
    type,
    size: uint8.length,
    kind,
    previewUrl: kind === "image" ? `data:${type};base64,${base64}` : "",
    base64,
  };
}

export function uniqueAttachments<T extends Pick<ComposerAttachment, "name" | "size" | "type" | "base64">>(
  existing: T[],
  incoming: T[],
): T[] {
  const seen = new Set(existing.map((item) => `${item.name}::${item.size}::${item.type}::${item.base64}`));
  const next = [...existing];
  for (const item of incoming) {
    const key = `${item.name}::${item.size}::${item.type}::${item.base64}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(item);
  }
  return next;
}

export function serializeAttachments(attachments: ComposerAttachment[]): SerializedAttachment[] {
  return attachments.map((attachment) => ({
    name: attachment.name,
    mimeType: attachment.type,
    size: attachment.size,
    kind: attachment.kind,
    base64: attachment.base64,
  }));
}
