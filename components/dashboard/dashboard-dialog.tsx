"use client";

import type { ReactNode } from "react";
import { useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { MOTION_DURATION, MOTION_EASING } from "@/lib/motion-tokens";

import { useDashboardDialogFocus } from "./dashboard-dialog-focus";

type DashboardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
};

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
  // Portal 就绪后交给焦点 Hook，弹窗本身只负责显示与关闭意图。
  useDashboardDialogFocus({
    active: open && Boolean(portalHost),
    dialogRef,
    onClose: () => onOpenChange(false),
  });

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
            onClick={() => onOpenChange(false)}
            style={{ willChange: "opacity" }}
            tabIndex={-1}
            transition={overlayTransition}
            type="button"
          />

          {/* 外壳裁切圆角，滚动由正文容器承担。浏览器聚焦正文控件时不能把整个弹窗横移。 */}
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-describedby={description ? descriptionId : undefined}
            aria-labelledby={titleId}
            aria-modal="true"
            className="relative z-10 flex max-h-[calc(100dvh-2rem)] min-w-0 w-full max-w-4xl flex-col overflow-clip rounded-surface-panel border border-surface-panel-border bg-surface-overlay shadow-surface-floating backdrop-blur-2xl backdrop-saturate-150"
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
                size="icon-compact"
                type="button"
                variant="ghost"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* 文件选择器需要把路径和文件名同时留在视口，业务可缩小内容留白，其他弹窗沿用默认间距。 */}
            <div
              className={`min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain ${contentClassName ?? "px-4 py-5 sm:px-8 sm:py-8"}`}
            >
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
