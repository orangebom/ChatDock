export function hasBlockingOverlay({
  siteManagerOpen = false,
  closeConfirmOpen = false,
  onboardingOpen = false,
} = {}) {
  return siteManagerOpen || closeConfirmOpen || onboardingOpen;
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
