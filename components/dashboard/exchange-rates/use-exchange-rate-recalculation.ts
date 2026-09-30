"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { canRecalculate, createRecalculationPreview, executeRecalculation, readRecalculation, type RecalculationPreview } from "@/lib/exchange-rate-recalculation";
import { getBrowserSupabaseClient } from "@/lib/supabase";

/** 只管理核算请求与已保存凭证，展示交给独立区块；页面关闭后仍可恢复结果。 */
export function useExchangeRateRecalculation() {
  const t = useTranslations("ExchangeRates.recalculation");
  const [preview, setPreview] = useState<RecalculationPreview | null>(null);
  const [verified, setVerified] = useState(false);
  const [pendingAction, setPendingAction] = useState<"preview" | "execute" | "refresh" | null>(null);
  const [message, setMessage] = useState("");
  const reload = useCallback(async (showLoading = true) => {
    const client = getBrowserSupabaseClient();
    if (!client) return;
    if (showLoading) setPendingAction("refresh");
    try {
      const [allowed, latest] = await Promise.all([canRecalculate(client), readRecalculation(client)]);
      setVerified(allowed); setPreview(latest);
    } finally {
      if (showLoading) setPendingAction(null);
    }
  }, []);
  useEffect(() => { void reload().catch(() => setMessage(t("loadFailed"))); }, [reload, t]);
  const submit = async (execute: boolean) => {
    const client = getBrowserSupabaseClient();
    if (!client || pendingAction) return;
    // 预览、执行和刷新各有自己的等待图标，防止三个按钮同时显示正在处理。
    setPendingAction(execute ? "execute" : "preview"); setMessage("");
    try {
      const result = execute && preview ? await executeRecalculation(client, preview) : await createRecalculationPreview(client);
      setPreview(result);
    } catch {
      setMessage(t("actionFailed"));
      // 请求中断时独立读取终态，避免重复创建或把断线当成已回滚。
      await reload(false).catch(() => undefined);
    } finally { setPendingAction(null); }
  };
  return { preview, verified, pending: pendingAction !== null, pendingAction, message, prepare: () => submit(false), execute: () => submit(true), reload };
}
