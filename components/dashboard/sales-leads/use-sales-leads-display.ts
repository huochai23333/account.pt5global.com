"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import type { SalesLeadBoard, SalesLeadPageData } from "@/lib/sales-leads-types";

export type SalesLeadViewMode = "list" | "card";
const storageKey = "pt5-sales-leads-view";
const changeEvent = "pt5-sales-leads-view-change";
function readMode(): SalesLeadViewMode {
  try { return localStorage.getItem(storageKey) === "card" ? "card" : "list"; }
  catch { return "list"; }
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => { window.removeEventListener("storage", onChange); window.removeEventListener(changeEvent, onChange); };
}

// 展示偏好不参与查询依赖，因此切换布局不会重新请求、清空筛选或回到第一页。
export function useSalesLeadsDisplay(data: SalesLeadPageData) {
  const t = useTranslations("SalesLeads");
  const savedMode = useSyncExternalStore(subscribe, readMode, () => "list" as const);
  const [unsavedMode, setUnsavedMode] = useState<SalesLeadViewMode | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const setMode = (mode: SalesLeadViewMode) => {
    try {
      localStorage.setItem(storageKey, mode);
      setUnsavedMode(null);
      window.dispatchEvent(new Event(changeEvent));
    } catch {
      // 浏览器禁用存储时，仍保存本次页面内的选择，让切换操作正常工作。
      setUnsavedMode(mode);
    }
  };
  const boardOptions = useMemo(() => {
    const options: Array<{ key: SalesLeadBoard; label: string; badge: number }> = [
      { key: "hall", label: t("boards.hall"), badge: data.boardCounts.hall },
      { key: "mine", label: t("boards.mine"), badge: data.boardCounts.mine },
      { key: "used", label: t("boards.used"), badge: data.boardCounts.used },
    ];
    if (data.canManage) options.push({ key: "all_claimed", label: t("boards.allClaimed"), badge: data.boardCounts.allClaimed });
    return options;
  }, [t, data.boardCounts, data.canManage]);
  return { mode: unsavedMode ?? savedMode, setMode, now, boardOptions };
}
