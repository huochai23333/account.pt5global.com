import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getOrderUserOptions } from "./admin-orders";
import {
  normalizeCommissionRow,
  type AdminCommissionRow,
  type CommissionOrderReferenceRecord,
  type CommissionRecordRow,
} from "./admin-commission-normalizers";
import { withRequestTimeout } from "./request-timeout";
import { getTaskCommissions, type TaskCommissionRow } from "./task-commissions";
import { getCurrentSessionContext, type AppRole, type UserStatus } from "./user-self-service";
import { getDashboardQueryRange, MAX_DASHBOARD_QUERY_ROWS } from "./dashboard-pagination";

const ADMIN_COMMISSION_SELECT =
  "id,order_overview_id,beneficiary_user_id,commission_category,source_customer_user_id,source_salesman_user_id,order_amount_rmb_snapshot,cost_amount_rmb_snapshot,service_fee_amount_rmb_snapshot,commission_amount_rmb,calculation_snapshot,settlement_status,settled_at,settlement_note,created_at,updated_at";
const COMMISSION_ORDER_REFERENCE_SELECT = "id,order_number,order_status,deleted_at,completed_at";

export type {
  AdminCommissionActor,
  AdminCommissionRow,
  CommissionCategory,
  CommissionSettlementStatus,
} from "./admin-commission-normalizers";

export type AdminCommissionViewerContext = {
  user: User;
  role: AppRole | null;
  status: UserStatus | null;
};

export type AdminCommissionPageData = {
  hasPermission: boolean;
  commissions: AdminCommissionRow[];
  taskCommissions: TaskCommissionRow[];
};

export async function getCurrentCommissionViewerContext(
  supabase: SupabaseClient,
): Promise<AdminCommissionViewerContext | null> {
  const { user, role, status } = await getCurrentSessionContext(supabase);

  if (!user) {
    return null;
  }

  return {
    user,
    role,
    status,
  };
}

export function canViewAdminCommissionBoard(role: AppRole | null, status: UserStatus | null) {
  return status === "active" && (role === "administrator" || role === "finance");
}

export async function getAdminCommissionPageData(
  supabase: SupabaseClient,
): Promise<AdminCommissionPageData> {
  // 登录身份决定能否打开管理看板，记录可见范围仍由数据库策略限制。
  const viewer = await getCurrentCommissionViewerContext(supabase);

  if (!viewer || !canViewAdminCommissionBoard(viewer.role, viewer.status)) {
    return {
      hasPermission: false,
      commissions: [],
      taskCommissions: [],
    };
  }

  const [commissions, taskCommissions] = await Promise.all([
    getAdminCommissions(supabase),
    getTaskCommissions(supabase),
  ]);

  return {
    hasPermission: true,
    commissions,
    taskCommissions,
  };
}

export async function getAdminCommissions(
  supabase: SupabaseClient,
  options?: {
    beneficiaryUserId?: string | null;
    limit?: number;
  },
): Promise<AdminCommissionRow[]> {
  const [commissionRows, userOptions] = await Promise.all([
    getCommissionRecordRows(supabase, options),
    getOrderUserOptions(supabase),
  ]);

  if (commissionRows.length === 0) {
    return [];
  }

  const orderOverviewIds = [...new Set(commissionRows.map((row) => row.order_overview_id))];
  const orderReferences =
    orderOverviewIds.length > 0
      ? await getCommissionOrderReferences(supabase, orderOverviewIds)
      : [];
  const orderById = new Map(orderReferences.map((order) => [order.id, order]));
  const userById = new Map(userOptions.map((option) => [option.user_id, option]));

  return commissionRows.map((row) => normalizeCommissionRow(row, orderById, userById));
}

async function getCommissionRecordRows(
  supabase: SupabaseClient,
  options?: {
    beneficiaryUserId?: string | null;
    limit?: number;
  },
): Promise<CommissionRecordRow[]> {
  const { from, to } = getDashboardQueryRange(options?.limit ?? MAX_DASHBOARD_QUERY_ROWS);
  let commissionQuery = supabase.from("commission_record").select(ADMIN_COMMISSION_SELECT);

  if (options?.beneficiaryUserId) {
    commissionQuery = commissionQuery.eq("beneficiary_user_id", options.beneficiaryUserId);
  }

  const { data, error } = await withRequestTimeout(
    commissionQuery
      .order("created_at", { ascending: false })
      .range(from, to)
      .returns<CommissionRecordRow[]>(),
  );

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function getCommissionOrderReferences(
  supabase: SupabaseClient,
  orderOverviewIds: string[],
): Promise<CommissionOrderReferenceRecord[]> {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("order_overview")
      .select(COMMISSION_ORDER_REFERENCE_SELECT)
      .in("id", orderOverviewIds)
      .returns<CommissionOrderReferenceRecord[]>(),
  );

  if (error) {
    throw error;
  }

  return data ?? [];
}
