import {
  collectFilesFromItems,
  describeDragTransfer,
  hasDraggedFiles,
} from "./attachments.ts";

type StatusLevel = "muted" | "working" | "ok" | "warn" | "error" | "fail";

interface WirePromptAttachmentsOptions {
  appendFiles: (files: File[]) => Promise<number>;
  clearDragVisualState: () => void;
  renderAttachments: () => void;
  removeAttachment: (attachmentId: string | undefined) => void;
  setPromptDropActive: (active: boolean) => void;
  setStatus: (message: string, level?: StatusLevel) => void;
}

export function createPromptDropTracker(setPromptDropActive: (active: boolean) => void) {
  let depth = 0;

  return {
    enter() {
      depth += 1;
      setPromptDropActive(true);
    },
    leave(forceInactive = false) {
      depth = forceInactive ? 0 : Math.max(0, depth - 1);
      if (depth === 0) {
        setPromptDropActive(false);
      }
    },
    reset() {
      depth = 0;
      setPromptDropActive(false);
    },
  };
}

export function getDropFileSummaries(files: Array<Pick<File, "name" | "type" | "size">>) {
  return files.map((file) => ({
    name: file.name,
    type: file.type,
    size: file.size,
  }));
}

export function wirePromptAttachments(options: WirePromptAttachmentsOptions): void {
  const promptField = document.querySelector<HTMLTextAreaElement>("#prompt");
  const dropzone = document.querySelector<HTMLElement>("#prompt-dropzone");
  const attachments = document.querySelector<HTMLElement>("#prompt-attachments");
  const compactBar = document.querySelector<HTMLElement>(".compact-bar");
  if (!promptField || !dropzone || !attachments || !compactBar) {
    return;
  }

  const dropTracker = createPromptDropTracker(options.setPromptDropActive);

  attachments.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest?.("[data-remove-attachment]") as HTMLElement | null;
    if (!button) {
      return;
    }
    options.removeAttachment(button.dataset.removeAttachment);
  });

  promptField.addEventListener("paste", async (event) => {
    const files = collectFilesFromItems(event.clipboardData?.items);
    if (!files.length) {
      return;
    }

    event.preventDefault();
    try {
      const count = await options.appendFiles(files);
      if (count > 0) {
        options.setStatus(`已添加 ${count} 个附件`, "ok");
      }
    } catch (error) {
      console.error(error);
      options.setStatus(`添加附件失败：${error}`, "fail");
    }
  });

  const logDragEvent = (eventName: string, event: DragEvent, accepted: boolean | null = null) => {
    console.info("[drag-debug]", eventName, {
      accepted,
      targetId: (event.target as HTMLElement | null)?.id || "",
      targetClass: (event.target as HTMLElement | null)?.className || "",
      currentTargetId: (event.currentTarget as HTMLElement | null)?.id || "",
      currentTargetClass: (event.currentTarget as HTMLElement | null)?.className || "",
      transfer: describeDragTransfer(event.dataTransfer),
    });
  };

  const markDrag = (event: DragEvent, eventName = "drag") => {
    const accepted = hasDraggedFiles(event.dataTransfer);
    logDragEvent(eventName, event, accepted);
    if (!accepted) {
      return false;
    }
    event.preventDefault();
    return true;
  };

  const handleDragEnter = (event: DragEvent) => {
    if (!markDrag(event, "dragenter")) {
      return;
    }
    dropTracker.enter();
  };

  const handleDragOver = (event: DragEvent) => {
    if (!markDrag(event, "dragover")) {
      return;
    }
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    options.setPromptDropActive(true);
  };

  const handleDragLeave = (event: DragEvent) => {
    const accepted = hasDraggedFiles(event.dataTransfer);
    logDragEvent("dragleave", event, accepted);
    if (!accepted) {
      return;
    }
    event.preventDefault();
    dropTracker.leave(event.currentTarget === event.target);
  };

  const handleDrop = async (event: DragEvent) => {
    if (!markDrag(event, "drop")) {
      return;
    }
    options.clearDragVisualState();
    dropTracker.reset();
    const files = Array.from(event.dataTransfer?.files || []);
    console.info("[drag-debug]", "drop-files", getDropFileSummaries(files));
    if (!files.length) {
      return;
    }
    try {
      const count = await options.appendFiles(files);
      if (count > 0) {
        options.setStatus(`已添加 ${count} 个附件`, "ok");
      }
    } catch (error) {
      console.error(error);
      options.setStatus(`添加附件失败：${error}`, "fail");
    }
  };

  for (const node of [compactBar, dropzone, promptField]) {
    node.addEventListener("dragenter", handleDragEnter);
    node.addEventListener("dragover", handleDragOver);
    node.addEventListener("dragleave", handleDragLeave);
    node.addEventListener("drop", handleDrop);
  }

  options.renderAttachments();
}
