import { execFileSync, spawn } from "node:child_process";

import { holdPostgresDocumentLock } from "../../test-support/postgres-document-lock";
import { readDisposablePostgresTarget } from "../../test-support/disposable-fixture";

/** 锁会阻塞整组文档操作，仅允许同一专属项目；本模块不加载认证入口，也不回退到共享数据库。 */
export function requireDocumentFixtureDatabase() {
  return readDisposablePostgresTarget({
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    mode: process.env.PT5_E2E_FIXTURE_MODE,
    project: process.env.PT5_E2E_DATABASE_PROJECT,
    container: process.env.PT5_E2E_DATABASE_CONTAINER,
  }, args => execFileSync("docker", args, { encoding: "utf8", timeout: 8000, windowsHide: true }));
}

/** 只接收测试构造的SQL；全局触发器/岗位夹具必须在专属库，禁止传入页面输入。 */
export function runDocumentFixtureSql(statement: string) {
  const container = requireDocumentFixtureDatabase();
  return execFileSync("docker", ["exec", "-i", "-e", "PGOPTIONS=-c statement_timeout=12000 -c lock_timeout=10000",
    container, "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1",
  ], { input: statement, encoding: "utf8", timeout: 15000, windowsHide: true });
}

export async function holdDocumentWrites(draftId?: string) {
  const container = requireDocumentFixtureDatabase();
  return holdPostgresDocumentLock({
    draftId,
    startProcess: () => spawn("docker", [
      "exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres",
      "-qAt", "-v", "ON_ERROR_STOP=1",
    ], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true }),
  });
}
