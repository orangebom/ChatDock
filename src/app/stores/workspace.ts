import { defineStore } from "pinia";
import type { LayoutPresetState, SiteConfig, WorkspaceState } from "../../types/domain";

interface WorkspaceStoreState {
  sites: SiteConfig[];
  workspace: WorkspaceState | null;
  layoutPresets: LayoutPresetState | null;
  themeMode: "system" | "light" | "dark";
  status: {
    message: string;
    level: "muted" | "working" | "ok" | "warn" | "error";
  };
}

export const useWorkspaceStore = defineStore("workspace", {
  state: (): WorkspaceStoreState => ({
    sites: [],
    workspace: null,
    layoutPresets: null,
    themeMode: "system",
    status: {
      message: "",
      level: "muted",
    },
  }),
  getters: {
    selectedCount: (state) => state.workspace?.selectedSiteLabels.length ?? 0,
    visibleCount: (state) => state.workspace?.visibleSiteLabels.length ?? 0,
    activePresetName: (state) => {
      const activePresetId = state.layoutPresets?.activePresetId;
      return state.layoutPresets?.items.find((preset) => preset.id === activePresetId)?.name ?? "";
    },
  },
  actions: {
    hydrate(payload: Partial<WorkspaceStoreState>) {
      if (payload.sites) {
        this.sites = payload.sites;
      }
      if (payload.workspace !== undefined) {
        this.workspace = payload.workspace;
      }
      if (payload.layoutPresets !== undefined) {
        this.layoutPresets = payload.layoutPresets;
      }
      if (payload.themeMode) {
        this.themeMode = payload.themeMode;
      }
      if (payload.status) {
        this.status = payload.status;
      }
    },
    setStatus(message: string, level: WorkspaceStoreState["status"]["level"] = "muted") {
      this.status = { message, level };
    },
  },
});
