import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loginAs } from "./helpers/auth";
import { fillDateControl } from "./helpers/date-control";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";
import { chooseSelectOption } from "./helpers/select-control";

const HISTORICAL_RATE_DATE = "2026-09-12";
const LOCAL_EDGE_ENDPOINT =
  "http://host.docker.internal:54321/functions/v1/exchange-rate-sync";

test("页面等待汇率精确补齐后才保存收款分配", async ({ page }) => {
  test.setTimeout(180_000);
  const admin = requireLocalAdminClient();
  const marker = `汇率真实补齐 ${Date.now()}`;
  const originalEndpoint = readExchangeRateEndpointFromLocalDocker();
  replaceExchangeRateEndpointInLocalDocker(LOCAL_EDGE_ENDPOINT);
  let releaseId: string | null = null;
  let terminalRun: Record<string, unknown> | null = null;

  try {
    await removeTestHistoricalRate(admin);
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/settlement-releases");
    await publishRelease(page, {
      note: marker,
      receivedDate: HISTORICAL_RATE_DATE,
    });
    const release = await readReleaseByNote(admin, marker);
    releaseId = release.id;

    // 监听页面真实轮询响应，记录同一 operationId 的最终状态；响应成功本身不作凭证。
    page.on("response", async (response) => {
      if (!response.url().includes("/rest/v1/rpc/get_operation_run")) return;
      try {
        const value = await response.json() as Record<string, unknown>;
        if (value.status === "succeeded") terminalRun = value;
      } catch {
        // 非 JSON 或中断响应留给页面失败分支处理，测试不会据此宣称成功。
      }
    });

    await page.getByLabel("搜索收款").fill(marker);
    const row = page.getByRole("row").filter({ hasText: marker });
    await row.getByRole("button", { name: "开始分配" }).click();
    const dialog = page.getByRole("dialog", { name: "分配收款" });
    await dialog.getByRole("button", { name: "保存全部分配" }).click();
    await expect(page.getByText("结汇收款分配已保存。")).toBeVisible({
      timeout: 120_000,
    });

    await expect.poll(() => terminalRun, { timeout: 10_000 }).not.toBeNull();
    // 回调中的赋值发生在 TypeScript 控制流之外，断言后显式收窄为已取得的运行记录。
    const verifiedTerminalRun = terminalRun as unknown as Record<string, unknown>;
    expect(verifiedTerminalRun.status).toBe("succeeded");
    expect(verifiedTerminalRun.completedAt).toEqual(expect.any(String));
    expect(verifiedTerminalRun.failedCount).toBe(0);
    // 用独立服务端连接核对精确业务日期、真实报价日期和分配记录。
    const persistedRate = await readHistoricalRate(admin);
    expect(Number(persistedRate.daily_exchange_rate)).toBeGreaterThan(0);
    expect(verifiedTerminalRun.resultProof).toMatchObject({
      rateRecordId: persistedRate.id,
      verifiedDates: expect.arrayContaining([HISTORICAL_RATE_DATE]),
    });
    // 不写死供应商是否把周末标成请求日或前一报价日；只接受不晚于业务日、
    // 且在系统允许的七天沿用窗口内的真实报价日。
    const businessDateTime = Date.parse(`${HISTORICAL_RATE_DATE}T00:00:00.000Z`);
    const providerDateTime = Date.parse(
      `${persistedRate.provider_rate_date}T00:00:00.000Z`,
    );
    expect(providerDateTime).toBeLessThanOrEqual(businessDateTime);
    expect(businessDateTime - providerDateTime).toBeLessThanOrEqual(
      7 * 24 * 60 * 60 * 1_000,
    );
    const persistedRelease = await readReleaseByNote(admin, marker);
    expect(persistedRelease.status).toBe("allocated");
    expect(persistedRelease.allocation_revision).toBe(1);
    expect(await countActiveAllocations(admin, release.id)).toBeGreaterThan(0);

    await page.reload();
    await page.getByLabel("搜索收款").fill(marker);
    const refreshedRow = page.getByRole("row").filter({ hasText: marker });
    await expect(refreshedRow.getByRole("button", { name: "调整分配" }))
      .toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  } finally {
    await cleanupRelease(admin, marker, releaseId);
    await removeTestHistoricalRate(admin);
    replaceExchangeRateEndpointInLocalDocker(originalEndpoint);
  }
});

