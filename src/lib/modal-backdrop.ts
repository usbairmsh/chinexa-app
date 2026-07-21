import * as React from "react";

// Radix portals Select / DropdownMenu / Popover content straight to
// document.body, wrapped in an element carrying data-radix-popper-content-wrapper.
// A click on one of those options is physically OUTSIDE a hand-rolled modal's
// panel, so it lands on the modal backdrop and closed the whole modal out from
// under the user (the bug this fixes). The shared ui/Dialog already guards
// against this; these helpers give hand-rolled framer-motion modals the same
// protection.

function isInsideRadixPortal(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest("[data-radix-popper-content-wrapper]");
}

/**
 * Backdrop onClick handler that closes the modal ONLY when the click truly
 * lands on the backdrop element itself — not when it bubbles up from panel
 * content, and not from a Radix dropdown/select/popover option portaled to the
 * body. Attach to the full-screen overlay element:
 *
 *   <div className="fixed inset-0 …" onClick={backdropClose(() => setOpen(false))}>
 *     <div>…panel…</div>
 *   </div>
 *
 * The e.target === e.currentTarget check means a click that started inside the
 * panel (even without stopPropagation) won't close it — only a direct backdrop
 * click does.
 */
export function backdropClose(close: () => void) {
  return (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // bubbled from panel content
    if (isInsideRadixPortal(e.target)) return; // portaled dropdown option
    close();
  };
}
