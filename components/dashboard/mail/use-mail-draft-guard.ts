"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";

/** 邮件正文只保存在当前页面；切换会话或刷新前提示，避免无意丢失输入。 */
export function useMailDraftGuard() {
  const [dirty, setDirty] = useState(false);
  const confirm = useDashboardConfirm();
  const t = useTranslations("MailWorkspace");

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const canDiscard = useCallback(async () => {
    if (!dirty) return true;
    return confirm({
      title: t("unsavedDraftTitle"),
      description: t("unsavedDraftDescription"),
      tone: "danger",
    });
  }, [confirm, dirty, t]);

  return { dirty, setDirty, canDiscard };
}