test("汇率补齐返回部分失败时不重试分配，也不显示成功", async ({ page }) => {
  test.setTimeout(120_000);
  const admin = requireLocalAdminClient();
  const marker = `汇率部分失败 ${Date.now()}`;
  const operationId = "00000000-0000-4000-8000-000000000091";

  try {
    await page.setViewportSize({ height: 844, width: 390 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/settlement-releases");

    // 收款从真实页面发布；后续用独立服务端连接取得权威编号，而不是依赖成功提示。
    await publishRelease(page, { note: marker, receivedDate: getShanghaiDate() });
    const release = await readReleaseByNote(admin, marker);
    expect(release.status).toBe("pending");
    expect(release.allocation_revision).toBe(0);

    let allocationRequestCount = 0;
    await page.route(
      "**/rest/v1/rpc/replace_wholesale_settlement_release_allocations",
      async (route) => {
        allocationRequestCount += 1;
        await route.fulfill({
          body: JSON.stringify({
            code: "P0001",
            details: null,
            hint: null,
            message: "wholesale_order_settlement_rate_missing",
          }),
          contentType: "application/json",
          status: 400,
        });
      },
    );
    await page.route(
      "**/rest/v1/rpc/request_settlement_exchange_rate_repair",
      (route) => route.fulfill({
        body: JSON.stringify({
          operationId,
          status: "queued",
          transportRequestId: 91,
        }),
        contentType: "application/json",
        status: 200,
      }),
    );
    await page.route("**/rest/v1/rpc/get_operation_run", (route) =>
      route.fulfill({
        body: JSON.stringify({
          attemptCount: 1,
          completedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          expectedCount: 2,
          failedCount: 1,
          lastErrorCode: "provider_partial_result",
          lastErrorMessage: "部分日期暂时没有可用汇率。",
          nextAttemptAt: null,
          operationId,
          operationKey: "exchange-rate-sync",
          resultProof: { verifiedDates: [getShanghaiDate()] },
          status: "partial_failed",
          succeededCount: 1,
        }),
        contentType: "application/json",
        status: 200,
      }),
    );

    await page.getByLabel("搜索收款").fill(marker);
    const row = page.getByRole("row").filter({ hasText: marker });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "开始分配" }).click();
    const dialog = page.getByRole("dialog", { name: "分配收款" });
    await dialog.getByRole("button", { name: "保存全部分配" }).click();

    await expect(page.getByText("这天的汇率还没有全部补齐，系统会继续处理，请稍后再保存。"))
      .toBeVisible();
    await expect(page.getByText("结汇收款分配已保存。")).toHaveCount(0);
    await expect(dialog).toBeVisible();
    expect(allocationRequestCount).toBe(1);

    // 页面反馈不是凭证：数据库中仍应是待分配、修订号不变且没有活动分配记录。
    const persistedRelease = await readReleaseByNote(admin, marker);
    expect(persistedRelease.status).toBe("pending");
    expect(persistedRelease.allocation_revision).toBe(0);
    expect(await countActiveAllocations(admin, release.id)).toBe(0);

    await page.reload();
    await page.getByLabel("搜索收款").fill(marker);
    const refreshedRow = page.getByRole("row").filter({ hasText: marker });
    await expect(refreshedRow.getByRole("button", { name: "开始分配" }))
      .toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  } finally {
    await cleanupRelease(admin, marker);
  }
});

async function publishRelease(
  page: Page,
  options: { note: string; receivedDate: string },
) {
  await page.getByRole("button", { name: "发布收款" }).click();
  const dialog = page.getByRole("dialog", { name: "发布结汇收款" });
  await chooseSelectOption(dialog.getByRole("combobox", { name: "选择客户" }), {
    label: "Wholesale Alpha",
  });
  await dialog.getByLabel("结汇金额").fill("10");
  await chooseSelectOption(dialog.getByLabel("币种"), { value: "USD" });
  await fillDateControl(dialog.getByLabel("收款日期"), options.receivedDate);
  await dialog.getByLabel("备注").fill(options.note);
  await dialog.getByRole("button", { name: "发布收款" }).click();
  await expect(page.getByText("结汇收款已发布。")).toBeVisible();
}

function requireLocalAdminClient() {
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "必须连接本地 Docker Supabase 才能核对最终业务凭证。");
  if (!admin) throw new Error("local_supabase_admin_required");
  return admin;
}

async function readReleaseByNote(admin: SupabaseClient, note: string) {
  const { data, error } = await admin
    .from("wholesale_settlement_releases")
    .select("id,status,allocation_revision")
    .eq("note", note)
    .single<{ id: string; status: string; allocation_revision: number }>();
  if (error) throw error;
  return data;
}

