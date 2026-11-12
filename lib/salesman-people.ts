import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole } from "./auth-routing";
import { normalizeUserStatus } from "./auth-metadata";
import { withRequestTimeout } from "./request-timeout";
import { getCurrentSalesmanBusinessBoards, salesmanBusinessBoardsInclude } from "./salesman-business-access";
import { isSalesmanCustomerType, type SalesmanCustomerRow, type SalesmanPeoplePageData } from "./salesman-people-contract";
import { isSalesStaffRole } from "./sales-staff-roles";
import { getCurrentSessionContext, type UserStatus } from "./user-self-service";
import { normalizeOptionalString } from "./value-normalizers";

export function canViewSalesmanPeople(
  role: AppRole | null,
  status: UserStatus | null,
) {
  return isSalesStaffRole(role) && status === "active";
}

export async function getSalesmanPeoplePageData(
  supabase: SupabaseClient,
): Promise<SalesmanPeoplePageData> {
  const sessionContext = await getCurrentSessionContext(supabase);

  if (
    !sessionContext.user ||
    !canViewSalesmanPeople(sessionContext.role, sessionContext.status)
  ) {
    return {
      businessBoards: [],
      hasPermission: false,
      currentViewerId: sessionContext.user?.id ?? null,
      customers: [],
    };
  }

  // 先核对工作台岗位，再使用数据库授权的业务板块判断历史入口。
  const businessBoards = await getCurrentSalesmanBusinessBoards(supabase);

  if (
    !salesmanBusinessBoardsInclude(businessBoards, "tourism")
  ) {
    return {
      businessBoards,
      hasPermission: false,
      currentViewerId: sessionContext.user.id,
      customers: [],
    };
  }

  return {
    businessBoards,
    hasPermission: true,
    currentViewerId: sessionContext.user.id,
    customers: await getSalesmanCustomerDirectory(supabase),
  };
}

export async function getSalesmanCustomerDirectory(
  supabase: SupabaseClient,
): Promise<SalesmanCustomerRow[]> {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("get_salesman_customer_directory"),
  );

  if (error) {
    throw error;
  }

  return normalizeSalesmanCustomerRows(data);
}

export async function getSalesmanCustomerRowById(
  supabase: SupabaseClient,
  userId: string,
): Promise<SalesmanCustomerRow | null> {
  const rows = await getSalesmanCustomerDirectory(supabase);

  return rows.find((row) => row.user_id === userId) ?? null;
}

function normalizeSalesmanCustomerRows(value: unknown): SalesmanCustomerRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeSalesmanCustomerRow(item))
    .filter((item): item is SalesmanCustomerRow => item !== null);
}

export function normalizeSalesmanCustomerRow(
  value: unknown,
): SalesmanCustomerRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const userId = normalizeOptionalString(value.user_id);
  const status = normalizeUserStatus(value.status);
  const createdAt = normalizeOptionalString(value.created_at);

  if (!userId || !status || !createdAt) {
    return null;
  }

  return {
    user_id: userId,
    name: normalizeOptionalString(value.name),
    email: normalizeOptionalString(value.email),
    phone: normalizeOptionalString(value.phone),
    city: normalizeOptionalString(value.city),
    status,
    customer_type: isSalesmanCustomerType(value.customer_type)
      ? value.customer_type
      : null,
    marked_at: normalizeOptionalString(value.marked_at),
    created_at: createdAt,
    private_note: normalizeOptionalString(value.private_note),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
