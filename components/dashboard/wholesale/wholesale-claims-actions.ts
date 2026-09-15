import { getBrowserSupabaseClient } from "@/lib/supabase";

import type { RunWholesaleAction } from "./use-wholesale-action-runner";

type Imported1688Row = {
  external_order_number: string;
  seller_name?: string | null;
  item_summary?: string | null;
  quantity?: number | null;
  purchase_amount?: number | null;
  order_status?: string | null;
  purchased_at?: string | null;
  recipient_name?: string | null;
  raw_payload: Record<string, unknown>;
};

/** 1688 导入、认领和删除属于同一采购归属业务域。 */
export function createWholesaleClaimsActions(runAction: RunWholesaleAction) {
  const import1688Rows = (fileName: string, rows: Imported1688Row[]) =>
    runAction("1688:import", "1688 采购订单已接收。", async () => {
      if (rows.length === 0) throw new Error("empty import");

      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("client unavailable");

      const { data: batch, error: batchError } = await supabase
        .from("wholesale_1688_import_batches")
        .insert({ file_name: fileName, row_count: rows.length, source: "csv" })
        .select("id")
        .single();
      if (batchError || !batch) throw batchError ?? new Error("batch failed");

      // verified-write: 下方会按全部唯一采购单号重新查询，确认每条记录已经存在。
      const { error } = await supabase.from("wholesale_1688_orders").upsert(
        rows.map((row) => ({
          ...row,
          batch_id: batch.id,
        })),
        { ignoreDuplicates: true, onConflict: "external_order_number" },
      );
      if (error) throw error;

      const expectedOrderNumbers = [
        ...new Set(rows.map((row) => row.external_order_number)),
      ];
      const { data: verifiedRows, error: verificationError } = await supabase
        .from("wholesale_1688_orders")
        .select("external_order_number")
        .in("external_order_number", expectedOrderNumbers);
      if (verificationError) throw verificationError;
      if (verifiedRows?.length !== expectedOrderNumbers.length) {
        throw new Error("部分 1688 采购订单没有确认保存。");
      }
    });

  const create1688ClaimGroup = (
    purchaseOrderIds: string[],
    customerId: string,
    wholesaleOrderIds: string[],
  ) =>
    runAction(
      "1688:create-claim-group",
      `已认领 ${purchaseOrderIds.length} 条采购订单。`,
      async () => {
        if (purchaseOrderIds.length === 0 || wholesaleOrderIds.length === 0) {
          throw new Error("empty bulk claim");
        }

        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        // 两侧编号一次性交给数据库，数据库会在同一事务中校验并建立认领组。
        const { data, error } = await supabase.rpc(
          "create_wholesale_1688_claim_group",
          {
          p_purchase_order_ids: purchaseOrderIds,
          p_customer_id: customerId,
          p_wholesale_order_ids: wholesaleOrderIds,
          },
        );
        if (error) throw error;
        if (typeof data !== "string" || !data.trim()) {
          throw new Error("认领没有返回可核对的结果。");
        }

        await verifyClaimGroup(
          supabase,
          data,
          customerId,
          purchaseOrderIds,
          wholesaleOrderIds,
        );
      },
    );

  const update1688ClaimGroup = (
    claimGroupId: string,
    purchaseOrderIds: string[],
    customerId: string,
    wholesaleOrderIds: string[],
  ) =>
    runAction("1688:update-claim-group", "认领关系已更新。", async () => {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("client unavailable");

      // verified-rpc: 旧 RPC 返回 void；下方会重新读取组和两侧全部成员核对。
      const { error } = await supabase.rpc(
        "update_wholesale_1688_claim_group",
        {
          p_claim_group_id: claimGroupId,
          p_customer_id: customerId,
          p_purchase_order_ids: purchaseOrderIds,
          p_wholesale_order_ids: wholesaleOrderIds,
        },
      );
      if (error) throw error;
      await verifyClaimGroup(
        supabase,
        claimGroupId,
        customerId,
        purchaseOrderIds,
        wholesaleOrderIds,
      );
    });

  const cancel1688ClaimGroup = (claimGroupId: string) =>
    runAction("1688:cancel-claim-group", "认领已撤销。", async () => {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("client unavailable");

      // verified-rpc: 取消后按组编号确认记录已经不存在。
      const { error } = await supabase.rpc(
        "cancel_wholesale_1688_claim_group",
        { p_claim_group_id: claimGroupId },
      );
      if (error) throw error;
      const { data: remaining, error: verificationError } = await supabase
        .from("wholesale_1688_claim_groups")
        .select("id")
        .eq("id", claimGroupId)
        .maybeSingle<{ id: string }>();
      if (verificationError) throw verificationError;
      if (remaining) throw new Error("认领关系没有撤销成功。");
    });

  const delete1688Order = (purchaseOrderId: string) =>
    runAction("1688:delete", "采购订单已移出当前认领列表。", async () => {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("client unavailable");

      // verified-rpc: 移出后读取采购订单的删除时间，不能只依赖 RPC 无报错。
      const { error } = await supabase.rpc("delete_wholesale_1688_order", {
        p_1688_order_id: purchaseOrderId,
      });
      if (error) throw error;
      const { data: deletedOrder, error: verificationError } = await supabase
        .from("wholesale_1688_orders")
        .select("id, deleted_at")
        .eq("id", purchaseOrderId)
        .maybeSingle<{ id: string; deleted_at: string | null }>();
      if (verificationError) throw verificationError;
      // 已删除记录可能被 RLS 直接隐藏；查不到记录或能看到明确删除时间都属于完成凭证。
      if (deletedOrder && !deletedOrder.deleted_at) {
        throw new Error("采购订单没有移出成功。");
      }
    });

  return {
    cancel1688ClaimGroup,
    create1688ClaimGroup,
    delete1688Order,
    import1688Rows,
    update1688ClaimGroup,
  };
}

