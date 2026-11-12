import { getLocalSupabaseAdminClient } from "./local-supabase-admin";
import { cleanupLocalSettlementFixtures } from "../../test-support/settlement-fixture-cleanup";

export async function cleanupSettlementReleaseFixtures(notes: string[]) {
  // 三类记录同事务清理并独立读回；调用签名保持，原认证套件的执行准入另外管理。
  cleanupLocalSettlementFixtures(notes);
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
      bank_quote: Number((rate * 100).toFixed(6)),
      source: "manual",
      provider_updated_at: `${rateDate}T00:01:00+08:00`,
      provider_rate_date: rateDate,
      is_day_final: rateDate < new Date(Date.now() + 28_800_000).toISOString().slice(0, 10),
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
  // 空数组才表示没有有效分配；未知正文不能当作清空成功，金额也必须满足数据库的正数合同。
  if (!Array.isArray(allocations)) throw new Error("本次分配核对缺少记录正文。");
  return allocations.reduce((sum, allocation) => {
    const value = allocation?.allocation_amount;
    if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === ""
      || !Number.isFinite(Number(value)) || Number(value) <= 0) {
      throw new Error("本次分配核对包含无效金额。");
    }
    const total = sum + Number(value);
    if (!Number.isFinite(total)) throw new Error("本次分配合计无法核对。");
    return total;
  }, 0);
}
