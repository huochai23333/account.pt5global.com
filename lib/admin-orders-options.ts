import type { SupabaseClient } from "@supabase/supabase-js";

import {
  normalizeAppRole,
  normalizeUserStatus,
} from "./auth-metadata";
import { withRequestTimeout } from "./request-timeout";
import { getServiceFeeTypes } from "./service-fee-types";
import { getLatestCnyExchangeRates } from "./exchange-rates";
import type {
  BusinessCategoryOption,
  OrderDiscountTypeOption,
  OrderUserOption,
  PurchaseOrderTypeOption,
  ServiceOrderPriceOption,
  ServiceOrderTypeOption,
} from "./admin-orders-types";

export async function getOrderUserOptions(
  supabase: SupabaseClient,
): Promise<OrderUserOption[]> {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("get_order_user_options"),
  );

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item) => ({
    user_id:
      typeof item === "object" && item !== null && "user_id" in item
        ? String(item.user_id)
        : "",
    name:
      typeof item === "object" && item !== null && "name" in item && typeof item.name === "string"
        ? item.name
        : null,
    email:
      typeof item === "object" && item !== null && "email" in item && typeof item.email === "string"
        ? item.email
        : null,
    status: normalizeUserStatus(
      typeof item === "object" && item !== null && "status" in item ? item.status : null,
    ),
    created_at:
      typeof item === "object" && item !== null && "created_at" in item
        ? String(item.created_at ?? "")
        : "",
    role: normalizeAppRole(
      typeof item === "object" && item !== null && "role" in item ? item.role : null,
    ),
  }));
}

export async function getOrderTypeOptions(
  supabase: SupabaseClient,
): Promise<BusinessCategoryOption[]> {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("business_category")
      .select("id,category")
      .in("category", ["purchase", "service", "vip_recharge"])
      .order("category", { ascending: true })
      .returns<BusinessCategoryOption[]>(),
  );

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getPurchaseOrderTypeOptions(
  supabase: SupabaseClient,
): Promise<PurchaseOrderTypeOption[]> {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("purchase_order_type")
      .select("id,business_subcategory")
      .order("business_subcategory", { ascending: true })
      .returns<PurchaseOrderTypeOption[]>(),
  );

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getServiceOrderTypeOptions(
  supabase: SupabaseClient,
): Promise<ServiceOrderTypeOption[]> {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("service_order_type")
      .select("id,business_subcategory")
      .order("business_subcategory", { ascending: true })
      .returns<ServiceOrderTypeOption[]>(),
  );

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getServiceOrderPriceOptions(
  supabase: SupabaseClient,
): Promise<ServiceOrderPriceOption[]> {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("service_order_price_option")
      .select("id,service_order_type_id,price_code,display_name,amount_usd,cost_amount_rmb,sort_order,is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .returns<ServiceOrderPriceOption[]>(),
  );

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getOrderDiscountTypeOptions(
  supabase: SupabaseClient,
): Promise<OrderDiscountTypeOption[]> {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("order_discount_type")
      .select("id,discount_ratio")
      .order("discount_ratio", { ascending: false })
      .returns<OrderDiscountTypeOption[]>(),
  );

  if (error) {
    throw error;
  }

  return data ?? [];
}

export const getServiceFeeTypeOptions = getServiceFeeTypes;

// 表单字典和当天汇率互不依赖，沿用并行读取；这些读取沿当前会话和数据库策略执行。
export async function getAdminOrderFormOptions(supabase: SupabaseClient) {
  const [
    userOptions,
    orderTypeOptions,
    purchaseOrderTypeOptions,
    serviceOrderTypeOptions,
    orderDiscountOptions,
    serviceFeeTypeOptions,
    serviceOrderPriceOptions,
    orderCurrencyRates,
  ] = await Promise.all([
    getOrderUserOptions(supabase),
    getOrderTypeOptions(supabase),
    getPurchaseOrderTypeOptions(supabase),
    getServiceOrderTypeOptions(supabase),
    getOrderDiscountTypeOptions(supabase),
    getServiceFeeTypeOptions(supabase),
    getServiceOrderPriceOptions(supabase),
    getLatestCnyExchangeRates(supabase),
  ]);
  return {
    userOptions,
    orderTypeOptions,
    purchaseOrderTypeOptions,
    serviceOrderTypeOptions,
    orderDiscountOptions,
    serviceFeeTypeOptions,
    serviceOrderPriceOptions,
    orderCurrencyRates,
  };
}
