<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useWorkspaceStore } from "./stores/workspace";

const workspaceStore = useWorkspaceStore();
const { selectedCount, visibleCount, activePresetName, status } = storeToRefs(workspaceStore);
</script>

<template>
  <div class="vue-bridge" aria-hidden="true" data-testid="vue-bridge">
    <span data-testid="vue-selected-count">{{ selectedCount }}</span>
    <span data-testid="vue-visible-count">{{ visibleCount }}</span>
    <span data-testid="vue-active-preset">{{ activePresetName }}</span>
    <span data-testid="vue-status">{{ status.message }}</span>
  </div>
</template>
