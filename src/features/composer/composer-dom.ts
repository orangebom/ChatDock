import type { ComposerAttachment } from "./attachments.ts";
import { formatAttachmentSize } from "./attachments.ts";

export function getAttachmentExtensionLabel(name: string): string {
  const extension = name.includes(".") ? name.split(".").pop() : "FILE";
  return (extension || "FILE").slice(0, 4).toUpperCase();
}

export function getAttachmentInfoLabel(attachment: Pick<ComposerAttachment, "kind" | "size">): string {
  return `${attachment.kind === "image" ? "图片" : "文件"} · ${formatAttachmentSize(attachment.size)}`;
}

export function renderComposerAttachmentList({
  container,
  dropzone,
  attachments,
}: {
  container: HTMLElement;
  dropzone: HTMLElement;
  attachments: ComposerAttachment[];
}): void {
  container.innerHTML = "";
  container.hidden = attachments.length === 0;
  dropzone.dataset.hasAttachments = attachments.length > 0 ? "true" : "false";

  for (const attachment of attachments) {
    const item = document.createElement("div");
    item.className = `prompt-attachment prompt-attachment-${attachment.kind}`;
    item.dataset.attachmentId = attachment.id;

    const thumb = document.createElement("div");
    thumb.className = "prompt-attachment-thumb";
    if (attachment.kind === "image" && attachment.previewUrl) {
      const image = document.createElement("img");
      image.src = attachment.previewUrl;
      image.alt = attachment.name;
      thumb.append(image);
    } else {
      const badge = document.createElement("span");
      badge.className = "prompt-attachment-ext";
      badge.textContent = getAttachmentExtensionLabel(attachment.name);
      thumb.append(badge);
    }

    const meta = document.createElement("div");
    meta.className = "prompt-attachment-meta";

    const name = document.createElement("div");
    name.className = "prompt-attachment-name";
    name.textContent = attachment.name;

    const info = document.createElement("div");
    info.className = "prompt-attachment-info";
    info.textContent = getAttachmentInfoLabel(attachment);

    meta.append(name, info);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "prompt-attachment-remove";
    remove.dataset.removeAttachment = attachment.id;
    remove.setAttribute("aria-label", `移除 ${attachment.name}`);
    remove.title = `移除 ${attachment.name}`;
    remove.textContent = "×";

    item.append(thumb, meta, remove);
    container.append(item);
  }
}
