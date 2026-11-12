import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateOrderServiceFeeAmount } from "./admin-orders-service-fees";
import type { AdminOrderDetailValue, AdminOrderSupplementaryDetail, OrderOverviewReference } from "./admin-orders-types";
import { withRequestTimeout } from "./request-timeout";

export type ServiceOrderRecord = {
  order_overview_id: string;
  order_type: string;
  order_discount: string;
  price_option_id: string;
  service_fee_type: string | null;
  order_details: AdminOrderDetailValue;
};

type ServiceOrderTypeRecord = {
  business_subcategory: string | null;
};

type OrderDiscountTypeRecord = {
  discount_ratio: number | string | null;
};

type ServiceFeeTypeRecord = {
  fee_ratio: number | string | null;
};

type ServiceOrderPriceOptionRecord = {
  display_name: string | null;
  amount_usd: number | string | null;
};

export type OrderSupplementaryOverviewReference = OrderOverviewReference & {
  rmb_amount: number | string | null;
  service_fee_type: string | null;
};

// 服务单按已保存的子类型、折扣和价格编号读详情；总单已确定的费用类型优先。
export async function getServiceOrderDetail(
  supabase: SupabaseClient,
  overview: OrderSupplementaryOverviewReference,
  service: ServiceOrderRecord,
): Promise<Extract<AdminOrderSupplementaryDetail, { kind: "service" }>> {
  const serviceFeeTypeId =
    overview.service_fee_type ?? service.service_fee_type;
  const [serviceTypeResult, discountTypeResult, priceOptionResult, serviceFeeTypeResult] = await Promise.all([
    withRequestTimeout(
      supabase
        .from("service_order_type")
        .select("business_subcategory")
        .eq("id", service.order_type)
        .maybeSingle<ServiceOrderTypeRecord>(),
    ),
    withRequestTimeout(
      supabase
        .from("order_discount_type")
        .select("discount_ratio")
        .eq("id", service.order_discount)
        .maybeSingle<OrderDiscountTypeRecord>(),
    ),
    withRequestTimeout(
      supabase
        .from("service_order_price_option")
        .select("display_name,amount_usd")
        .eq("id", service.price_option_id)
        .maybeSingle<ServiceOrderPriceOptionRecord>(),
    ),
    serviceFeeTypeId
      ? withRequestTimeout(
          supabase
            .from("service_fee_type")
            .select("fee_ratio")
            .eq("id", serviceFeeTypeId)
            .maybeSingle<ServiceFeeTypeRecord>(),
        )
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (serviceTypeResult.error) {
    throw serviceTypeResult.error;
  }

  if (discountTypeResult.error) {
    throw discountTypeResult.error;
  }

  if (serviceFeeTypeResult.error) {
    throw serviceFeeTypeResult.error;
  }

  if (priceOptionResult.error) {
    throw priceOptionResult.error;
  }

  return {
    kind: "service",
    orderNumber: overview.order_number,
    subtypeId: service.order_type,
    subtype: serviceTypeResult.data?.business_subcategory ?? null,
    discountId: service.order_discount,
    discountRatio: discountTypeResult.data?.discount_ratio ?? null,
    priceOptionId: service.price_option_id,
    priceOptionLabel: priceOptionResult.data?.display_name ?? null,
    priceAmountUsd: priceOptionResult.data?.amount_usd ?? null,
    serviceFeeAmount: calculateOrderServiceFeeAmount(
      overview.rmb_amount,
      serviceFeeTypeResult.data?.fee_ratio ?? null,
    ),
    serviceFeeRatio: serviceFeeTypeResult.data?.fee_ratio ?? null,
    serviceFeeTypeId,
    details: service.order_details,
  };
}
