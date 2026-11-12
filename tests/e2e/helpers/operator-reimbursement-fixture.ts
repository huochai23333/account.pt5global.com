import { test as base } from "@playwright/test";
import { runLocalSupabaseSql } from "./local-supabase";
import { createOperatorReimbursementFixture } from "../../test-support/operator-reimbursement-fixture";

const operatorId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const periodStart = "2024-06-25";
type ReimbursementCase = ReturnType<typeof createOperatorReimbursementFixture>;

/** 夹具只在原账号检查后显式prepare；skip不触发数据准备，也不创建替代登录。 */
export const test = base.extend<{ reimbursementCase: ReimbursementCase }>({
  reimbursementCase: async ({ page }, provideCase, testInfo) => {
    // 固定账号/历史周期不供并行worker共享，避免一个批量报销操作波及另一测试。
    if (testInfo.config.workers !== 1) throw new Error("reimbursement_fixture_requires_single_worker");
    const fixture = createOperatorReimbursementFixture(runLocalSupabaseSql, operatorId, periodStart);
    try {
      await provideCase(fixture);
    } finally {
      let cleanupReceipt;
      try {
        // 不和未完成的页面请求竞争删除；无法排空时保留数据及原错误，不能假报清理成功。
        if (!page.isClosed()) {
          await page.unrouteAll({ behavior: "wait" });
          await page.close();
        }
        cleanupReceipt = fixture.cleanup();
      } finally {
        await testInfo.attach("operator-reimbursement-fixture", {
          body: Buffer.from(JSON.stringify({ ...fixture.evidence(), cleanupReceipt }, null, 2)),
          contentType: "application/json",
        });
      }
    }
  },
});