/**
 * 认领组由一条主记录和两张关系表组成，三处都与请求完全一致才算完成。
 * 这样可拦住“主表更新成功、部分关系没有保存”一类虚假成功。
 */
async function verifyClaimGroup(
  supabase: NonNullable<ReturnType<typeof getBrowserSupabaseClient>>,
  claimGroupId: string,
  customerId: string,
  purchaseOrderIds: string[],
  wholesaleOrderIds: string[],
) {
  const [groupResult, purchaseResult, orderResult] = await Promise.all([
    supabase
      .from("wholesale_1688_claim_groups")
      .select("id, customer_id")
      .eq("id", claimGroupId)
      .maybeSingle<{ id: string; customer_id: string }>(),
    supabase
      .from("wholesale_1688_claim_group_purchases")
      .select("purchase_order_id")
      .eq("claim_group_id", claimGroupId),
    supabase
      .from("wholesale_1688_claim_group_orders")
      .select("wholesale_order_id")
      .eq("claim_group_id", claimGroupId),
  ]);

  const verificationError = groupResult.error ?? purchaseResult.error ?? orderResult.error;
  if (verificationError) throw verificationError;

  const actualPurchaseIds = (purchaseResult.data ?? [])
    .map((row) => row.purchase_order_id)
    .sort();
  const actualOrderIds = (orderResult.data ?? [])
    .map((row) => row.wholesale_order_id)
    .sort();
  const expectedPurchaseIds = [...new Set(purchaseOrderIds)].sort();
  const expectedOrderIds = [...new Set(wholesaleOrderIds)].sort();

  if (
    groupResult.data?.customer_id !== customerId
    || JSON.stringify(actualPurchaseIds) !== JSON.stringify(expectedPurchaseIds)
    || JSON.stringify(actualOrderIds) !== JSON.stringify(expectedOrderIds)
  ) {
    throw new Error("认领关系没有完整保存，请刷新后重试。");
  }
}
