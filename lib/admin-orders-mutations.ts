import type { SupabaseClient } from "@supabase/supabase-js";

import { ADMIN_ORDER_SELECT } from "./admin-orders-query";
import { getAdminOrderCosts, canViewOrderCosts } from "./admin-orders-costs";
import {
  getAdminOrderServiceFees,
  mergeAdminOrdersWithServiceFees,
} from "./admin-orders-service-fees";
import { getCurrentOrderViewerContext } from "./admin-orders-viewer";
import { withRequestTimeout } from "./request-timeout";
import type {
  AdminOrderRow,
  CreateAdminOrderInput,
  SaveAdminOrderInput,
  UpdateAdminOrderInput,
} from "./admin-orders-types";

export async function createAdminOrder(
  supabase: SupabaseClient,
  input: CreateAdminOrderInput,
): Promise<AdminOrderRow> {
  const savedOrderId = await saveAdminOrder(supabase, input);
  return getRequiredAdminOrderById(supabase, savedOrderId, "Order creation");
}

export async function updateAdminOrder(
  supabase: SupabaseClient,
  input: UpdateAdminOrderInput,
): Promise<AdminOrderRow> {
  const savedOrderId = await saveAdminOrder(supabase, input);
  return getRequiredAdminOrderById(supabase, savedOrderId, "Order update");
}

export async function deleteAdminOrder(
  supabase: SupabaseClient,
  orderNumber: string,
): Promise<void> {
  await runDeleteAdminOrder(supabase, orderNumber, false);
}

export async function forceDeleteAdminOrder(
  supabase: SupabaseClient,
  orderNumber: string,
): Promise<void> {
  await runDeleteAdminOrder(supabase, orderNumber, true);
}

async function runDeleteAdminOrder(
  supabase: SupabaseClient,
  orderNumber: string,
  force: boolean,
): Promise<void> {
  const normalizedOrderNumber = orderNumber.trim();

  if (!normalizedOrderNumber) {
    throw new Error("Order number is required.");
  }

  const { data, error } = await withRequestTimeout(
    supabase.rpc("delete_order", {
      p_order_number: normalizedOrderNumber,
      p_force: force,
    }),
  );

  if (error) {
    throw error;
  }

  if (typeof data !== "string" || !data.trim()) {
    throw new Error("Order deletion did not return the deleted order id.");
  }
}

async function getAdminOrderById(
  supabase: SupabaseClient,
  orderId: string,
): Promise<AdminOrderRow | null> {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("order_overview")
      .select(ADMIN_ORDER_SELECT)
      .eq("id", orderId)
      .maybeSingle<AdminOrderRow>(),
  );

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const viewer = await getCurrentOrderViewerContext(supabase);

  const [orderWithServiceFees] = mergeAdminOrdersWithServiceFees(
    [
      {
        ...data,
        cost_amount: null,
        service_fee_amount: null,
        service_fee_ratio: null,
        service_fee_type_id: data.service_fee_type_id ?? null,
        service_fee_type_name: null,
      },
    ],
    await getAdminOrderServiceFees(supabase, [orderId]),
  );

  if (!orderWithServiceFees) {
    return null;
  }

  if (!viewer || !canViewOrderCosts(viewer.role, viewer.status)) {
    return orderWithServiceFees;
  }

  const [costData] = await getAdminOrderCosts(supabase, [orderId]);

  return {
    ...orderWithServiceFees,
    cost_amount: costData?.cost_amount ?? null,
  };
}

async function getRequiredAdminOrderById(
  supabase: SupabaseClient,
  orderId: string,
  actionLabel: string,
): Promise<AdminOrderRow> {
  const data = await getAdminOrderById(supabase, orderId);

  if (!data) {
    throw new Error(`${actionLabel} succeeded, but the saved order could not be reloaded.`);
  }

  return data;
}

async function saveAdminOrder(
  supabase: SupabaseClient,
  input: SaveAdminOrderInput,
): Promise<string> {
  const hasCostAmount = Object.prototype.hasOwnProperty.call(input, "costAmount");

  const { data, error } = await withRequestTimeout(
    supabase.rpc("save_order", {
      p_original_currency: input.originalCurrency,
      p_amount: input.amount,
      p_daily_exchange_rate: input.dailyExchangeRate,
      p_transaction_rate: input.transactionRate,
      p_rmb_amount: input.rmbAmount,
      p_order_entry_user: input.orderEntryUser,
      p_ordering_user: input.orderingUser,
      p_order_status: input.orderStatus,
      p_order_type: input.orderType,
      p_supplementary: input.supplementary ?? null,
      p_original_order_number: input.originalOrderNumber ?? null,
      p_cost_amount: hasCostAmount ? (input.costAmount ?? null) : null,
      p_has_cost: hasCostAmount ? input.costAmount !== null : null,
    }),
  );

  if (error) {
    throw error;
  }

  if (typeof data !== "string" || !data.trim()) {
    throw new Error("The order save RPC did not return a valid order id.");
  }

  return data.trim();
}
