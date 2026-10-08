import type { UserStatus } from "./auth-metadata";
import type { AppRole } from "./auth-routing";
import type { CommissionRuleSetting } from "./commission-settings";
import type { ExchangeRateRow } from "./exchange-rates";
import type {
  WholesaleLogisticsFilters,
  WholesaleLogisticsPage,
  WholesaleLogisticsStoreAssignment,
  WholesaleLogisticsStoreOption,
  WholesaleReferralWaybillCount,
} from "./wholesale-logistics-page";
import type { WholesaleOrderPage } from "./wholesale-order-page";
import type { WholesaleReferralCommissionRow } from "./wholesale-referral-commissions";
import type { WorkspaceWholesaleSectionKey } from "./workspace-config";

export type WholesaleCustomer = {
  id: string;
  registered_user_id: string | null;
  assigned_sales_user_id: string | null;
  created_by_user_id: string | null;
  customer_kind: "registered_account" | "sales_created";
  unique_name: string;
  other_names: string[];
  contact_details: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  salesman_commission_cohort: "existing" | "new";
  /** 当前账号可见的来源线索编号，用于提示关联客户需要保留档案。 */
  source_sales_lead_id?: string | null;
};

export type WholesaleOrder = {
  id: string;
  order_number: string;
  customer_id: string;
  sales_user_id: string | null;
  small_order_count: number;
  product_purchase_amount: number;
  packing_fee: number;
  commission_calculation_snapshot: Record<string, unknown>;
  service_fee: number;
  cn_tax_fee: number;
  payment_processing_fee: number;
  international_shipping_fee: number;
  other_fee: number;
  referral_commission_fee: number;
  courier_company: string | null;
  settlement_exchange_rate: number | null;
  customer_payment_currency: string;
  customer_payment_amount: number;
  customer_payment_rmb_amount: number | null;
  payment_platform: string | null;
  gross_profit: number | null;
  gross_margin: number | null;
  commission_basis: "gross_profit" | "service_fee";
  commission_basis_amount_rmb: number;
  commission_rate: number;
  salesman_commission_parameter_version_id: string;
  referral_amount_parameter_version_id: string;
  notes: string | null;
  order_month: string;
  status: "unsettled" | "partial_settled" | "settled";
  ordered_at: string;
  settled_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * 关联弹窗只需要辨认订单，不应该顺带获取成本、利润等内部字段。
 * 使用独立类型可以让 TypeScript 在有人误用未查询字段时立即报错。
 */
export type WholesaleOrderLinkOption = Pick<
  WholesaleOrder,
  | "customer_id"
  | "customer_payment_amount"
  | "customer_payment_currency"
  | "id"
  | "order_number"
  | "ordered_at"
>;

export type WholesaleOrderInternalFieldKey =
  | "commission_calculation_snapshot"
  | "service_fee"
  | "cn_tax_fee"
  | "payment_processing_fee"
  | "commission_basis"
  | "commission_basis_amount_rmb"
  | "international_shipping_fee"
  | "order_month"
  | "other_fee"
  | "payment_platform"
  | "product_purchase_amount"
  | "referral_commission_fee";

/**
 * 客户订单列表不会收到内部成本字段，因此列表类型把这些内部字段声明为可选。
 * 内部编辑表单仍继续使用字段完整的 WholesaleOrder，避免把缺失数据误写回数据库。
 */
export type WholesaleOrderListItem = Omit<
  WholesaleOrder,
  WholesaleOrderInternalFieldKey
> &
  Partial<Pick<WholesaleOrder, WholesaleOrderInternalFieldKey>>;

export function hasWholesaleOrderInternalFields(
  order: WholesaleOrderListItem,
): order is WholesaleOrder {
  return (
    order.commission_calculation_snapshot !== undefined &&
    order.service_fee !== undefined &&
    order.cn_tax_fee !== undefined &&
    order.payment_processing_fee !== undefined &&
    order.commission_basis !== undefined &&
    order.commission_basis_amount_rmb !== undefined &&
    order.product_purchase_amount !== undefined &&
    order.international_shipping_fee !== undefined &&
    order.other_fee !== undefined &&
    order.referral_commission_fee !== undefined &&
    order.payment_platform !== undefined &&
    order.order_month !== undefined
  );
}

export type WholesaleOrderSettlement = {
  id: string;
  order_id: string;
  settlement_amount: number;
  settlement_exchange_rate: number;
  settlement_rmb_amount: number;
  source_settlement_release_id: string | null;
  settled_on: string;
  settled_at: string;
  created_by_user_id: string | null;
  created_at: string;
};

export type WholesaleOrderChangeLog = {
  id: string;
  order_id: string;
  actor_user_id: string | null;
  action:
    "direct_update" | "settlement_rate_batch_update" | "settlement_rate_update";
  previous_data: Record<string, unknown>;
  next_data: Record<string, unknown>;
  note: string | null;
  created_at: string;
};


export type WholesaleCommission = {
  id: string;
  order_id: string;
  beneficiary_user_id: string | null;
  customer_id: string | null;
  order_payment_rmb_amount: number;
  gross_profit_rmb: number;
  commission_basis: "gross_profit" | "service_fee";
  commission_basis_amount_rmb: number;
  commission_rate: number;
  commission_amount_rmb: number;
  status: "pending" | "settled" | "cancelled";
  calculated_at: string;
  settled_at: string | null;
  settled_by_user_id: string | null;
  parameter_version_id: string;
  calculation_snapshot: Record<string, unknown>;
};

export type WholesaleReferral = {
  id: string;
  referrer_customer_id: string;
  referred_customer_id: string;
  created_by_user_id: string | null;
  created_at: string;
};

export type WholesaleProfile = {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: UserStatus | null;
  city: string | null;
  role: AppRole | null;
};

export type WholesalePageData = {
  currentUserId: string | null;
  currentRole: AppRole | null;
  commissionRuleSettings: CommissionRuleSetting[];
  customers: WholesaleCustomer[];
  exchangeRates: ExchangeRateRow[];
  orderChangeLogs: WholesaleOrderChangeLog[];
  orderPage: WholesaleOrderPage | null;
  orderPageError: string | null;
  orders: WholesaleOrder[];
  orderSettlements: WholesaleOrderSettlement[];
  logisticsAssignments: WholesaleLogisticsStoreAssignment[];
  logisticsFilters: WholesaleLogisticsFilters | null;
  logisticsPage: WholesaleLogisticsPage | null;
  logisticsStoreOptions: WholesaleLogisticsStoreOption[];
  referralWaybillCounts: WholesaleReferralWaybillCount[];
  referralCommissionRows: WholesaleReferralCommissionRow[];
  commissions: WholesaleCommission[];
  referrals: WholesaleReferral[];
  profiles: WholesaleProfile[];
  registeredCandidates: WholesaleProfile[];
  section: WorkspaceWholesaleSectionKey;
};
