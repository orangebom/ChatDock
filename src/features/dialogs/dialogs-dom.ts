interface ModalLike {
  hidden: boolean;
}

interface FocusableLike {
  focus(): void;
}

type RequestAnimationFrameLike = (callback: () => void) => unknown;

export function isModalElementOpen(modal: ModalLike | null | undefined): boolean {
  return Boolean(modal && !modal.hidden);
}

export function showModalElement(modal: ModalLike | null | undefined): boolean {
  if (!modal) {
    return false;
  }

  modal.hidden = false;
  return true;
}

export function hideModalElement(modal: ModalLike | null | undefined): boolean {
  if (!modal) {
    return false;
  }

  modal.hidden = true;
  return true;
}

export function focusElementOnNextFrame(
  element: FocusableLike | null | undefined,
  requestAnimationFrame: RequestAnimationFrameLike,
): void {
  if (!element) {
    return;
  }

  requestAnimationFrame(() => {
    element.focus();
  });
}
