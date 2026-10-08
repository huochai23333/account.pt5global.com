import { execFileSync } from "node:child_process";
import { readLocalEnvValue } from "./local-supabase-admin";

/** 使用独立 PostgreSQL 查询作最终凭证；只允许本地 Docker，不授予应用额外管理权限。 */
export function runWholesaleFeeSql(sql: string) {
  const url = new URL(readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL") ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "54321") {
    throw new Error("批发费用夹具只能使用本地Docker数据库。");
  }
  return execFileSync("docker", ["exec", "-i", "supabase_db_pt5-dropshipping", "psql",
    "-U", "postgres", "-d", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1"], {
    input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

/** 引号仅用于本文件生成的夹具编号和备注，绝不把页面输入拼成未经转义的SQL。 */
export function feeSqlValue(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function readWholesaleFeeOrder(id: string) {
  return JSON.parse(runWholesaleFeeSql(`select to_jsonb(o) from public.wholesale_orders o where id=${feeSqlValue(id)};`));
}
export function readWholesaleFeeCommission(id: string) {
  return JSON.parse(runWholesaleFeeSql(`select to_jsonb(c) from public.wholesale_commissions c where order_id=${feeSqlValue(id)};`));
}
