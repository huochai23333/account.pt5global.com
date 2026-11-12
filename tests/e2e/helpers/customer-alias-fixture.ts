import { execFileSync } from "node:child_process";
import { test as base } from "@playwright/test";
import { getLocalSupabaseAdminClient } from "./local-supabase-admin";
import { readDisposablePostgresTarget } from "../../test-support/disposable-fixture";
import { cleanupFixtureResources } from "../../test-support/fixture-cleanup-sequence";
import { createCustomerAliasFixture, verifyCustomerAliasRecord, cleanupCustomerAliasRecord, type CustomerAliasFixture } from "../../test-support/customer-alias-records";

export type CustomerAliasPageFixture = CustomerAliasFixture & {
  verify: (names: string[], revision: number) => ReturnType<typeof verifyCustomerAliasRecord>;
};

/** 仅提供测试清单和读回/清理；客户和别名的业务写入仍由用例从页面发起。 */
export const test = base.extend<{ customerAlias: CustomerAliasPageFixture }>({
  customerAlias: async ({ baseURL, page }, provideAlias) => {
    const verifyTarget = () => readDisposablePostgresTarget({
      baseURL, supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL, mode: process.env.PT5_E2E_FIXTURE_MODE,
      project: process.env.PT5_E2E_DATABASE_PROJECT, container: process.env.PT5_E2E_DATABASE_CONTAINER,
    }, args => execFileSync("docker", args, { encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 }).trim());
    // 声明disposable还不够，实际DB/Kong/API映射与暂停状态通过后才取管理员客户端。
    verifyTarget();
    const admin = getLocalSupabaseAdminClient();
    if (!admin) throw new Error("customer_alias_fixture_requires_local_admin");
    const fixture = createCustomerAliasFixture();
    let bodyFailed = false;
    let bodyError: unknown;
    try {
      // 共享同一份清单，首次独立读回绑定的ID也立即对页面用例可见，不能复制一个过期快照。
      await provideAlias(Object.assign(fixture, { verify: (names: string[], revision: number) => verifyCustomerAliasRecord(admin, fixture, names, revision) }));
    } catch (error) {
      bodyFailed = true;
      bodyError = error;
      throw error;
    } finally {
      try {
        // 页面是显式依赖，先关闭本次交互再回收；关闭失败也继续独立核验/清理，不能覆盖主体错误。
        await cleanupFixtureResources(
          () => page.close(),
          async () => { verifyTarget(); await cleanupCustomerAliasRecord(admin, fixture); },
        );
      } catch (cleanupError) {
        const errors = cleanupError instanceof AggregateError ? cleanupError.errors : [cleanupError];
        if (bodyFailed) throw new AggregateError([bodyError, ...errors], "customer_alias_fixture_cleanup_failed");
        throw cleanupError;
      }
    }
  },
});
