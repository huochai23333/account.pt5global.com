import { execFileSync } from "node:child_process";
import { getLocalSupabaseAdminClient } from "./local-supabase-admin";

/** 故障只作用于本地 Docker 的飞书绑定表，每例结束时删除，不能连接云端执行。 */
export function setFeishuSaveFault(enabled: boolean) {
  if (!getLocalSupabaseAdminClient()) throw new Error("飞书故障注入只允许本地数据库。");
  const cleanup = "drop trigger if exists test_feishu_save_fault on public.mail_feishu_bindings; drop function if exists public.test_feishu_save_fault();";
  const create = "create function public.test_feishu_save_fault() returns trigger language plpgsql as $$ begin raise exception 'local-feishu-save-fault'; end; $$; create trigger test_feishu_save_fault before insert or update on public.mail_feishu_bindings for each row execute function public.test_feishu_save_fault();";
  execFileSync("docker", ["exec", "-i", "supabase_db_pt5-dropshipping", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
    { input: cleanup + (enabled ? create : ""), stdio: ["pipe", "pipe", "pipe"] });
}
