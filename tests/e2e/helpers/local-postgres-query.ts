import { execFileSync } from "node:child_process";
import { readDisposablePostgresTarget } from "../../test-support/disposable-fixture";

/**
 * 直接读取本地 Docker 的权威记录，与页面请求使用不同的数据读取路径。
 * 批发底表有专门的字段权限，不能为测试给 service_role 放宽生产权限。
 * 此入口只接受可信测试构造的SQL；它不是任意用户SQL的安全沙箱。
 * 专属目标从显式环境声明核对，不再依赖原认证助手或固定共享容器/端口。
 */
export function readLocalPostgresRows<Row>(query: string): Row[] {
  const run = (args: string[]) => execFileSync("docker", args, {
    encoding: "utf8", timeout: 15_000, windowsHide: true,
  }).trim();
  const container = readDisposablePostgresTarget({
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    mode: process.env.PT5_E2E_FIXTURE_MODE,
    project: process.env.PT5_E2E_DATABASE_PROJECT,
    container: process.env.PT5_E2E_DATABASE_CONTAINER,
  }, run);
  // 数据库先在 12 秒取消语句，锁等待最多 10 秒；15 秒客户端期限只作最后兜底。
  // 维护角色也使用只读事务；禁用psql启动脚本，避免本地配置改写输出或执行额外指令。
  const output = run(
    [
      "exec",
      "-e",
      "PGOPTIONS=-c statement_timeout=12000 -c lock_timeout=10000 -c default_transaction_read_only=on",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-XqAtw",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `SELECT coalesce(json_agg(records), '[]'::json) FROM (${query}) records`,
    ],
  );
  const records: unknown = JSON.parse(output);
  if (!Array.isArray(records) || records.some((row) =>
    row === null || typeof row !== "object" || Array.isArray(row),
  )) {
    throw new Error("数据库独立核对没有返回记录对象数组。");
  }
  return records as Row[];
}

/** 测试生成的日期也按 SQL 字符串规则转义，不能把页面输入拼成 SQL 代码。 */
export function localSqlValue(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}
