import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import {
  getServiceOrderDetail,
  type OrderSupplementaryOverviewReference,
  type ServiceOrderRecord,
} from "./admin-orders-service-detail";
import type {
  AdminOrderDetailValue,
  AdminOrderSupplementaryDetail,
} from "./admin-orders-types";
import { isVipMembershipScope } from "./vip-memberships";

type PurchaseOrderRecord = {
  order_overview_id: string;
  order_type: string;
  order_details: AdminOrderDetailValue;
};

type PurchaseOrderTypeRecord = {
  business_subcategory: string | null;
};

type VipRechargeOrderRecord = {
  order_overview_id: string;
  vip_scope: string;
  order_details: AdminOrderDetailValue;
};

export async function getAdminOrderSupplementaryDetail(
  supabase: SupabaseClient,
  orderNumber: string,
): Promise<AdminOrderSupplementaryDetail | null> {
  const overview = await getOrderOverviewReference(supabase, orderNumber);

  if (!overview) {
    return null;
  }

  // 补充表以总单 ID 关联。沿用采购、服务、VIP 的原有分派顺序。
  const [purchaseResult, serviceResult, vipResult] = await Promise.all([
    withRequestTimeout(
      supabase
        .from("purchase_order")
        .select("order_overview_id,order_type,order_details")
        .eq("order_overview_id", overview.id)
        .maybeSingle<PurchaseOrderRecord>(),
    ),
    withRequestTimeout(
      supabase
        .from("service_order")
        .select("order_overview_id,order_type,order_discount,price_option_id,service_fee_type,order_details")
        .eq("order_overview_id", overview.id)
        .maybeSingle<ServiceOrderRecord>(),
    ),
    withRequestTimeout(
      supabase
        .from("vip_recharge_order")
        .select("order_overview_id,vip_scope,order_details")
        .eq("order_overview_id", overview.id)
        .maybeSingle<VipRechargeOrderRecord>(),
    ),
  ]);

  if (purchaseResult.error) {
    throw purchaseResult.error;
  }

  if (serviceResult.error) {
    throw serviceResult.error;
  }

  if (vipResult.error) {
    throw vipResult.error;
  }

  if (purchaseResult.data) {
    const { data: purchaseType, error: purchaseTypeError } = await withRequestTimeout(
      supabase
        .from("purchase_order_type")
        .select("business_subcategory")
        .eq("id", purchaseResult.data.order_type)
        .maybeSingle<PurchaseOrderTypeRecord>(),
    );

    if (purchaseTypeError) {
      throw purchaseTypeError;
    }

    return {
      kind: "purchase",
      orderNumber: overview.order_number,
      subtypeId: purchaseResult.data.order_type,
      subtype: purchaseType?.business_subcategory ?? null,
      details: purchaseResult.data.order_details,
    };
  }

  if (serviceResult.data) {
    return getServiceOrderDetail(supabase, overview, serviceResult.data);
  }

  if (vipResult.data) {
    return {
      kind: "vip_recharge",
      orderNumber: overview.order_number,
      vipScope: isVipMembershipScope(vipResult.data.vip_scope)
        ? vipResult.data.vip_scope
        : "retail",
      details: vipResult.data.order_details,
    };
  }

  return null;
}

async function getOrderOverviewReference(
  supabase: SupabaseClient,
  orderNumber: string,
): Promise<OrderSupplementaryOverviewReference | null> {
  const normalizedOrderNumber = orderNumber.trim();

  if (!normalizedOrderNumber) {
    return null;
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from("order_overview")
      .select("id,order_number,rmb_amount,service_fee_type")
      .eq("order_number", normalizedOrderNumber)
      .maybeSingle<OrderSupplementaryOverviewReference>(),
  );

  if (error) {
    throw error;
  }

  return data ?? null;
}
