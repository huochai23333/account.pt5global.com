import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import type { AdminOrderRow } from "./admin-orders-types";

type OrderServiceFeeRow = {
  id: string;
  service_fee_type: string | null;
};

type ServiceFeeRatioRecord = {
  display_name: string | null;
  id: string;
  fee_ratio: number | string;
};

export type AdminOrderServiceFeeRow = {
  order_overview_id: string;
  service_fee_amount: number | null;
  service_fee_ratio: number | string | null;
  service_fee_type_id: string | null;
  service_fee_type_name: string | null;
};

export async function getAdminOrderServiceFees(
  supabase: SupabaseClient,
  orderIds: string[],
): Promise<AdminOrderServiceFeeRow[]> {
  if (orderIds.length === 0) {
    return [];
  }

  const { data: serviceRows, error: serviceRowsError } = await withRequestTimeout(
    supabase
      .from("order_overview")
      .select("id,service_fee_type")
      .in("id", orderIds)
      .returns<OrderServiceFeeRow[]>(),
  );

  if (serviceRowsError) {
    throw serviceRowsError;
  }

  const feeTypeIds = Array.from(
    new Set(
      (serviceRows ?? [])
        .map((row) => row.service_fee_type)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (feeTypeIds.length === 0) {
    return [];
  }

  const { data: feeTypes, error: feeTypesError } = await withRequestTimeout(
    supabase
      .from("service_fee_type")
      .select("id,fee_ratio,display_name")
      .in("id", feeTypeIds)
      .returns<ServiceFeeRatioRecord[]>(),
  );

  if (feeTypesError) {
    throw feeTypesError;
  }

  const feeRatioById = new Map(
    (feeTypes ?? []).map((row) => [row.id, row.fee_ratio]),
  );
  const feeNameById = new Map(
    (feeTypes ?? []).map((row) => [row.id, row.display_name]),
  );

  return (serviceRows ?? []).map((row) => ({
    order_overview_id: row.id,
    service_fee_amount: null,
    service_fee_ratio: row.service_fee_type
      ? (feeRatioById.get(row.service_fee_type) ?? null)
      : null,
    service_fee_type_id: row.service_fee_type,
    service_fee_type_name: row.service_fee_type
      ? (feeNameById.get(row.service_fee_type) ?? null)
      : null,
  }));
}

export function mergeAdminOrdersWithServiceFees(
  orders: AdminOrderRow[],
  serviceFees: AdminOrderServiceFeeRow[],
): AdminOrderRow[] {
  if (orders.length === 0 || serviceFees.length === 0) {
    return orders.map((order) => ({
      ...order,
      service_fee_amount: order.service_fee_amount ?? null,
      service_fee_ratio: order.service_fee_ratio ?? null,
      service_fee_type_id: order.service_fee_type_id ?? null,
      service_fee_type_name: order.service_fee_type_name ?? null,
    }));
  }

  const feeByOrderId = new Map(
    serviceFees.map((row) => [row.order_overview_id, row]),
  );

  return orders.map((order) => {
    const serviceFee = feeByOrderId.get(order.id);
    const serviceFeeRatio = serviceFee?.service_fee_ratio ?? null;

    return {
      ...order,
      service_fee_amount: calculateOrderServiceFeeAmount(
        order.rmb_amount,
        serviceFeeRatio,
      ),
      service_fee_ratio: serviceFeeRatio,
      service_fee_type_id: serviceFee?.service_fee_type_id ?? null,
      service_fee_type_name: serviceFee?.service_fee_type_name ?? null,
    };
  });
}

// 列表和详情共用历史服务费口径，以人民币金额乘已保存的费率并保留两位。
export function calculateOrderServiceFeeAmount(
  rmbAmount: number | string | null,
  serviceFeeRatio: number | string | null,
) {
  const amount = parseNumericValue(rmbAmount);
  const ratio = parseNumericValue(serviceFeeRatio);

  if (amount === null || ratio === null) {
    return null;
  }

  return Math.round(amount * ratio * 100) / 100;
}

function parseNumericValue(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}
