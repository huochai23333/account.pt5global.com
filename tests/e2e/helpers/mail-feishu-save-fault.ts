import { execFileSync } from "node:child_process";
import { readDisposablePostgresTarget } from "../../test-support/disposable-fixture";

/**
 * 故障作用于整张绑定表，必须在可重建的独立实例执行，并在 afterEach 删除。
 * 专属模式和本地地址检查不能证明数据库没有其他使用者；原套件准入仍须满足。
 */
export function setFeishuSaveFault(enabled: boolean) {
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
    "drop trigger if exists test_feishu_save_fault on public.mail_feishu_bindings; drop function if exists public.test_feishu_save_fault();";
  const create =
    "create function public.test_feishu_save_fault() returns trigger language plpgsql as $$ begin raise exception 'local-feishu-save-fault'; end; $$; create trigger test_feishu_save_fault before insert or update on public.mail_feishu_bindings for each row execute function public.test_feishu_save_fault();";
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
          if (select count(*) from pg_trigger where tgname='test_feishu_save_fault'
              and tgrelid='public.mail_feishu_bindings'::regclass and not tgisinternal and tgenabled='O') <> ${enabled ? 1 : 0}
            or (select count(*) from pg_proc where pronamespace='public'::regnamespace
              and proname='test_feishu_save_fault' and pronargs=0) <> ${enabled ? 1 : 0}
          then raise exception 'feishu_fault_receipt_invalid'; end if;
        end $proof$; commit;`,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15_000,
      windowsHide: true,
    },
  );
}
