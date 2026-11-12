import { execFileSync } from "node:child_process";
import { readDisposablePostgresTarget } from "../../test-support/disposable-fixture";

function requireLocalFixtureContainer() {
  // 端口不是项目身份；每次SQL都重新核对显式声明、真实DB/Kong标签/端口网络及off/0/0。
  return readDisposablePostgresTarget({
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    mode: process.env.PT5_E2E_FIXTURE_MODE,
    project: process.env.PT5_E2E_DATABASE_PROJECT,
    container: process.env.PT5_E2E_DATABASE_CONTAINER,
  }, args => execFileSync("docker", args, { encoding: "utf8", timeout: 15000, windowsHide: true }).trim());
}

/** 接收可信测试SQL用于准备/清理；这是有写能力的维护入口，不是只读查询或用户SQL沙箱。 */
export function runLocalSupabaseSql(statement: string) {
  const container = requireLocalFixtureContainer();
  try {
    // SQL只经stdin传给刚核验的专属目标，不读取.env.local或按旧端口猜测共享容器。
    return execFileSync(
      "docker",
      [
        "exec", "-i", "-e", "PGOPTIONS=-c statement_timeout=12000 -c lock_timeout=10000",
        container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-XqAtw",
      ],
      {
        input: statement,
        encoding: "utf8",
        // 服务端先取消12秒语句或10秒锁等待，15秒进程期限只作最后兜底。
        timeout: 15_000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
        // SQL错误可能含账号资料或测试密钥；禁止stderr直接回显，失败只返回未确认。
        stdio: ["pipe", "pipe", "pipe"],
      },
    ).trim();
  } catch {
    throw new Error("专属本地SQL未确认完成，请保留本次夹具并独立核对数据库。");
  }
}

export function isLocalSupabaseTestTarget() {
  try {
    requireLocalFixtureContainer();
    return true;
  } catch {
    return false;
  }
}
