import { randomUUID } from "node:crypto";
import { getLocalSupabaseAdminClient } from "./local-supabase-admin";
import { readLocalPostgresRows } from "./local-postgres-query";
import { getRegressionAccount } from "./accounts";

/** 本地跨日后种子汇率可能过期；只补测试所需的当天夹具，不覆盖已有报价。 */
export async function prepareCurrentExchangeRateFixture() {
  const admin = getLocalSupabaseAdminClient();
  if (!admin) throw new Error("分页回归需要本地数据库。");
  const [{ rate_date, exists }] = readLocalPostgresRows<{ rate_date: string; exists: boolean }>(
    "select public.current_exchange_rate_date()::text as rate_date, exists(select 1 from public.exchange_rate where original_currency = 'USD' and rate_date = public.current_exchange_rate_date())",
  );
  if (exists) return async () => {};
  const id = randomUUID();
  const result = await admin.from("exchange_rate").insert({
    id, original_currency: "USD", target_currency: "CNY", rate_date,
    // 固定测试值只验证页面和分页，不作为真实银行报价或财务验收凭证。
    daily_exchange_rate: 7, bank_quote: 700, bank_code: "BOC", quote_type: "spot_buy",
    source: "manual", provider_updated_at: new Date().toISOString(),
  });
  if (result.error) throw result.error;
  return async () => {
    // 本表只允许有效管理员删除；测试使用管理员会话，不扩大服务端密钥的底表权限。
    const account = getRegressionAccount("administrator");
    const login = await admin.auth.signInWithPassword({ email: account.email, password: account.password });
    if (login.error) throw login.error;
    const cleanup = await admin.from("exchange_rate").delete().eq("id", id).select("id");
    if (cleanup.error || cleanup.data?.length !== 1) throw new Error("本次分页回归的汇率夹具未清理完整。");
  };
}
