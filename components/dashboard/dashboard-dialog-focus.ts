"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

const focusableSelector = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const openDialogs: HTMLElement[] = [];
let restoreScroll: (() => void) | undefined;

/** 每一层记录自己的触发位置。仅栈顶处理按键，最后一层关闭时恢复页面滚动。 */
export function useDashboardDialogFocus({
  active,
  dialogRef,
  onClose,
}: {
  active: boolean;
  dialogRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!active || !dialog) return;

    const returnTarget = document.activeElement;
    if (!openDialogs.length) restoreScroll = lockBodyScroll();
    openDialogs.push(dialog);

    const isTop = () => openDialogs.at(-1) === dialog;
    const frame = requestAnimationFrame(() => {
      if (isTop()) focusFirst(dialog);
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      // 选择器和日期浮层可能先接管按键，已处理的事件无需再交给外层弹窗。
      if (!isTop() || event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Tab") {
        keepTabInside(dialog, event);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      const wasTop = isTop();
      openDialogs.splice(openDialogs.indexOf(dialog), 1);
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      if (!openDialogs.length) {
        restoreScroll?.();
        restoreScroll = undefined;
      }

      // 清理底层弹窗时不能把焦点从仍打开的确认框抢走。
      if (!wasTop) return;
      const nextDialog = openDialogs.at(-1);
      if (
        returnTarget instanceof HTMLElement &&
        returnTarget.isConnected &&
        (!nextDialog || nextDialog.contains(returnTarget))
      ) {
        returnTarget.focus();
      } else if (nextDialog) {
        focusFirst(nextDialog);
      }
    };
  }, [active, dialogRef]);
}

function lockBodyScroll() {
  const style = document.body.style;
  const previous = {
    overflow: style.overflow,
    paddingRight: style.paddingRight,
    touchAction: style.touchAction,
  };
  const scrollbarWidth =
    window.innerWidth - document.documentElement.clientWidth;
  style.overflow = "hidden";
  style.touchAction = "none";
  if (scrollbarWidth > 0) style.paddingRight = `${scrollbarWidth}px`;
  return () => Object.assign(style, previous);
}

function getFocusableElements(dialog: HTMLElement) {
  return [...dialog.querySelectorAll<HTMLElement>(focusableSelector)].filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0,
  );
}

function focusFirst(dialog: HTMLElement) {
  (getFocusableElements(dialog)[0] ?? dialog).focus();
}

function keepTabInside(dialog: HTMLElement, event: KeyboardEvent) {
  const focusable = getFocusableElements(dialog);
  const first = focusable[0];
  const last = focusable.at(-1);
  const activeElement = document.activeElement;
  const edge = event.shiftKey ? first : last;

  if (!first || !dialog.contains(activeElement) || activeElement === edge) {
    event.preventDefault();
    (event.shiftKey ? (last ?? dialog) : (first ?? dialog)).focus();
  }
}
