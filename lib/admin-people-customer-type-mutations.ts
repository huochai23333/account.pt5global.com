import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getAdminPersonRowById,
  isCustomerTypeMark,
  type AdminPersonRow,
  type CustomerTypeMark,
} from "./admin-people";
import {
  AdminPeopleMutationError,
} from "./admin-people-mutations";
import { withRequestTimeout } from "./request-timeout";
import { getCurrentSessionContext } from "./user-self-service";

export type AdminCustomerTypeUpdatePayload = {
  customerUserId: string;
  customerType: CustomerTypeMark;
};

const ADMIN_CUSTOMER_TYPE_MUTATION_TIMEOUT_MS = 30_000;

export async function updateAdminCustomerTypeMark(
  supabase: SupabaseClient,
  input: AdminCustomerTypeUpdatePayload,
): Promise<AdminPersonRow> {
  const sessionContext = await getCurrentSessionContext(supabase);

  if (
    !sessionContext.user ||
    sessionContext.role !== "administrator" ||
    sessionContext.status !== "active"
  ) {
    throw new AdminPeopleMutationError("forbidden");
  }

  const payload = normalizeAdminCustomerTypePayload(input);

  // 这个旧 RPC 返回 void，因此不能把“没有报错”当成完成。
  // verified-rpc: 调用后必须重新读取目标人员，并逐项核对用户编号和客户标记。
  const { error } = await withRequestTimeout(
    supabase.rpc("admin_set_customer_type_mark", {
      _customer_type: payload.customerType,
      _customer_user_id: payload.customerUserId,
    }),
    {
      timeoutMs: ADMIN_CUSTOMER_TYPE_MUTATION_TIMEOUT_MS,
    },
  );

  if (error) {
    throw error;
  }

  const updatedPerson = await getAdminPersonRowById(
    supabase,
    payload.customerUserId,
  );

  if (!updatedPerson || updatedPerson.user_id !== payload.customerUserId) {
    throw new AdminPeopleMutationError("notFound");
  }

  if (updatedPerson.customer_type !== payload.customerType) {
    throw new AdminPeopleMutationError("unknown");
  }

  return updatedPerson;
}

function normalizeAdminCustomerTypePayload(
  input: AdminCustomerTypeUpdatePayload,
): AdminCustomerTypeUpdatePayload {
  const customerUserId =
    typeof input.customerUserId === "string" ? input.customerUserId.trim() : "";

  if (!customerUserId || !isCustomerTypeMark(input.customerType)) {
    throw new AdminPeopleMutationError("invalidInput");
  }

  return {
    customerType: input.customerType,
    customerUserId,
  };
}
