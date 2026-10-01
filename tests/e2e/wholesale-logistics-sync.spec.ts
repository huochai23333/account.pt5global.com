import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { chooseSelectOption } from "./helpers/select-control";
import { executeLocalSql, startLogisticsSourceFixture } from "./helpers/logistics-source-fixture";
import { localSqlValue, readLocalPostgresRows } from "./helpers/local-postgres-query";

test.use({ video: "off", trace: "off" });

// 页面回归只允许本机地址；地址配置意外变为生产时立即失败，不能继续发请求。
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) return route.continue();
    return route.abort("blockedbyclient");
  });
});

test("页面同步限流后保存进度，后台按原运行续跑，刷新分页显示真实结果", async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  const fixture = await startLogisticsSourceFixture();
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, "administrator");
    const firstResponse = page.waitForResponse((response) => response.url().endsWith("/functions/v1/wholesale-logistics-sync") && response.request().method() === "POST");
    // 由真实页面发起自动同步，来源夹具只替代外部系统；主库和 Edge 均走真实执行链。
    await page.goto("/admin/wholesale/logistics");
    const partial = await (await firstResponse).json();
    expect(partial.outcome).toBe("partial_failed");
    expect(partial.syncedCount).toBe(25);
    fixture.operationIds.add(partial.operationId);
    await expect(page.getByText("已显示现有物流记录，最新数据稍后会继续更新。")).toBeVisible();
    const [run] = readLocalPostgresRows<{ status: string; succeeded_count: number; next_attempt_at: string }>(
      `select status,succeeded_count,next_attempt_at from private.operation_runs where id=${localSqlValue(partial.operationId)}::uuid`,
    );
    expect(run.status).toBe("queued");
    expect(run.succeeded_count).toBe(25);
    expect(Date.parse(run.next_attempt_at)).toBeGreaterThan(Date.now() + 100_000);
    const [checkpoint] = readLocalPostgresRows<{ cursor: { orderId: number }; processed_count: number }>("select cursor,processed_count from public.wholesale_logistics_checkpoints where mode='incremental'");
    expect(checkpoint.cursor.orderId).toBe(9_000_025);
    expect(checkpoint.processed_count).toBe(25);
    const before = readLocalPostgresRows<{ package_number: string; version: string }>("select package_number,xmin::text as version from public.wholesale_logistics_records where package_number like 'LOCAL-RETRY-%' order by package_number");
    expect(before).toHaveLength(25);

    // 仅把本地时钟等待提前，模拟调度器第二次派发；生产等待规则在 SQL/重试单测中另行核对。
    fixture.recover();
    executeLocalSql(`update public.wholesale_logistics_sync_state set retry_not_before=null;
      update private.operation_runs set status='queued',attempt_count=2,next_attempt_at=now()+interval '1 hour' where id=${localSqlValue(partial.operationId)}::uuid;
      insert into private.operation_attempts(operation_run_id,attempt_number) values(${localSqlValue(partial.operationId)}::uuid,2);`);
    const retry = await request.post("http://127.0.0.1:54321/functions/v1/wholesale-logistics-sync", {
      headers: { "x-wholesale-logistics-job-token": "local-job-fixture" },
      data: { trigger: "page", operationId: partial.operationId, attempt: 2 },
    });
    const completed = await retry.json();
    expect(retry.status(), JSON.stringify(completed)).toBe(200);
    expect(completed.outcome).toBe("succeeded");
    expect(completed.syncedCount).toBe(50);
    const [finalRun] = readLocalPostgresRows<{ status: string; result_proof: { completed: boolean }; succeeded_count: number }>(
      `select status,result_proof,succeeded_count from private.operation_runs where id=${localSqlValue(partial.operationId)}::uuid`,
    );
    expect(finalRun.status).toBe("succeeded");
    expect(finalRun.result_proof.completed).toBe(true);
    expect(finalRun.succeeded_count).toBe(50);
    const after = readLocalPostgresRows<{ package_number: string; version: string }>("select package_number,xmin::text as version from public.wholesale_logistics_records where package_number like 'LOCAL-RETRY-%' order by package_number");
    expect(after).toHaveLength(50);
    expect(after.filter((row) => before.some((old) => old.package_number === row.package_number))).toEqual(before);
    expect(fixture.calls.map((call) => call.orderId)).toEqual([0, 9_000_025, 9_000_025]);
    const countBeforeReplay = fixture.calls.length;
    await request.post("http://127.0.0.1:54321/functions/v1/wholesale-logistics-sync", {
      headers: { "x-wholesale-logistics-job-token": "local-job-fixture" }, data: { trigger: "page", operationId: partial.operationId, attempt: 2 },
    });
    expect(fixture.calls.length).toBe(countBeforeReplay);

    const reloadResponse = page.waitForResponse((response) => response.url().endsWith("/functions/v1/wholesale-logistics-sync") && response.request().method() === "POST");
    await page.reload();
    const refreshed = await (await reloadResponse).json();
    fixture.operationIds.add(refreshed.operationId);
    expect(refreshed.reason).toBe("already_fresh");
    await chooseSelectOption(page.getByLabel("店小秘店铺"), { label: "Local Retry Shop" });
    await expect(page.getByText("第 1-20 条，共 50 条")).toBeVisible();
    await expect(page.getByText("最近更新时间")).toBeVisible();
    await page.getByRole("button", { name: "下一页" }).click();
    await expect(page.getByText("第 21-40 条，共 50 条")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("logistics-resumed-desktop.png"), fullPage: true, animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText("第 21-40 条，共 50 条")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: testInfo.outputPath("logistics-resumed-mobile.png"), fullPage: true, animations: "disabled" });
    expect(consoleErrors).toEqual([]);
    // 开发工具本身也使用 portal，只有错误覆盖层才表示页面异常。
    await expect(page.locator("nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);
  } finally { await fixture.close(); }
});

for (const state of ["queued", "incomplete", "already_running"] as const) {
  test(`页面拒绝把 ${state} 的 HTTP 200 回执当成完成`, async ({ page }) => {
    const now = new Date().toISOString();
    // 故障注入只替代响应，页面仍通过第二次账本读取判断完成，不产生真实写操作。
    await page.route("**/functions/v1/wholesale-logistics-sync", async (route) => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 200, headers: {
        "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*",
      } });
      await route.fulfill({ json: { operationId: "00000000-0000-4000-8000-000000000001",
        operationStatus: state === "already_running" ? "skipped" : "succeeded" } });
    });
    await page.route("**/rest/v1/rpc/get_operation_run", (route) => route.fulfill({ json: {
      operationId: "00000000-0000-4000-8000-000000000001", operationKey: "wholesale-logistics-sync",
      status: state === "queued" ? "queued" : state === "already_running" ? "skipped" : "succeeded",
      createdAt: now, completedAt: state === "queued" ? null : now, expectedCount: 0, succeededCount: 0,
      failedCount: 0, attemptCount: 1, lastErrorCode: null, lastErrorMessage: null, nextAttemptAt: null,
      resultProof: { completed: false, reason: state },
    } }));
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/logistics");
    await expect(page.getByText("已显示现有物流记录，最新数据稍后会继续更新。")).toBeVisible();
    await expect(page.getByRole("heading", { name: "物流管理" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("已显示现有物流记录，最新数据稍后会继续更新。")).toBeVisible();
  });
}
