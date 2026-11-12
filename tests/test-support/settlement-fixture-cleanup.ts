import { execFileSync } from "node:child_process";
import { readDisposablePostgresTarget } from "./disposable-fixture";
import { buildSettlementFixtureCleanupSql, buildSettlementFixtureReadbackSql, settlementFixtureNotes, validateSettlementCleanupReceipt } from "./settlement-fixture-cleanup-sql";

type CommandRunner = (args: string[], input?: string) => string;
const defaultRun: CommandRunner = (args, input) => execFileSync("docker", args,
  { input, encoding: "utf8", timeout: 15_000, maxBuffer: 16 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] }).trim();

/** 原客户端不参与清理授权；实际API/DB项目映射、暂停调度和专属归属必须先通过只读核验。 */
export function cleanupLocalSettlementFixtures(values: string[], run: CommandRunner = defaultRun) {
  const notes = settlementFixtureNotes(values);
  if (!notes.length) return;
  const boundary = {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    mode: process.env.PT5_E2E_FIXTURE_MODE,
    project: process.env.PT5_E2E_DATABASE_PROJECT,
    container: process.env.PT5_E2E_DATABASE_CONTAINER,
  };
  const container = readDisposablePostgresTarget(boundary, args => run(args));
  const execute = (input: string) => run(["exec", "-i", "-e", "PGOPTIONS=-c statement_timeout=12000 -c lock_timeout=10000",
    container, "psql", "-U", "postgres", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], input);
  const receipt = validateSettlementCleanupReceipt(JSON.parse(execute(buildSettlementFixtureCleanupSql(notes))));
  // 再次检查同一项目，再开独立连接核对；清理回执不包含任何连接配置或凭据。
  if (readDisposablePostgresTarget(boundary, args => run(args)) !== container) throw new Error("settlement_fixture_target_changed");
  const remaining = JSON.parse(execute(buildSettlementFixtureReadbackSql(notes, receipt)));
  if (!remaining || remaining.releases !== 0 || remaining.allocations !== 0 || remaining.settlements !== 0) {
    throw new Error("settlement_fixture_readback_failed");
  }
  return receipt;
}
