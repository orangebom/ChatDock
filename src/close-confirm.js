export function hasBlockingOverlay({
  siteManagerOpen = false,
  closeConfirmOpen = false,
  aboutOpen = false,
  onboardingOpen = false,
  targetContextMenuOpen = false,
  layoutPresetsOpen = false,
  layoutPresetDropdownOpen = false,
} = {}) {
  void layoutPresetDropdownOpen;
  return siteManagerOpen || closeConfirmOpen || aboutOpen || onboardingOpen || targetContextMenuOpen || layoutPresetsOpen;
}

export async function handleCloseRequest({
  event,
  showCloseConfirm,
  destroyWindow,
  setStatus,
  onError = console.error,
}) {
  event?.preventDefault?.();

  const shouldClose = await showCloseConfirm();
  if (!shouldClose) {
    setStatus("已取消关闭。", "muted");
    return false;
  }

  try {
    await destroyWindow();
    return true;
  } catch (error) {
    onError(error);
    setStatus(`关闭失败：${error}`, "fail");
    event?.preventDefault?.();
    return false;
  }
}
