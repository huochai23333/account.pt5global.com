import { execFileSync } from "node:child_process";
import { requireDisposableFixture } from "../../test-support/disposable-fixture";

export type GovernanceTodoRecord = { id: string; user_id: string; title: string };

/** 每次独立读写都先检查显式专属环境；声明本身仍不证明实例实际可重建。 */
function query(sql: string): GovernanceTodoRecord[] {
  requireDisposableFixture({
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    mode: process.env.PT5_E2E_FIXTURE_MODE,
  });
  if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).port !== "54321") {
    throw new Error("独立核对只支持本项目声明的本地数据库端口。");
  }
  const output = execFileSync("docker", [
    "exec", "-i", "-e", "PGOPTIONS=-c statement_timeout=12000 -c lock_timeout=10000",
    "supabase_db_pt5-dropshipping", "psql", "-U", "postgres", "-d", "postgres",
    "-qAt", "-v", "ON_ERROR_STOP=1",
  ], { input: sql, encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] });
  return JSON.parse(output.trim()) as GovernanceTodoRecord[];
}

function quoted(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function readGovernanceTodo(title: string) {
  return query(`select coalesce(json_agg(t),'[]') from (
    select id,user_id,title from public.user_todo_items where title=${quoted(title)}
  ) t;`);
}

/** 三个条件与返回编号一起核对，失败清理不依赖页面是否仍可交互。 */
export function removeGovernanceTodo(row: GovernanceTodoRecord) {
  return query(`with removed as (
    delete from public.user_todo_items where id=${quoted(row.id)}::uuid
      and user_id=${quoted(row.user_id)}::uuid and title=${quoted(row.title)}
    returning id,user_id,title
  ) select coalesce(json_agg(removed),'[]') from removed;`);
}
