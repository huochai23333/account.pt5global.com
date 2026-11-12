"use client";

import { useCallback, useRef, useState } from "react";

import { waitForOperationTerminal, type OperationStatus } from "@/lib/operation-runs";
import { requestSalesLeadSync } from "@/lib/sales-lead-write";
import { getSalesLeadErrorCode } from "@/lib/sales-leads";
import type { SalesLeadPageData } from "@/lib/sales-leads-types";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { useSalesLeadActions } from "./use-sales-lead-actions";
import { useSalesLeadsList } from "./use-sales-leads-list";

export function useSalesLeadsPage(initialData: SalesLeadPageData) {
  const list = useSalesLeadsList(initialData);
  const { refresh, setBoard } = list;
  const actions = useSalesLeadActions(() => setBoard("mine"), refresh);
  const [syncNotice, setSyncNotice] = useState<OperationStatus | "confirming" | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const syncInFlight = useRef(false);

  const syncNow = useCallback(async () => {
    if (syncInFlight.current) return;
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    syncInFlight.current = true;
    setSyncing(true);
    setSyncError(null);
    setSyncNotice(null);
    try {
      const receipt = await requestSalesLeadSync(supabase);
      const result = await waitForOperationTerminal(supabase, receipt.operationId);
      // 请求受理后仍需等待后台终态，超时只显示待确认。
      if (result.kind === "confirming") {
        setSyncNotice("confirming");
        return;
      }
      setSyncNotice(result.run.status);
      await refresh();
    } catch (error) {
      setSyncError(getSalesLeadErrorCode(error));
    } finally {
      syncInFlight.current = false;
      setSyncing(false);
    }
  }, [refresh]);

  return {
    ...list,
    ...actions,
    error: actions.actionError ?? syncError ?? list.error,
    syncing,
    syncNotice,
    syncNow,
  };
}
