"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  addSalesLeadContact,
  assignSalesLead,
  claimSalesLead,
  fetchSalesLeadDetail,
  fetchSalesLeadPage,
  markSalesLeadUsed,
  reopenSalesLead,
  requestSalesLeadSync,
  returnSalesLead,
} from "@/lib/sales-leads";
import type {
  SalesLead,
  SalesLeadBoard,
  SalesLeadContactInput,
  SalesLeadDetail,
  SalesLeadPageData,
} from "@/lib/sales-leads-types";

export type LeadAction = "contact" | "return" | "use" | "assign" | "reopen";

export function useSalesLeadsPage(initialData: SalesLeadPageData) {
  const [data, setData] = useState(initialData);
  const [board, setBoard] = useState<SalesLeadBoard>(initialData.board);
  const [search, setSearch] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SalesLeadDetail | null>(null);
  const [action, setAction] = useState<LeadAction | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestVersion = useRef(0);

  const refresh = useCallback(async (nextBoard = board, nextOffset = 0) => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    // 翻页是明确的新读取操作，取消尚未开始的首屏/搜索延迟刷新，防止随后被第一页覆盖。
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const version = ++requestVersion.current;
    setPending("refresh");
    setError(null);
    try {
      const nextData = await fetchSalesLeadPage(supabase, {
          board: nextBoard,
          canManage: initialData.canManage,
          search,
          assigneeUserId,
          offset: nextOffset,
        });
      // 较早的慢请求可以完成，但不得覆盖用户最后一次筛选或分页的结果。
      if (version === requestVersion.current) setData(nextData);
    } catch (nextError) {
      if (version === requestVersion.current) setError(getLeadErrorCode(nextError));
    } finally {
      if (version === requestVersion.current) setPending(null);
    }
  }, [assigneeUserId, board, initialData.canManage, search]);

  useEffect(() => {
    refreshTimer.current = setTimeout(() => void refresh(board, 0), 300);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      requestVersion.current += 1;
    };
  }, [board, search, assigneeUserId, refresh]);

  const openDetail = useCallback(async (lead: SalesLead) => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    setPending(lead.id);
    setError(null);
    try {
      setDetail(await fetchSalesLeadDetail(supabase, lead.id));
    } catch (nextError) {
      setError(getLeadErrorCode(nextError));
    } finally {
      setPending(null);
    }
  }, []);

  const claim = useCallback(async (leadId: string) => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    setPending(leadId);
    setError(null);
    try {
      await claimSalesLead(supabase, leadId);
      setBoard("mine");
    } catch (nextError) {
      const errorCode = getLeadErrorCode(nextError);
      await refresh();
      // 刷新大厅以显示最新认领结果后，再恢复清楚的竞争失败提示。
      setError(errorCode);
    } finally {
      setPending(null);
    }
  }, [refresh]);

  const submitAction = useCallback(async (input: {
    action: LeadAction;
    leadId: string;
    reason: string;
    assigneeUserId?: string;
    contact?: Omit<SalesLeadContactInput, "leadId">;
  }) => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return false;
    setPending(input.leadId);
    setError(null);
    try {
      if (input.action === "contact" && input.contact) {
        await addSalesLeadContact(supabase, { leadId: input.leadId, ...input.contact });
      } else if (input.action === "return") {
        await returnSalesLead(supabase, input.leadId, input.reason);
      } else if (input.action === "use") {
        await markSalesLeadUsed(supabase, input.leadId, input.reason);
      } else if (input.action === "assign" && input.assigneeUserId) {
        await assignSalesLead(supabase, input.leadId, input.assigneeUserId, input.reason);
      } else if (input.action === "reopen") {
        await reopenSalesLead(supabase, input.leadId, input.reason);
      }
      setAction(null);
      setDetail(null);
      await refresh();
      return true;
    } catch (nextError) {
      setError(getLeadErrorCode(nextError));
      return false;
    } finally {
      setPending(null);
    }
  }, [refresh]);

  const syncNow = useCallback(async () => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    setPending("sync");
    setError(null);
    try {
      await requestSalesLeadSync(supabase);
      await refresh();
    } catch (nextError) {
      setError(getLeadErrorCode(nextError));
    } finally {
      setPending(null);
    }
  }, [refresh]);

  return useMemo(() => ({
    action, assigneeUserId, board, data, detail, error, pending, search,
    claim, openDetail, refresh, setAction, setAssigneeUserId, setBoard,
    setDetail, setSearch, submitAction, syncNow,
  }), [action, assigneeUserId, board, claim, data, detail, error, openDetail, pending, refresh, search, submitAction, syncNow]);
}

function getLeadErrorCode(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    const message = String(error.message);
    const knownCode = message.match(/sales_lead_[a-z_]+/)?.[0];
    return knownCode ?? "unknown";
  }
  return "unknown";
}
