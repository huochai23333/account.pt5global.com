"use client";

import { useEffect, useState } from "react";
import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";

export function useWholesaleOrderDraft({
  open,
  pending,
  onOpenChange,
  title,
  discardMessage,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  discardMessage: string;
}) {
  const [dirty, setDirty] = useState(false);
  const confirm = useDashboardConfirm();

  useEffect(() => {
    if (!open || !dirty) return;
    // 离开整页由浏览器提醒，弹窗内部关闭则走共享确认框。
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (pending) return;
    if (!dirty) {
      onOpenChange(false);
      return;
    }

    void confirm({ title, description: discardMessage, tone: "warning" }).then((accepted) => {
      if (!accepted) return;
      setDirty(false);
      onOpenChange(false);
    });
  }

  return {
    clearDraft: () => setDirty(false),
    handleOpenChange,
    markDirty: () => setDirty(true),
  };
}