async function countActiveAllocations(admin: SupabaseClient, releaseId: string) {
  const { count, error } = await admin
    .from("wholesale_settlement_release_allocations")
    .select("id", { count: "exact", head: true })
    .eq("release_id", releaseId)
    .eq("status", "active");
  if (error) throw error;
  return count;
}

async function cleanupRelease(
  admin: SupabaseClient,
  note: string,
  knownReleaseId?: string | null,
) {
  let releaseId = knownReleaseId;
  if (!releaseId) {
    const { data } = await admin
      .from("wholesale_settlement_releases")
      .select("id")
      .eq("note", note)
      .maybeSingle<{ id: string }>();
    releaseId = data?.id ?? null;
  }

  // 有效分配要求 settlement_id 始终非空；如果先删结汇记录，外键的 SET NULL
  // 会先触发该约束。测试清理必须按“分配明细 → 结汇记录 → 收款发布”顺序执行。
  if (releaseId) {
    const { data: allocations, error: allocationLookupError } = await admin
      .from("wholesale_settlement_release_allocations")
      .select("id,settlement_id")
      .eq("release_id", releaseId);
    if (allocationLookupError) throw allocationLookupError;

    const { data: deletedAllocations, error: allocationDeleteError } = await admin
      .from("wholesale_settlement_release_allocations")
      .delete()
      .eq("release_id", releaseId)
      .select("id");
    if (allocationDeleteError) throw allocationDeleteError;
    if ((deletedAllocations?.length ?? 0) !== (allocations?.length ?? 0)) {
      throw new Error("test_allocation_cleanup_count_mismatch");
    }

    const settlementIds = (allocations ?? [])
      .map((allocation) => allocation.settlement_id)
      .filter((value): value is string => typeof value === "string");

    if (settlementIds.length > 0) {
      const { data: deletedSettlements, error: settlementError } = await admin
        .from("wholesale_order_settlements")
        .delete()
        .in("id", settlementIds)
        .select("id");
      if (settlementError) throw settlementError;
      if ((deletedSettlements?.length ?? 0) !== settlementIds.length) {
        throw new Error("test_settlement_cleanup_count_mismatch");
      }
    }
  }

  const { data: deletedReleases, error } = await admin
    .from("wholesale_settlement_releases")
    .delete()
    .eq("note", note)
    .select("id");
  if (error) throw error;
  if ((deletedReleases?.length ?? 0) !== 1) {
    throw new Error("test_release_cleanup_count_mismatch");
  }
}

function readExchangeRateEndpointFromLocalDocker() {
  const endpoint = runLocalDockerSql(
    "select endpoint from public.internal_job_request_secrets where name = 'exchange-rate-sync';",
  );
  if (!/^https?:\/\//.test(endpoint)) {
    throw new Error("local_exchange_rate_endpoint_missing");
  }
  return endpoint;
}

function replaceExchangeRateEndpointInLocalDocker(endpoint: string) {
  const escapedEndpoint = endpoint.replaceAll("'", "''");
  const updated = runLocalDockerSql(
    `update public.internal_job_request_secrets set endpoint = '${escapedEndpoint}' where name = 'exchange-rate-sync' returning endpoint;`,
  );
  if (updated !== endpoint) throw new Error("local_edge_endpoint_not_updated");
}

function runLocalDockerSql(sql: string) {
  // 敏感任务表不向 Data API 暴露；本地 E2E 只通过固定 Docker 容器的 psql 进程切换测试地址。
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "-e",
      "PGPASSWORD=postgres",
      "supabase_db_pt5-dropshipping",
      "psql",
      "-h",
      "127.0.0.1",
      "-At",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "supabase_admin",
      "-d",
      "postgres",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();
}

async function removeTestHistoricalRate(admin: SupabaseClient) {
  const { error } = await admin
    .from("exchange_rate")
    .delete()
    .eq("original_currency", "USD")
    .eq("target_currency", "CNY")
    .eq("rate_date", HISTORICAL_RATE_DATE)
    .eq("source", "frankfurter");
  if (error) throw error;
}

async function readHistoricalRate(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("exchange_rate")
    .select("id,daily_exchange_rate,provider_rate_date")
    .eq("original_currency", "USD")
    .eq("target_currency", "CNY")
    .eq("rate_date", HISTORICAL_RATE_DATE)
    .single<{
      id: string;
      daily_exchange_rate: number;
      provider_rate_date: string;
    }>();
  if (error) throw error;
  return data;
}

function getShanghaiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date());
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(2);
}
