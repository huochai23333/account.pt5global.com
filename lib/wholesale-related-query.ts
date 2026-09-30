export type WholesaleRelatedQueryResult = {
  data: unknown[] | null;
  error: { message?: string } | null;
};

/** 关联资料缺席时返回同形状空结果，供批发订单页面并行查询使用。 */
export function emptyWholesaleRelatedQuery(): Promise<WholesaleRelatedQueryResult> {
  return Promise.resolve({ data: [], error: null });
}
