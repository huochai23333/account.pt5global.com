import { test as base } from "@playwright/test";
import { runLocalSupabaseSql } from "./local-supabase";
import { createReimbursementSharingCase } from "../../test-support/reimbursement-sharing-case";
import { cleanupFixtureResources } from "../../test-support/fixture-cleanup-sequence";
import { createSharingGates } from "./reimbursement-sharing-pages";

type SharingCase = ReturnType<typeof createReimbursementSharingCase> &
  ReturnType<typeof createSharingGates>;

/** 每个页面场景单独准备/回收，分页、报销和竞态删除不再依赖其他测试先运行成功。 */
export const test = base.extend<{ sharingCase: SharingCase }>({
  sharingCase: async ({ page }, provideCase, testInfo) => {
    if (testInfo.config.workers !== 1)
      throw new Error("sharing_fixture_requires_single_worker");
    const data = createReimbursementSharingCase(runLocalSupabaseSql);
    const gates = createSharingGates();
    let bodyError: { value: unknown } | undefined;
    let pageClosed = false;
    let cleanupReceipt: ReturnType<typeof data.cleanup> | undefined;
    try {
      data.seed();
      await provideCase({ ...data, ...gates });
    } catch (value) {
      bodyError = { value };
    } finally {
      await cleanupFixtureResources(
        async () => {
          if (bodyError) throw bodyError.value;
        },
        async () => {
          gates.releaseAll();
          if (!page.isClosed()) {
            await page.unrouteAll({ behavior: "wait" });
            await page.close();
          }
          pageClosed = true;
        },
        async () => {
          // 路由仍可能写入时保留行与失败；附件依旧尝试生成，不覆盖原始错误。
          if (!pageClosed) throw new Error("sharing_fixture_page_not_closed");
          cleanupReceipt = data.cleanup();
        },
        async () =>
          testInfo.attach("reimbursement-sharing-fixture", {
            body: Buffer.from(
              JSON.stringify({ ...data.evidence(), cleanupReceipt }, null, 2),
            ),
            contentType: "application/json",
          }),
      );
    }
  },
});
