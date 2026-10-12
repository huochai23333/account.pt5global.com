"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { MOTION_DURATION, MOTION_EASING } from "@/lib/motion-tokens";

type DashboardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
};

const DIALOG_FOCUSABLE_SELECTOR = [
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

const subscribeToClientReady = () => () => {};
const getClientReadySnapshot = () => true;
const getServerReadySnapshot = () => false;

export function DashboardDialog({
  open,
  onOpenChange,
  title,
  description,
  actions,
  children,
  contentClassName,
}: DashboardDialogProps) {
  const uiText = useTranslations("UiText.shared");
  const titleId = useId();
  const descriptionId = useId();
  const clientReady = useSyncExternalStore(
    subscribeToClientReady,
    getClientReadySnapshot,
    getServerReadySnapshot,
  );
  const portalHost = clientReady ? document.body : null;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);

  useEffect(() => {
    // 父组件经常会传入临时创建的关闭函数，例如输入框每次输入都会让父组件重新渲染。
    // 这里把最新关闭函数放进 ref，键盘事件就能拿到最新逻辑，同时避免重新启动焦点锁。
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    if (!open || !portalHost) {
      return;
    }

    previousFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const previousTouchAction = document.body.style.touchAction;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChangeRef.current(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialogElement = dialogRef.current;

      if (!dialogElement) {
        return;
      }

      const focusableElements = getFocusableElements(dialogElement);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogElement.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      if (!activeElement || !dialogElement.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    };

    const focusInitialElement = () => {
      const dialogElement = dialogRef.current;

      if (!dialogElement) {
        return;
      }

      const focusableElements = getFocusableElements(dialogElement);
      const initialFocusTarget =
        focusableElements[0] ?? closeButtonRef.current ?? dialogElement;

      initialFocusTarget.focus();
    };

    const frameId = window.requestAnimationFrame(focusInitialElement);

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.body.style.touchAction = previousTouchAction;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusedElementRef.current?.focus();
    };
  }, [open, portalHost]);

  if (!portalHost) {
    return null;
  }

  const overlayTransition = {
    duration: MOTION_DURATION.feedback,
    ease: MOTION_EASING.exit,
  };
  const dialogTransition = {
    duration: MOTION_DURATION.overlay,
    ease: MOTION_EASING.enter,
  };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.button
            aria-label={uiText("closeDialog")}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-foreground/35 backdrop-blur-sm"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => onOpenChangeRef.current(false)}
            style={{ willChange: "opacity" }}
            tabIndex={-1}
            transition={overlayTransition}
            type="button"
          />

          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-describedby={description ? descriptionId : undefined}
            aria-labelledby={titleId}
            aria-modal="true"
            className="relative z-10 flex max-h-[calc(100dvh-2rem)] min-w-0 w-full max-w-4xl flex-col overflow-hidden rounded-surface-panel border border-surface-panel-border bg-surface-overlay shadow-surface-floating backdrop-blur-2xl backdrop-saturate-150"
            data-motion-dialog="true"
            exit={{ opacity: 0, scale: 0.985, y: 16 }}
            initial={{ opacity: 0, scale: 0.985, y: 20 }}
            ref={dialogRef}
            role="dialog"
            style={{
              backfaceVisibility: "hidden",
              willChange: "transform, opacity",
            }}
            tabIndex={-1}
            transition={dialogTransition}
          >
            <div className="shrink-0 flex min-w-0 items-start justify-between gap-4 border-b border-border-subtle bg-surface-panel px-4 py-4 sm:gap-6 sm:px-8 sm:py-5">
              <div className="min-w-0 flex-1">
                <h3
                  className="break-words text-xl font-bold tracking-tight text-content-strong [overflow-wrap:anywhere] sm:text-2xl"
                  id={titleId}
                >
                  {title}
                </h3>
                {description ? (
                  <p
                    className="mt-2 break-words text-sm leading-7 text-content-muted [overflow-wrap:anywhere]"
                    id={descriptionId}
                  >
                    {description}
                  </p>
                ) : null}
              </div>

              <Button
                aria-label={uiText("closeDialog")}
                onClick={() => onOpenChange(false)}
                ref={closeButtonRef}
                size="icon-compact"
                type="button"
                variant="ghost"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* 文件选择器需要把路径和文件名同时留在视口，业务可缩小内容留白，其他弹窗沿用默认间距。 */}
            <div className={`min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain ${contentClassName??"px-4 py-5 sm:px-8 sm:py-8"}`}>
              {children}
            </div>

            {actions ? (
              <div
                className="flex min-w-0 shrink-0 flex-wrap items-center gap-3 border-t border-border-subtle bg-surface-panel px-4 pt-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] [&>[data-slot=button]]:min-w-[calc(50%-0.375rem)] [&>[data-slot=button]]:flex-1 sm:justify-end sm:px-8 sm:py-4 sm:[&>[data-slot=button]]:min-w-0 sm:[&>[data-slot=button]]:flex-none"
                data-testid="dashboard-dialog-actions"
              >
                {actions}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    portalHost,
  );
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR),
  ).filter((element) => {
    if (element.tabIndex < 0) {
      return false;
    }

    return (
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true" &&
      (element.offsetWidth > 0 ||
        element.offsetHeight > 0 ||
        element.getClientRects().length > 0)
    );
  });
}
