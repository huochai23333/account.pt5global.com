import { getLocalSupabaseAdminClient } from "./local-supabase-admin";

export async function cleanupSettlementReleaseFixtures(notes: string[]) {
  if (notes.length === 0) return;
  const admin = getLocalSupabaseAdminClient();
  if (!admin) throw new Error("结汇回归需要本地 Supabase 管理连接。");

  const { data: releases, error: releaseError } = await admin
    .from("wholesale_settlement_releases")
    .select("id")
    .in("note", notes);
  if (releaseError) throw releaseError;
  const releaseIds = (releases ?? []).map((release) => release.id);
  if (releaseIds.length === 0) return;

  // 先保留订单结汇记录 ID；删除收款会级联删除分配，再删结汇记录让订单重新计算。
  const { data: settlements, error: settlementError } = await admin
    .from("wholesale_order_settlements")
    .select("id")
    .in("source_settlement_release_id", releaseIds);
  if (settlementError) throw settlementError;
  const { data: deleted, error: deleteError } = await admin
    .from("wholesale_settlement_releases")
    .delete()
    .in("id", releaseIds)
    .select("id");
  if (deleteError || deleted?.length !== releaseIds.length) {
    throw deleteError ?? new Error("本次测试收款未全部清理。");
  }

  const settlementIds = (settlements ?? []).map((settlement) => settlement.id);
  if (settlementIds.length > 0) {
    const { data: deletedSettlements, error } = await admin
      .from("wholesale_order_settlements")
      .delete()
      .in("id", settlementIds)
      .select("id");
    if (error || deletedSettlements?.length !== settlementIds.length) {
      throw error ?? new Error("本次测试订单结汇记录未全部清理。");
    }
  }
}

export async function ensureLocalUsdRate(rateDate: string, rate = 7.2) {
  const admin = getLocalSupabaseAdminClient();
  if (!admin) throw new Error("结汇测试需要本地数据库连接。");
  const { data: existing, error: readError } = await admin
    .from("exchange_rate")
    .select("id")
    .eq("original_currency", "USD")
    .eq("target_currency", "CNY")
    .eq("rate_date", rateDate)
    .limit(1);
  if (readError) throw readError;
  if (existing?.length) return null;

  // 实际分配需要当天精确汇率；只清理本次测试插入的报价。
  const { data: inserted, error: insertError } = await admin
    .from("exchange_rate")
    .insert({
      daily_exchange_rate: rate,
      original_currency: "USD",
      rate_date: rateDate,
      target_currency: "CNY",
    })
    .select("id")
    .single();
  if (insertError || !inserted?.id) {
    throw insertError ?? new Error("本地测试汇率没有落库。");
  }
  return inserted.id as string;
}

export async function cleanupRateFixtures(rateIds: string[]) {
  if (rateIds.length === 0) return;
  const admin = getLocalSupabaseAdminClient();
  if (!admin) throw new Error("无法清理本次测试汇率。");
  const { data, error } = await admin
    .from("exchange_rate")
    .delete()
    .in("id", rateIds)
    .select("id");
  if (error || data?.length !== rateIds.length) {
    throw error ?? new Error("本次测试汇率未全部清理。");
  }
}

export async function getActiveAllocationTotal(releaseNote: string) {
  const admin = getLocalSupabaseAdminClient();
  if (!admin) throw new Error("结汇测试需要本地数据库连接。");
  const { data: release, error: releaseError } = await admin
    .from("wholesale_settlement_releases")
    .select("id")
    .eq("note", releaseNote)
    .single();
  if (releaseError || !release?.id) {
    throw releaseError ?? new Error("未查到本次结汇收款记录。");
  }
  const { data: allocations, error: allocationsError } = await admin
    .from("wholesale_settlement_release_allocations")
    .select("allocation_amount")
    .eq("release_id", release.id)
    .eq("status", "active");
  if (allocationsError) throw allocationsError;
  return (allocations ?? []).reduce(
    (sum, allocation) => sum + Number(allocation.allocation_amount),
    0,
  );
}
