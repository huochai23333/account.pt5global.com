import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Wholesale1688ClaimGroup,
  Wholesale1688ClaimGroupOrder,
  Wholesale1688ClaimGroupPurchase,
  Wholesale1688Order,
  WholesaleLinked1688Order,
} from "./wholesale";

export type WholesaleRelatedQueryResult = {
  data: unknown[] | null;
  error: { message?: string } | null;
};

export function emptyWholesaleRelatedQuery(): Promise<WholesaleRelatedQueryResult> {
  return Promise.resolve({ data: [], error: null });
}

/**
 * 批发订单与 1688 订单通过认领组建立多对多关系。
 * 此模块只查询并展平关联数据，页面主查询无需知道三张关联表的连接细节。
 */
export async function getLinkedWholesalePurchaseOrders(
  supabase: SupabaseClient,
  orderIds: string[],
  canViewInternalFields: boolean,
): Promise<WholesaleRelatedQueryResult> {
  if (!canViewInternalFields) {
    // 客户不能直接读含采购成本和原始导入内容的底表，只通过受控接口取得关联单号。
    const result = await supabase.rpc("get_client_linked_wholesale_purchases", {
      p_order_ids: orderIds,
    });
    return { data: Array.isArray(result.data) ? result.data : null, error: result.error };
  }
  const groupOrdersResult = await supabase
    .from("wholesale_1688_claim_group_orders")
    .select("claim_group_id,wholesale_order_id")
    .in("wholesale_order_id", orderIds);
  if (groupOrdersResult.error) return groupOrdersResult;

  const groupOrders = (groupOrdersResult.data ?? []) as Wholesale1688ClaimGroupOrder[];
  const groupIds = [...new Set(groupOrders.map((row) => row.claim_group_id))];
  if (groupIds.length === 0) return { data: [], error: null };

  const [groupsResult, groupPurchasesResult] = await Promise.all([
    supabase.from("wholesale_1688_claim_groups").select("*").in("id", groupIds),
    supabase
      .from("wholesale_1688_claim_group_purchases")
      .select("claim_group_id,purchase_order_id")
      .in("claim_group_id", groupIds),
  ]);
  if (groupsResult.error) return groupsResult;
  if (groupPurchasesResult.error) return groupPurchasesResult;

  const groups = (groupsResult.data ?? []) as Wholesale1688ClaimGroup[];
  const groupPurchases = (groupPurchasesResult.data ??
    []) as Wholesale1688ClaimGroupPurchase[];
  const purchaseOrderIds = [
    ...new Set(groupPurchases.map((row) => row.purchase_order_id)),
  ];
  if (purchaseOrderIds.length === 0) return { data: [], error: null };

  const purchaseOrdersResult = await supabase
    .from("wholesale_1688_orders")
    .select("*")
    .in("id", purchaseOrderIds)
    .order("created_at", { ascending: false });
  if (purchaseOrdersResult.error) return purchaseOrdersResult;

  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const purchaseOrdersById = new Map(
    ((purchaseOrdersResult.data ?? []) as Wholesale1688Order[]).map((order) => [
      order.id,
      order,
    ]),
  );
  const groupOrdersByGroupId = groupByClaimGroup(groupOrders);
  const linkedOrders: WholesaleLinked1688Order[] = [];
  const seenLinks = new Set<string>();

  for (const purchaseLink of groupPurchases) {
    const claimGroup = groupsById.get(purchaseLink.claim_group_id);
    const purchaseOrder = purchaseOrdersById.get(purchaseLink.purchase_order_id);
    if (!claimGroup || !purchaseOrder) continue;

    for (const orderLink of groupOrdersByGroupId.get(claimGroup.id) ?? []) {
      const linkKey = `${orderLink.wholesale_order_id}:${purchaseOrder.id}`;
      if (seenLinks.has(linkKey)) continue;
      seenLinks.add(linkKey);
      linkedOrders.push({
        ...purchaseOrder,
        claim_group_id: claimGroup.id,
        wholesale_order_id: orderLink.wholesale_order_id,
        claimed_by_user_id: claimGroup.claimed_by_user_id,
        claimed_at: claimGroup.claimed_at,
        updated_by_user_id: claimGroup.updated_by_user_id,
        updated_at: claimGroup.updated_at,
      });
    }
  }
  return { data: linkedOrders, error: null };
}

function groupByClaimGroup(rows: Wholesale1688ClaimGroupOrder[]) {
  const grouped = new Map<string, Wholesale1688ClaimGroupOrder[]>();
  for (const row of rows) {
    grouped.set(row.claim_group_id, [
      ...(grouped.get(row.claim_group_id) ?? []),
      row,
    ]);
  }
  return grouped;
}
