"use client";

import { useCallback, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { convertSalesLeadToCustomer, getSalesLeadCustomerErrorCode } from "@/lib/sales-lead-customer";
import { fetchSalesLeadDetail } from "@/lib/sales-leads";
import type { SalesLead, SalesLeadCustomerInput, SalesLeadDetail } from "@/lib/sales-leads-types";

/** 弹窗生命周期和提交互斥独立管理；页面只负责打开入口及刷新看板。 */
export function useSalesLeadCustomer(onSaved: () => Promise<void>) {
  const [detail, setDetail] = useState<SalesLeadDetail | null>(null);
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<"saved" | "confirming" | null>(null);
  const busy = useRef(false);
  const open = useCallback(async (lead: SalesLead) => {
    if (busy.current) return;
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    busy.current = true;
    setPending(true);
    setNotice(null);
    setErrorCode(null);
    // 先留下原始认领周期；新读取发现已经转派时，不替用户转换另一个周期。
    setDetail({ lead, assignments: [], contacts: [] });
    try {
      const fresh = await fetchSalesLeadDetail(supabase, lead.id);
      if (fresh.lead.status !== "claimed" || fresh.lead.current_assignment_id !== lead.current_assignment_id) {
        throw new Error("sales_lead_assignment_changed");
      }
      setDetail(fresh);
    } catch (error) {
      setErrorCode(getSalesLeadCustomerErrorCode(error));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, []);
  const close = useCallback(() => {
    if (busy.current) return;
    setDetail(null);
    setErrorCode(null);
  }, []);
  const submit = useCallback(async (input: SalesLeadCustomerInput) => {
    if (busy.current) return;
    const supabase = getBrowserSupabaseClient();
    if (!supabase) { setErrorCode("sales_lead_save_unconfirmed"); return; }
    busy.current = true;
    setPending(true);
    setErrorCode(null);
    try {
      await convertSalesLeadToCustomer(supabase, input);
      setDetail(null);
      setNotice("saved");
      // 已核对真实客户后，列表刷新失败只能影响展示，不能让用户再建一份客户档案。
      try { await onSaved(); } catch { setNotice("confirming"); }
    } catch (error) {
      const code = getSalesLeadCustomerErrorCode(error);
      setErrorCode(code);
      if (code === "sales_lead_save_unconfirmed") setNotice("confirming");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, [onSaved]);
  return { detail, errorCode, notice, pending, open, close, submit };
}
