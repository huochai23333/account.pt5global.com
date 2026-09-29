import { execFileSync } from "node:child_process";
import { getLocalSupabaseAdminClient } from "./local-supabase-admin";

/** 仅在本地 Docker 的凭据写入处注入失败，测试后立即删除；不改迁移和生产库。 */
export function setOAuthSaveFault(enabled: boolean) {
  if (!getLocalSupabaseAdminClient()) throw new Error("授权故障注入只允许本地数据库。");
  const cleanup = "drop trigger if exists test_mail_oauth_save_fault on public.mail_shared_mailbox_credentials; drop function if exists public.test_mail_oauth_save_fault();";
  const create = "create function public.test_mail_oauth_save_fault() returns trigger language plpgsql as $$ begin raise exception 'local-oauth-save-fault'; end; $$; create trigger test_mail_oauth_save_fault before insert or update on public.mail_shared_mailbox_credentials for each row execute function public.test_mail_oauth_save_fault();";
  execFileSync("docker", ["exec", "-i", "supabase_db_pt5-dropshipping", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
    { input: cleanup + (enabled ? create : ""), stdio: ["pipe", "pipe", "pipe"] });
}
