"use client";

import { useCallback, useRef, useState } from "react";

import {
  fetchSalesLeadDetail,
  getSalesLeadErrorCode,
} from "@/lib/sales-leads";
import {
  addSalesLeadContact,
  assignSalesLead,
  claimSalesLead,
  returnSalesLead,
} from "@/lib/sales-lead-write";
import type { SalesLead, SalesLeadContactInput, SalesLeadDetail } from "@/lib/sales-leads-types";
import { getBrowserSupabaseClient } from "@/lib/supabase";

export type LeadAction = "contact" | "return" | "assign";
export type LeadActionInput = {
  action: LeadAction;
  leadId: string;
  reason: string;
  assigneeUserId?: string;
  contact?: Omit<SalesLeadContactInput, "leadId">;
};

type LeadClient = NonNullable<ReturnType<typeof getBrowserSupabaseClient>>;

export function useSalesLeadActions(onClaimed: () => void, refresh: () => Promise<void>) {
  const [detail, setDetail] = useState<SalesLeadDetail | null>(null);
  const [action, setAction] = useState<LeadAction | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = useRef(false);

  const runAction = useCallback(async (leadId: string, task: (client: LeadClient) => Promise<void>) => {
    // ref 在同一渲染帧内就能阻止第二次提交，列表刷新也不会释放这把锁。
    if (busy.current) return false;
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return false;
    busy.current = true;
    setActionPending(leadId);
    setActionError(null);
    try {
      await task(supabase);
      return true;
    } catch (error) {
      setActionError(getSalesLeadErrorCode(error));
      return false;
    } finally {
      busy.current = false;
      setActionPending(null);
    }
  }, []);

  const openDetail = (lead: SalesLead) => runAction(lead.id, async (supabase) => {
    setDetail(await fetchSalesLeadDetail(supabase, lead.id));
  });

  const claim = (leadId: string) => runAction(leadId, async (supabase) => {
    try {
      await claimSalesLead(supabase, leadId);
      onClaimed();
    } catch (error) {
      // 更新可能已被其他人认领的大厅，再由 runAction 显示原失败原因。
      await refresh();
      throw error;
    }
  });

  const submitAction = (input: LeadActionInput) => runAction(input.leadId, async (supabase) => {
    if (input.action === "contact" && input.contact) {
      await addSalesLeadContact(supabase, { leadId: input.leadId, ...input.contact });
    } else if (input.action === "return") {
      await returnSalesLead(supabase, input.leadId, input.reason);
    } else if (input.action === "assign" && input.assigneeUserId) {
      await assignSalesLead(supabase, input.leadId, input.assigneeUserId, input.reason);
    } else {
      throw new Error("sales_lead_action_invalid");
    }
    // 只有服务确认凭证后才关闭表单，失败时保留本次填写内容。
    setAction(null);
    setDetail(null);
    await refresh();
  });

  return { action, actionError, actionPending, detail, claim, openDetail, setAction, setDetail, submitAction };
}
