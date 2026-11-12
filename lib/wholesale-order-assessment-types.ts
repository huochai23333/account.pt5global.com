import type { getWholesalePageData } from "./wholesale";
import type { WholesaleOrderFilters } from "./wholesale-order-page";

/** 订单列表和评估的筛选字段共用同一类型，包括按单号跨日期精确查找。 */
export type WholesaleOrderAssessmentFilters = WholesaleOrderFilters;

export type WholesaleOrderAssessmentData = Awaited<ReturnType<typeof getWholesalePageData>>;
