interface TauriEventLike {
  listen(name: string, handler: (event: any) => void | Promise<void>): Promise<unknown>;
}

interface AppWindowLike {
  onDragDropEvent(handler: (event: any) => void | Promise<void>): Promise<unknown>;
}

interface TauriEventActions {
  handlePanelAction(action: string, site: string): Promise<void>;
  closeLayoutPresetDropdown(): Promise<void>;
  applyLayoutPreset(presetId: string): Promise<void>;
  closeLayoutPresetMenu(): Promise<void>;
  runLayoutPresetMenuAction(action: string): Promise<void>;
  syncSiteAvailability(label: string, available: boolean, message: string, options: { fromWebview: boolean }): void;
  logAttachmentDebug(stage: string, payload?: Record<string, unknown>): void;
  findPanelDropTarget(position: unknown): string | null;
  setPanelDropTarget(label: string | null): void;
  setPromptDropActive(active: boolean): void;
  clearDragVisualState(): void;
  injectAttachmentsIntoPanel(label: string, paths: string[]): Promise<{ ok?: boolean; message?: string } | null | undefined>;
  getSiteMeta(label: string): { title?: string } | null | undefined;
  setStatus(message: string, level?: string): void;
  appendComposerPaths(paths: string[]): Promise<number>;
  onError(error: unknown): void;
}

export async function wireTauriAppEvents({
  tauriEvent,
  appWindow,
  siteAvailabilitySyncEvent,
  attachmentDebugEvent,
  actions,
}: {
  tauriEvent: TauriEventLike;
  appWindow: AppWindowLike;
  siteAvailabilitySyncEvent: string;
  attachmentDebugEvent: string;
  actions: TauriEventActions;
}): Promise<void> {
  await tauriEvent.listen("panel-toolbar-action", async ({ payload }) => {
    const { action, site } = payload || {};
    if (!action || !site) {
      return;
    }
    await actions.handlePanelAction(action, site);
  });

  await tauriEvent.listen("layout-preset-dropdown-action", async ({ payload }) => {
    if (payload?.action === "close") {
      await actions.closeLayoutPresetDropdown();
      return;
    }

    if (payload?.action !== "apply" || !payload?.presetId) {
      return;
    }

    await actions.closeLayoutPresetDropdown();
    await actions.applyLayoutPreset(payload.presetId);
  });

  await tauriEvent.listen("layout-preset-menu-action", async ({ payload }) => {
    if (payload?.action === "close") {
      await actions.closeLayoutPresetMenu();
      return;
    }

    await actions.runLayoutPresetMenuAction(payload?.action);
  });

  await tauriEvent.listen(siteAvailabilitySyncEvent, ({ payload }) => {
    const label = payload?.label;
    if (!label) {
      return;
    }
    actions.syncSiteAvailability(label, payload.available !== false, payload.message || "", { fromWebview: true });
  });

  await tauriEvent.listen(attachmentDebugEvent, ({ payload }) => {
    actions.logAttachmentDebug("backend-event", payload || {});
  });

  await appWindow.onDragDropEvent(async (event) => {
    console.info("[drag-debug][tauri]", event.payload);
    const dropTargetLabel = actions.findPanelDropTarget(event.payload?.position);
    actions.setPanelDropTarget(dropTargetLabel);
    actions.logAttachmentDebug("tauri-drag:event", {
      type: event.payload?.type,
      position: event.payload?.position,
      paths: event.payload?.paths || [],
      dropTargetLabel,
    });

    if (event.payload?.type === "enter" || event.payload?.type === "over") {
      if (dropTargetLabel) {
        actions.setPromptDropActive(false);
      } else {
        actions.setPromptDropActive(true);
      }
      return;
    }

    if (event.payload?.type === "leave") {
      actions.clearDragVisualState();
      return;
    }

    if (event.payload?.type !== "drop") {
      return;
    }

    actions.clearDragVisualState();
    try {
      if (dropTargetLabel) {
        actions.logAttachmentDebug("tauri-drag:panel-route", {
          dropTargetLabel,
          pathCount: (event.payload?.paths || []).length,
        });
        const result = await actions.injectAttachmentsIntoPanel(dropTargetLabel, event.payload.paths || []);
        if (result?.ok) {
          const site = actions.getSiteMeta(dropTargetLabel);
          actions.setStatus(`已将附件注入 ${site?.title || dropTargetLabel} 面板。`, "ok");
        } else {
          actions.setStatus(`注入附件失败：${result?.message || "未知错误"}`, "fail");
        }
        return;
      }

      actions.logAttachmentDebug("tauri-drag:composer-route", {
        pathCount: (event.payload?.paths || []).length,
      });
      const count = await actions.appendComposerPaths(event.payload.paths || []);
      if (count > 0) {
        actions.setStatus(`已拖入 ${count} 个附件。`, "ok");
      }
    } catch (error) {
      actions.onError(error);
      actions.setStatus(`添加附件失败：${error}`, "fail");
    }
  });
}
