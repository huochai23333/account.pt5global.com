import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const origin = "http://localhost:3000";
const requestSync = "**/rest/v1/rpc/request_sales_lead_sync";
const getRun = "**/rest/v1/rpc/get_operation_run";

for (const [locale, width, messages] of [["zh", 1440, zh], ["en", 390, en]] as const) {
  test(`线索同步只接受当前运行的终态 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    const copy = messages.SalesLeads;
    // 只在账本建立专属运行并保存合成终态。浏览器的派发请求被拦截，不调用外部来源。
    const { data: created, error: creationError } = await learningUser.client.rpc("create_service_operation_run", {
      p_operation_key: "sales-lead-sync",
      p_trigger_source: "manual",
      p_requested_by_user_id: learningUser.id,
      p_idempotency_key: `learning-${learningUser.runId}`,
    });
    expect(creationError).toBeNull();
    const id: string = created.operationId;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const lookup = () => JSON.parse(executeLearningSql(`select row_to_json(r) from (
      select id, status, succeeded_count, failed_count, completed_at, xmin::text as version
      from private.operation_runs where id='${id}' and requested_by_user_id='${learningUser.id}'
    ) r;`) || "null");
    let dispatches = 0;
    let reads = 0;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const saved = await learningUser.client.rpc("finish_operation_attempt_checked", {
        p_operation_id: id, p_attempt_number: 1, p_outcome: "succeeded",
        p_expected_count: 1, p_succeeded_count: 1, p_failed_count: 0,
        p_result_proof: { fixture: learningUser.runId },
      });
      expect(saved.error).toBeNull();
      const stored = lookup();
      expect(stored).toMatchObject({ id, status: "succeeded", succeeded_count: 1, failed_count: 0, completed_at: expect.any(String) });

      await page.route(requestSync, (route) => {
        dispatches += 1;
        return route.fulfill({ headers: { "access-control-allow-origin": origin }, json: { operationId: id, status: "queued" } });
      });
      await page.route(getRun, async (route) => {
        reads += 1;
        expect(route.request().postDataJSON()).toEqual({ p_operation_id: id });
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        const result = await response.json();
        expect(result).toMatchObject({ operationId: id, status: "succeeded", succeededCount: 1 });
        // 第二次模拟一次错配回执，其他字段仍来自实际数据库读取。
        await route.fulfill({ response, json: reads === 1 ? result : { ...result, operationId: learningUser.runId } });
      });

      await page.setViewportSize({ width, height: 900 });
      await page.context().addCookies([{ name: "bs-locale", value: "zh", url: origin }]);
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: origin }]);
      await page.goto("/admin/wholesale/leads");
      const sync = page.getByRole("button", { name: copy.actions.syncNow, exact: true });
      await expect(sync).toBeVisible();
      await sync.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      await expect(page.getByText(copy.sync.result.succeeded, { exact: true })).toBeVisible();
      expect([dispatches, reads]).toEqual([1, 1]);
      expect(lookup()).toEqual(stored);
      await page.screenshot({ path: testInfo.outputPath(`terminal-${locale}-${width}.png`) });

      await page.reload();
      await expect(sync).toBeVisible();
      expect([dispatches, reads]).toEqual([1, 1]);
      await sync.click();
      await expect(page.getByText(copy.errors.unknown, { exact: true })).toBeVisible();
      await expect(page.getByText(copy.sync.result.succeeded, { exact: true })).toHaveCount(0);
      expect([dispatches, reads]).toEqual([2, 2]);
      expect(lookup()).toEqual(stored);
      expect(errors).toEqual([]);
      await writeFile(testInfo.outputPath("operation-run-receipt.json"), JSON.stringify({ stored, dispatches, reads }, null, 2));
    } finally {
      executeLearningSql(`delete from private.operation_runs where id='${id}' and requested_by_user_id='${learningUser.id}';`);
      expect(lookup()).toBeNull();
    }
  });
}
