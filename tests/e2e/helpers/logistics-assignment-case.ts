import { test as base, type Page } from "@playwright/test";
import { createLogisticsAssignmentCase } from "../../test-support/logistics-assignment-case";
import { runLocalSupabaseSql } from "./local-supabase";

type StoreCase = ReturnType<typeof createLogisticsAssignmentCase>;
/** 只有请求storeCase的归属场景准备自有店铺；原认证、只读种子与分页场景不替换。 */
export const test = base.extend<{
  storeCase: StoreCase;
  trackLogisticsPage: (page: Page) => void;
}>({
  trackLogisticsPage: async ({}, provideTracker) => {
    const pages: Page[] = [];
    try {
      await provideTracker((page) => {
        pages.push(page);
      });
    } finally {
      // browser.newPage创建的上下文不属于默认page；任一角色断言失败也必须逐一收尾。
      const results = await Promise.allSettled(
        pages.map(async (page) => {
          if (!page.isClosed()) {
            await page.unrouteAll({ behavior: "wait" });
            await page.close();
          }
        }),
      );
      const errors = results
        .filter((r) => r.status === "rejected")
        .map((r) => r.reason);
      if (errors.length)
        throw new AggregateError(errors, "logistics_role_pages_cleanup_failed");
    }
  },
  storeCase: async ({ page }, provideCase, testInfo) => {
    if (testInfo.config.workers !== 1)
      throw new Error("logistics_case_requires_single_worker");
    const fixture = createLogisticsAssignmentCase(runLocalSupabaseSql);
    let cleanupReceipt;
    try {
      fixture.prepare();
      await provideCase(fixture);
    } finally {
      try {
        // 先等页面写入排空，再删本次已知版本；未知写入保留数据，不把失败改成成功。
        if (!page.isClosed()) {
          await page.unrouteAll({ behavior: "wait" });
          await page.close();
        }
        cleanupReceipt = fixture.cleanup();
      } finally {
        await testInfo.attach("logistics-owned-assignment", {
          body: Buffer.from(
            JSON.stringify({ ...fixture.evidence(), cleanupReceipt }, null, 2),
          ),
          contentType: "application/json",
        });
      }
    }
  },
});
