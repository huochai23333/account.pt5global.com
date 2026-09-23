import { getWholesalePageData } from "@/lib/wholesale";

/** 订单评估接口只接受这些已经清洗过的筛选条件。 */
export type WholesaleOrderAssessmentFilters = {
  customerId: string;
  orderMonth: string;
  orderedFromDate: string;
  orderedToDate: string;
  salesUserId: string;
  searchText: string;
  status: string;
};

export type WholesaleOrderAssessmentData = Awaited<
  ReturnType<typeof getWholesalePageData>
>;
