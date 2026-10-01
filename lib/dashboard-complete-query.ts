import { withRequestTimeout } from "./request-timeout";

export type DashboardCollectionQuery<Row> = PromiseLike<{
  data: Row[] | null;
  error: { message: string } | null;
}> & { range: (from: number, to: number) => DashboardCollectionQuery<Row> };

/**
 * 目录、关系图和表单候选需要完整的可见集合，不能把接口默认上限当作总数。
 * 每批最多读取五百条，仍使用调用者的登录身份和原查询的权限、排序及筛选。
 * 传入的查询必须有唯一字段作为最后一个排序条件，否则分批边界可能重复或遗漏。
 */
export async function queryCompleteDashboardRows<Row>(query: DashboardCollectionQuery<Row>) {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await withRequestTimeout(query.range(offset, offset + 499));
    if (result.error) return { data: null, error: result.error };
    const batch = result.data ?? [];
    rows.push(...batch);
    if (batch.length < 500) return { data: rows, error: null };
  }
}
