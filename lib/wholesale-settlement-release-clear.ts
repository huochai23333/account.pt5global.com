import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "./request-timeout";

export type SettlementReleaseClearSubmission = {
  releaseId: string;
  expectedRevision: number;
  activeAllocationIds: string[];
};

const unconfirmed = "wholesale_settlement_release_clear_unconfirmed";

export async function clearSettlementReleaseAllocations(
  supabase: SupabaseClient,
  submission: SettlementReleaseClearSubmission,
  actorId: string,
) {
  const { releaseId, expectedRevision, activeAllocationIds } = submission;
  if (activeAllocationIds.length === 0) throw new Error(unconfirmed);

  // 超时、连接断开或网关失败时，事务可能已提交。只独立读取原收款，不重送写入。
  const { data, error, status } = await withRequestTimeout(
    supabase.rpc("clear_wholesale_settlement_release_allocations", {
      p_expected_revision: expectedRevision,
      p_release_id: releaseId,
    }),
  ).catch((cause: unknown) => ({ data: null, error: cause, status: 0 }));
  if (error && status >= 400 && status < 500) throw error;
  if (data && (data.release_id !== releaseId || data.status !== "pending" ||
    data.allocation_revision !== expectedRevision + 1 || data.allocated_amount !== 0)) {
    // 数据库允许对空区间返回原记录。版本未推进时，不能把零影响显示为完成。
    throw new Error(unconfirmed);
  }

  await confirmClear(supabase, submission, actorId);
}

async function confirmClear(
  supabase: SupabaseClient,
  { releaseId, expectedRevision, activeAllocationIds }: SettlementReleaseClearSubmission,
  actorId: string,
) {
  try {
    // 长清单按已选编号分组查询，避免超过 REST 请求长度或每页返回行数上限。
    const allocationReads = [];
    for (let offset = 0; offset < activeAllocationIds.length; offset += 100) {
      allocationReads.push(supabase.from("wholesale_settlement_release_allocations")
        .select("id,status,settlement_id,reversed_at,reversed_by_user_id").eq("release_id", releaseId)
        .in("id", activeAllocationIds.slice(offset, offset + 100)));
    }
    const [release, previous, active, settlements] = await withRequestTimeout(Promise.all([
      supabase.from("wholesale_settlement_releases")
        .select("allocation_revision,allocation_customer_id,status").eq("id", releaseId).maybeSingle(),
      Promise.all(allocationReads),
      supabase.from("wholesale_settlement_release_allocations").select("id")
        .eq("release_id", releaseId).eq("status", "active").limit(1),
      supabase.from("wholesale_order_settlements").select("id")
        .eq("source_settlement_release_id", releaseId).limit(1),
    ]));
    const reversals = previous.flatMap((page) => page.data ?? []);
    if (release.error || previous.some((page) => page.error) || active.error || settlements.error ||
      release.data?.status !== "pending" ||
      release.data.allocation_revision !== expectedRevision + 1 ||
      release.data.allocation_customer_id !== null ||
      active.data?.length !== 0 || settlements.data?.length !== 0 ||
      reversals.length !== activeAllocationIds.length ||
      !reversals.every((row) =>
        row.status === "reversed" && row.settlement_id === null &&
        row.reversed_by_user_id === actorId && Boolean(row.reversed_at))) {
      throw new Error(unconfirmed);
    }
  } catch (cause) {
    throw new Error(unconfirmed, { cause });
  }
}
