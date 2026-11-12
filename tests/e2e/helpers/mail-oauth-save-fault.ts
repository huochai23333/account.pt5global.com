import { execFileSync } from "node:child_process";
import { readDisposablePostgresTarget } from "../../test-support/disposable-fixture";

/**
 * 整表触发器会影响其他会话，必须使用可重建的独立实例，并由 afterEach 回收。
 * 本地连接检查不能代替隔离证明；这里保留原故障语义，不在共享库运行。
 */
export function setOAuthSaveFault(enabled: boolean) {
  // 纯SQL故障不需要创建Auth管理员客户端；先核验实际专属项目/API映射和off/0/0。
  const container = readDisposablePostgresTarget({
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    mode: process.env.PT5_E2E_FIXTURE_MODE,
    project: process.env.PT5_E2E_DATABASE_PROJECT,
    container: process.env.PT5_E2E_DATABASE_CONTAINER,
  }, (args) => execFileSync("docker", args, {
    encoding: "utf8", timeout: 12_000, windowsHide: true,
  }).trim());
  const cleanup =
    "drop trigger if exists test_mail_oauth_save_fault on public.mail_shared_mailbox_credentials; drop function if exists public.test_mail_oauth_save_fault();";
  const create =
    "create function public.test_mail_oauth_save_fault() returns trigger language plpgsql as $$ begin raise exception 'local-oauth-save-fault'; end; $$; create trigger test_mail_oauth_save_fault before insert or update on public.mail_shared_mailbox_credentials for each row execute function public.test_mail_oauth_save_fault();";
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "-e",
      "PGOPTIONS=-c statement_timeout=10000 -c lock_timeout=5000",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    {
      // 安装/移除是同一事务；末尾校验失败也不能留下半套触发器。
      input: `begin; ${cleanup}${enabled ? create : ""}
        do $proof$ begin
          if (select count(*) from pg_trigger where tgname='test_mail_oauth_save_fault'
              and tgrelid='public.mail_shared_mailbox_credentials'::regclass and not tgisinternal and tgenabled='O') <> ${enabled ? 1 : 0}
            or (select count(*) from pg_proc where pronamespace='public'::regnamespace
              and proname='test_mail_oauth_save_fault' and pronargs=0) <> ${enabled ? 1 : 0}
          then raise exception 'mail_oauth_fault_receipt_invalid'; end if;
        end $proof$; commit;`,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15_000,
      windowsHide: true,
    },
  );
}
