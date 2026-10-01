import { execFileSync } from "node:child_process";
import { readLocalEnvValue } from "./local-supabase-admin";

/**
 * 直接读取本地 Docker 的权威记录，与页面请求使用不同的数据读取路径。
 * 批发底表有专门的字段权限，不能为测试给 service_role 放宽生产权限。
 * 此入口只在 Node 测试进程中执行，且明确拒绝非本地环境。
 */
export function readLocalPostgresRows<Row>(query: string): Row[] {
  const url = readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  if (!url || !/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url)) {
    throw new Error("数据库独立核对仅支持本地 PT5 Docker 环境。");
  }
  const output = execFileSync("docker", ["exec", "supabase_db_pt5-dropshipping", "psql",
    "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c",
    `SELECT coalesce(json_agg(records), '[]'::json) FROM (${query}) records`,
  ], { encoding: "utf8", timeout: 15_000 });
  return JSON.parse(output.trim()) as Row[];
}

/** 测试生成的日期也按 SQL 字符串规则转义，不能把页面输入拼成 SQL 代码。 */
export function localSqlValue(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}
