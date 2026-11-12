import type { Page, TestInfo } from "@playwright/test";
import { cleanupFixtureResources } from "../../test-support/fixture-cleanup-sequence";

/** 正文异常和收尾异常都保留；先排空/关闭页面，再允许限定清理或恢复共享故障。 */
export async function finalizeCompanyTemplateCase(
  page: Page,
  testInfo: TestInfo,
  cleanup: () => Promise<unknown>,
  bodyFailure: { error: unknown } | undefined,
  evidence?: () => unknown,
) {
  let closed = false;
  let receipt: unknown;
  await cleanupFixtureResources(
    async () => {
      if (bodyFailure) throw bodyFailure.error;
    },
    async () => {
      if (!page.isClosed()) {
        await page.unrouteAll({ behavior: "wait" });
        await page.close();
      }
      closed = true;
    },
    async () => {
      if (!closed) throw new Error("company_template_case_page_not_closed");
      receipt = await cleanup();
    },
    async () =>
      testInfo.attach("company-template-case-cleanup", {
        body: Buffer.from(
          JSON.stringify(
            {
              pageClosed: closed,
              cleanupConfirmed: receipt !== undefined,
              receipt,
              evidence: evidence?.(),
            },
            null,
            2,
          ),
        ),
        contentType: "application/json",
      }),
  );
}
