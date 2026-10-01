import { queryCompleteDashboardRows, type DashboardCollectionQuery } from "./dashboard-complete-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentSessionContext } from "./current-session-context";
import { normalizeCurrencyCode } from "./exchange-rate-display";
import { getLatestCnyExchangeRates } from "./exchange-rate-queries";
import type {
  CustomerInventoryAttachment,
  CustomerInventoryAuditLog,
  CustomerInventoryCreditApplication,
  CustomerInventoryExtensionRequest,
  CustomerInventoryOrder,
  CustomerInventoryOrderItem,
  CustomerInventoryPageData,
  CustomerInventoryRepayment,
} from "./customer-inventory-types";
import { getWholesaleProfiles } from "./wholesale-profiles";
import type { WholesaleCustomer } from "./wholesale-types";

export * from "./customer-inventory-types";

/**
 * 库存订单拥有独立的数据装载入口。
 * 页面只负责组装展示，不把订单、信贷、延期和还款查询继续塞进原批发聚合文件。
 */
export async function getCustomerInventoryPageData(
  supabase: SupabaseClient,
): Promise<CustomerInventoryPageData> {
  const session = await getCurrentSessionContext(supabase);
  const [
    orders,
    items,
    credits,
    extensions,
    repayments,
    attachments,
    auditLogs,
    customers,
    profiles,
    exchangeRates,
  ] = await Promise.all([
    queryRows<CustomerInventoryOrder>(
      supabase
        .from("customer_inventory_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
      "库存订单",
    ),
    queryRows<CustomerInventoryOrderItem>(
      supabase
        .from("customer_inventory_order_items")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
      "库存订单商品",
    ),
    queryRows<CustomerInventoryCreditApplication>(
      supabase
        .from("customer_inventory_credit_applications")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false }),
      "库存信贷",
    ),
    queryRows<CustomerInventoryExtensionRequest>(
      supabase
        .from("customer_inventory_credit_extension_requests")
        .select("*")
        .order("created_at", { ascending: false }).order("id", { ascending: false }),
      "信贷延期",
    ),
    queryRows<CustomerInventoryRepayment>(
      supabase
        .from("customer_inventory_credit_repayments")
        .select("*")
        .order("created_at", { ascending: false }).order("id", { ascending: false }),
      "信贷还款",
    ),
    queryRows<CustomerInventoryAttachment>(
      supabase
        .from("customer_inventory_order_list_attachments")
        .select("*")
        .order("created_at", { ascending: true }).order("id", { ascending: true }),
      "库存订单附件",
    ),
    queryRows<CustomerInventoryAuditLog>(
      supabase
        .from("customer_inventory_order_audit_logs")
        .select("*")
        .order("created_at", { ascending: false }).order("id", { ascending: false }),
      "库存订单操作记录",
    ),
    queryRows<WholesaleCustomer>(
      supabase
        .from("wholesale_customers")
        .select("*")
        .not("registered_user_id", "is", null)
        .order("created_at", { ascending: false }).order("id", { ascending: false }),
      "已注册批发客户",
    ),
    getWholesaleProfiles(supabase, false),
    getLatestCnyExchangeRates(supabase, 500),
  ]);
  const usdToCurrencyRates = await loadUsdToCurrencyRates(supabase, orders);
  const currencyOptions = Array.from(
    new Set(
      [
        "USD",
        "CNY",
        ...exchangeRates.map((row) =>
          normalizeCurrencyCode(row.original_currency),
        ),
        ...orders.map((order) => order.currency),
      ].filter(Boolean),
    ),
  ).sort((left, right) => {
    // 常用币种固定在前，其他币种按代码排序，减少每次打开表单时的查找成本。
    const priority = ["USD", "CNY"];
    const leftPriority = priority.indexOf(left);
    const rightPriority = priority.indexOf(right);
    if (leftPriority >= 0 || rightPriority >= 0) {
      return (leftPriority < 0 ? priority.length : leftPriority) -
        (rightPriority < 0 ? priority.length : rightPriority);
    }
    return left.localeCompare(right);
  });

  return {
    attachments,
    auditLogs,
    credits,
    currencyOptions,
    currentBusinessDate: getShanghaiDateValue(new Date()),
    currentRole: session.role,
    currentUserId: session.user?.id ?? null,
    customers,
    extensions,
    items,
    orders,
    profiles,
    repayments,
    usdToCurrencyRates,
  };
}

async function loadUsdToCurrencyRates(
  supabase: SupabaseClient,
  orders: CustomerInventoryOrder[],
) {
  const currencies = Array.from(
    new Set(
      orders
        .filter((order) => order.payment_status === "awaiting_payment")
        .map((order) => order.currency),
    ),
  );
  const entries = await Promise.all(
    currencies.map(async (currency) => {
      const { data, error } = await supabase.rpc(
        "get_customer_inventory_usd_to_currency_rate",
        { p_currency: currency },
      );

      // 缺少汇率时页面仍可查看申请；审核弹窗会明确显示尚不能批准，而不是让整页加载失败。
      return [currency, error ? null : Number(data)] as const;
    }),
  );

  return Object.fromEntries(entries);
}

async function queryRows<T>(
  query: DashboardCollectionQuery<T>,
  label: string,
): Promise<T[]> {
  const result = await queryCompleteDashboardRows(query);

  if (result.error) {
    throw new Error(`${label}暂时没有加载成功，请稍后重试。`, {
      cause: result.error,
    });
  }

  return result.data ?? [];
}

function getShanghaiDateValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}
