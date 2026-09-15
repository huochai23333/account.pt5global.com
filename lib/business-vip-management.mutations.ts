import type { SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeNote,
  normalizeRequiredId,
} from "./business-vip-management.normalizers";
import type {
  BusinessVipAdjustmentInput,
  BusinessVipMembershipInput,
  BusinessVipRequestInput,
  BusinessVipReviewInput,
} from "./business-vip-management.types";
import { withRequestTimeout } from "./request-timeout";
import { requireMutationId } from "./mutation-receipts";
import { parseEnabledWorkspaceBusinessKey } from "./workspace-business-availability";

// Tourism and wholesale use separate RPCs because their VIP storage models are separate.
export async function requestBusinessVipRecharge(
  _supabase: SupabaseClient,
  input: BusinessVipRequestInput,
) {
  // 该操作只属于已停用的旅游 VIP；先解析业务以返回稳定停用错误。
  parseEnabledWorkspaceBusinessKey(input.business);
  throw new Error("business_vip_invalid_input");
}

export async function reviewBusinessVipRequest(
  _supabase: SupabaseClient,
  input: BusinessVipReviewInput,
) {
  // 该操作只属于已停用的旅游 VIP；批发 VIP 使用独立的直接开通流程。
  parseEnabledWorkspaceBusinessKey(input.business);
  throw new Error("business_vip_invalid_input");
}

export async function manageWholesaleVipMembership(
  supabase: SupabaseClient,
  input: BusinessVipMembershipInput,
) {
  const targetId = normalizeRequiredId(input.targetId);

  const { data, error } = await withRequestTimeout(
    supabase.rpc("manage_wholesale_vip_membership", {
      p_action: input.action,
      p_customer_id: targetId,
      p_note: normalizeNote(input.note),
    }),
  );

  if (error) throw error;
  return requireMutationId(data, "VIP 开通结果没有确认，请刷新后重试。");
}

export async function adjustBusinessVipMembership(
  _supabase: SupabaseClient,
  input: BusinessVipAdjustmentInput,
) {
  // 旧调整接口只服务旅游 VIP，关闭后不再发送任何旅游 RPC。
  parseEnabledWorkspaceBusinessKey(input.business);
  throw new Error("business_vip_invalid_input");
}
