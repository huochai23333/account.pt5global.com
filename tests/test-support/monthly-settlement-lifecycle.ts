import { execFileSync } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MonthlySettlementFixture } from "../e2e/helpers/monthly-settlement-fixture";
import { readDisposablePostgresTarget } from "./disposable-fixture";
import { cleanupFixtureResources } from "./fixture-cleanup-sequence";

/** 准备和收尾都先核验实际专属项目，避免账号/角色配置意外写进共享开发库。 */
export function assertMonthlySettlementTarget() {
  return readDisposablePostgresTarget({
    baseURL: process.env.PLAYWRIGHT_BASE_URL, supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    mode: process.env.PT5_E2E_FIXTURE_MODE, project: process.env.PT5_E2E_DATABASE_PROJECT,
    container: process.env.PT5_E2E_DATABASE_CONTAINER,
  }, args => execFileSync("docker", args, { encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 }).trim());
}

/** 删除前读自有编号，删除后另请求核对零残留；缺正文或零影响不能冒充完成。 */
async function removeFixtureRows(admin: SupabaseClient, table: string, column: string, values: string[]) {
  if (!values.length) return;
  const before = await admin.from(table).select("id").in(column, values);
  if (before.error || !Array.isArray(before.data)) throw before.error ?? new Error("本次清理缺少原记录正文。");
  const ids = before.data.map(row => row.id);
  if (new Set(ids).size !== ids.length || ids.some(id => typeof id !== "string" || !id)) throw new Error("本次清理记录编号无效。");
  if (ids.length) {
    const removed = await admin.from(table).delete().in("id", ids).select("id");
    if (removed.error || !Array.isArray(removed.data) || removed.data.length !== ids.length
      || new Set(removed.data.map(row => row.id)).size !== ids.length || removed.data.some(row => !ids.includes(row.id))) {
      throw removed.error ?? new Error("本次清理实际删除记录不一致。");
    }
  }
  const remaining = await admin.from(table).select("id", { count: "exact", head: true }).in(column, values);
  if (remaining.error || remaining.count !== 0) throw remaining.error ?? new Error("本次清理仍有记录或计数未知。");
}

/** 各资源顺序收尾且保留全部失败；Auth必须独立确认不存在，不能只接受删除响应。 */
export async function cleanupMonthlySettlementFixture(
  admin: SupabaseClient, fixture: MonthlySettlementFixture, pages: { close(): Promise<unknown> }[],
  cleanupReleases: () => Promise<unknown>, verifyTarget = assertMonthlySettlementTarget,
) {
  // 目标不明时不执行任何数据库清理，但仍回收已经打开的浏览器页面。
  await cleanupFixtureResources(
    ...pages.map(page => () => page.close()),
    async () => {
      verifyTarget();
      await cleanupFixtureResources(
        cleanupReleases,
        () => removeFixtureRows(admin, "wholesale_orders", "id", [fixture.orderId]),
        () => removeFixtureRows(admin, "wholesale_customers", "id", [fixture.customerId]),
        () => removeFixtureRows(admin, "wholesale_customers", "registered_user_id", fixture.userIds),
        ...fixture.userIds.map(userId => async () => {
          const removed = await admin.auth.admin.deleteUser(userId);
          if (removed.error || removed.data.user?.id !== userId) throw removed.error ?? new Error("本次账号删除缺少准确凭证。");
          const absent = await admin.auth.admin.getUserById(userId);
          if (absent.data.user || absent.error?.status !== 404 || absent.error?.code !== "user_not_found") {
            throw absent.error ?? new Error("本次账号删除后仍可读取。");
          }
        }),
      );
    },
  );
}
