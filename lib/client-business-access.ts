import type { SupabaseClient } from "@supabase/supabase-js";

import type { WorkspaceBusinessKey } from "./workspace-business-access";
import { queryCompleteDashboardRows } from "./dashboard-complete-query";
import { parseEnabledWorkspaceBusinessKey } from "./workspace-business-availability";

export type ClientBusinessCandidate = {
  email: string | null;
  name: string | null;
  phone: string | null;
  userId: string;
};

export type ClientBusinessAdditionReceipt = {
  businessKey: WorkspaceBusinessKey;
  wholesaleCustomerId: string;
};

export const CLIENT_BUSINESS_RECEIPT_UNCONFIRMED = "client_business_receipt_unconfirmed";

export async function getClientBusinessCandidates(
  supabase: SupabaseClient,
  business: WorkspaceBusinessKey,
): Promise<ClientBusinessCandidate[]> {
  const enabledBusiness = parseEnabledWorkspaceBusinessKey(business);
  // 候选较多时也要读完整列表，按唯一账号编号分页可避免分批顺序漂移。
  const { data, error } = await queryCompleteDashboardRows<unknown>(
    supabase.rpc("admin_list_client_business_candidates", { _business_key: enabledBusiness }).order("user_id"),
  );

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    throw new Error("client_business_candidates_invalid");
  }

  // RPC 返回值仍按不可信网络数据处理，只把字段齐全的记录交给界面。
  return data.flatMap((item) => {
    if (!isRecord(item) || typeof item.user_id !== "string") {
      return [];
    }

    return [
      {
        email: normalizeOptionalString(item.email),
        name: normalizeOptionalString(item.name),
        phone: normalizeOptionalString(item.phone),
        userId: item.user_id,
      },
    ];
  });
}

export async function addClientToBusiness(
  supabase: SupabaseClient,
  userId: string,
  business: WorkspaceBusinessKey,
): Promise<ClientBusinessAdditionReceipt> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error("client_business_user_invalid");
  }

  const enabledBusiness = parseEnabledWorkspaceBusinessKey(business);
  const { data, error } = await supabase.rpc("admin_add_client_to_business", {
    _business_key: enabledBusiness,
    _target_user_id: normalizedUserId,
  });

  if (error) {
    throw error;
  }

  // 数据库函数定义为返回一行。必须确认正好收到一条、业务板块一致且客户编号有效，
  // 避免空数组或结构异常时页面仍然显示“添加成功”。
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    throw new Error(CLIENT_BUSINESS_RECEIPT_UNCONFIRMED);
  }

  const receipt = data[0];
  if (
    receipt.business_key !== enabledBusiness ||
    typeof receipt.wholesale_customer_id !== "string" ||
    !receipt.wholesale_customer_id.trim()
  ) {
    throw new Error(CLIENT_BUSINESS_RECEIPT_UNCONFIRMED);
  }

  // 回执里的编号还须指向本次选中的账号，同时确认该账号实际获得业务权限。
  const [customer, access] = await Promise.all([
    supabase.from("wholesale_customers").select("id")
      .eq("id", receipt.wholesale_customer_id).eq("registered_user_id", normalizedUserId).maybeSingle(),
    supabase.from("user_workspace_business_access").select("is_enabled")
      .eq("user_id", normalizedUserId).eq("business_key", enabledBusiness).maybeSingle(),
  ]);
  if (customer.error || !customer.data || access.error || access.data?.is_enabled !== true) {
    throw new Error(CLIENT_BUSINESS_RECEIPT_UNCONFIRMED);
  }

  return {
    businessKey: enabledBusiness,
    wholesaleCustomerId: receipt.wholesale_customer_id,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
