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
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const reload = useCallback(async () => {
    const client = getBrowserSupabaseClient();
    if (!client) return;
    const [allowed, latest] = await Promise.all([canRecalculate(client), readRecalculation(client)]);
    setVerified(allowed); setPreview(latest);
  }, []);
  useEffect(() => { void reload().catch(() => setMessage(t("loadFailed"))); }, [reload, t]);
  const submit = async (execute: boolean) => {
    const client = getBrowserSupabaseClient();
    if (!client || pending) return;
    setPending(true); setMessage("");
    try {
      const result = execute && preview ? await executeRecalculation(client, preview) : await createRecalculationPreview(client);
      setPreview(result);
    } catch {
      setMessage(t("actionFailed"));
      // 请求中断时独立读取终态，避免重复创建或把断线当成已回滚。
      await reload().catch(() => undefined);
    } finally { setPending(false); }
  };
  return { preview, verified, pending, message, prepare: () => submit(false), execute: () => submit(true), reload };
}
