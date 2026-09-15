"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  acknowledgeSystemHealthAlert,
  getSystemOperationHealth,
  type SystemOperationHealth,
} from "@/lib/system-operation-health";

import { SystemHealthSections } from "./system-health-sections";

type SystemHealthClientProps = {
  initialData: SystemOperationHealth;
};

/** 页面组件只保存交互状态；查询、回执校验和具体列表渲染均由独立模块负责。 */
export function SystemHealthClient({ initialData }: SystemHealthClientProps) {
  const t = useTranslations("SystemHealth");
  const locale = useLocale();
  const [data, setData] = useState(initialData);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    setPending("refresh");
    setError(null);
    try {
      setData(await getSystemOperationHealth(supabase));
    } catch {
      setError(t("loadFailed"));
    } finally {
      setPending(null);
    }
  }, [t]);

  const acknowledge = useCallback(async (alertId: string) => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    setPending(alertId);
    setError(null);
    try {
      await acknowledgeSystemHealthAlert(supabase, alertId);
      setData(await getSystemOperationHealth(supabase));
    } catch {
      setError(t("acknowledgeFailed"));
    } finally {
      setPending(null);
    }
  }, [t]);

  return (
    <SystemHealthSections
      data={data}
      error={error}
      locale={locale}
      onAcknowledge={acknowledge}
      onRefresh={refresh}
      pending={pending}
    />
  );
}
