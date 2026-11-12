import { test as base, type TestInfo } from "@playwright/test";
import { createBocQuoteJobCase } from "../../test-support/boc-quote-job-case";
import { cleanupFixtureResources } from "../../test-support/fixture-cleanup-sequence";
import { requireBocSuiteBoundary } from "./boc-suite-guard";
import { runLocalSupabaseSql } from "./local-supabase";

type Suite = {
  job: ReturnType<typeof createBocQuoteJobCase>;
  boundary: ReturnType<typeof requireBocSuiteBoundary>;
  unresolved: Set<string>;
};

export const test = base.extend<{ bocResponse: void }, { bocSuite: Suite }>({
  bocSuite: [
    async ({}, use, worker) => {
      if (worker.config.workers !== 1)
        throw new Error("boc_suite_requires_serial_worker");
      // 三个场景共享当天报价；先验证实际容器和供应商挂载，再准备可回收的模拟数据。
      const boundary = requireBocSuiteBoundary();
      const job = createBocQuoteJobCase(
        runLocalSupabaseSql,
        boundary.owner,
        boundary.today,
      );
      await use({ job, boundary, unresolved: new Set() });
    },
    { scope: "worker" },
  ],

  bocResponse: [
    async ({ page, bocSuite }, runTest) => {
      const { job, unresolved } = bocSuite;
      const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
      const app = new URL(process.env.PLAYWRIGHT_BASE_URL!);
      const endpoint = new URL("/functions/v1/exchange-rate-sync", api).href;
      await page.route(/^https?:\/\//, async (route) => {
        const request = route.request();
        const origin = new URL(request.url()).origin;
        if (origin !== api.origin && origin !== app.origin) {
          unresolved.add("browser_origin_refused");
          await route.abort("blockedbyclient");
          return;
        }
        if (request.method() !== "POST" || request.url() !== endpoint) {
          await route.continue();
          return;
        }
        // 真实 Edge 执行并返回原响应。先登记编号再放行页面，关闭页面时不会丢掉已收到的凭证。
        try {
          const payload = request.postDataJSON() as Record<string, unknown>;
          const keys = Object.keys(payload).sort().join(",");
          if (
            !(
              payload.trigger === "manual" && keys === "baseCurrencies,trigger"
            ) &&
            !(payload.trigger === "recalculation_rates" && keys === "trigger")
          )
            throw new Error("boc_suite_request_out_of_scope");
          const response = await route.fetch({
            maxRedirects: 0,
            timeout: 90_000,
          });
          if (response.status() >= 300 && response.status() < 400)
            throw new Error("boc_suite_edge_redirect_refused");
          try {
            const body = await response.json();
            job.recordOperation(
              body?.operationId,
              payload,
              body?.operationStatus,
            );
          } catch {
            unresolved.add("operation_response_unconfirmed");
          }
          await route.fulfill({ response });
        } catch {
          unresolved.add("operation_transport_unconfirmed");
          await route.abort("failed");
        }
      });
      try {
        await runTest();
      } finally {
        try {
          // 页面侧别再产生写入后，才从独立数据库读取任务、尝试和报价的完整版本。
          if (!page.isClosed()) {
            await page.unrouteAll({ behavior: "wait" });
            await page.close();
          }
          job.capture();
        } catch (error) {
          unresolved.add("page_or_database_capture_unconfirmed");
          throw error;
        }
      }
    },
    { auto: true },
  ],
});

/** 串行场景结束后统一回收。出现未确认的传输或写入时，保留隔离实例和最后凭证。 */
export async function finishBocSuite(
  { job, boundary, unresolved }: Suite,
  info: TestInfo,
) {
  let cleanupReceipt: unknown;
  await cleanupFixtureResources(
    async () => {
      if (unresolved.size) throw new Error("boc_suite_cleanup_unconfirmed");
      cleanupReceipt = job.cleanup();
    },
    async () =>
      info.attach("boc-quote-job-case", {
        body: JSON.stringify(
          {
            ...job.evidence(),
            boundary,
            unresolved: [...unresolved],
            cleanupReceipt,
          },
          null,
          2,
        ),
        contentType: "application/json",
      }),
  );
}
