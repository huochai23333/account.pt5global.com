import type { Page, TestInfo } from "@playwright/test";
import type { createBocRecalculationCohort } from "../../test-support/boc-recalculation-cohort";
import { cleanupFixtureResources } from "../../test-support/fixture-cleanup-sequence";

/** 先停止可能继续写入的页面，再按已捕获整图回收；失败和附件均不覆盖原正文异常。 */
export async function finalizeBocRecalculationCohort(
  page: Page,
  info: TestInfo,
  cohort: ReturnType<typeof createBocRecalculationCohort>,
  failure?: { error: unknown },
) {
  let closed = false;
  let receipt: unknown;
  await cleanupFixtureResources(
    async () => {
      if (failure) throw failure.error;
    },
    async () => {
      if (!page.isClosed()) {
        await page.unrouteAll({ behavior: "wait" });
        await page.close();
      }
      closed = true;
    },
    async () => {
      if (!closed) throw new Error("boc_cohort_page_not_closed");
      receipt = cohort.cleanup();
    },
    async () =>
      info.attach("boc-recalculation-cohort", {
        body: Buffer.from(
          JSON.stringify(
            {
              ...cohort.evidence(),
              pageClosed: closed,
              cleanupReceipt: receipt,
            },
            null,
            2,
          ),
        ),
        contentType: "application/json",
      }),
  );
}
