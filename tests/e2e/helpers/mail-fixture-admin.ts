import { requireDisposableFixture } from "../../test-support/disposable-fixture";
import { getLocalSupabaseAdminClient } from "./local-supabase-admin";

/**
 * 所有固定邮件数据和整表故障都从此进入：直接调用也必须先声明专用本地环境。
 * 声明不能证明实际隔离；原管理员入口限制与可重建完整实例前提仍须同时满足。
 */
export function getMailAdmin() {
  requireDisposableFixture({
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    mode: process.env.PT5_E2E_FIXTURE_MODE,
  });
  const client = getLocalSupabaseAdminClient();
  if (!client) throw new Error("邮件回归只能连接专用本地 Supabase。");
  return client;
}
