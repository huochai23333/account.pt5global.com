import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { createSettlementRepairCase } from "../../test-support/settlement-repair-case";
import { repairUuid } from "../../test-support/settlement-repair-sql";
import { cleanupFixtureResources } from "../../test-support/fixture-cleanup-sequence";
import { requireBocSuiteBoundary } from "./boc-suite-guard";
import { fillDateControl } from "./date-control";
import { runLocalSupabaseSql } from "./local-supabase";
import { chooseSelectOption } from "./select-control";

type RepairCase = ReturnType<typeof createSettlementRepairCase>;
type Source = {
  snapshot(): {
    accepted: number;
    requests: { app: string; currency: string; day: string }[];
    errors: string[];
  };
  close(): Promise<void>;
};

const rpc = (name: string) =>
  new URL(`/rest/v1/rpc/${name}`, process.env.NEXT_PUBLIC_SUPABASE_URL!).href;
const publicationRpc = "create_wholesale_settlement_release";
const repairRpc = "request_settlement_exchange_rate_repair";
const allocationRpc = "replace_wholesale_settlement_release_allocations";

/** 使用同一专属 Edge 边界和有限报价来源。关闭浏览器与来源后才允许回收。 */
export async function withSettlementRepairPage(
  page: Page,
  info: TestInfo,
  mode: "historical" | "partial",
  exercise: (fixture: RepairCase) => Promise<void>,
) {
  const boundary = requireBocSuiteBoundary();
  const date =
    mode === "partial"
      ? boundary.today
      : new Date(Date.parse(boundary.today) - 86_400_000)
          .toISOString()
          .slice(0, 10);
  const fixture = createSettlementRepairCase(runLocalSupabaseSql, date);
  const origins = [
    process.env.PLAYWRIGHT_BASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
  ].map((url) => new URL(url).origin);
  let source: Source | undefined;
  let unknownOrigin = false,
    closed = false,
    stopped = false;
  let failure: { error: unknown } | undefined, cleanupReceipt: unknown;
  try {
    fixture.prepare();
    await page.route(/^https?:\/\//, (route) => {
      if (origins.includes(new URL(route.request().url()).origin))
        return route.continue();
      unknownOrigin = true;
      return route.abort("blockedbyclient");
    });
    if (mode === "historical") {
      const file = path.resolve(
        __dirname,
        "../../../../PT5-dropshipping-supabase/scripts/exchange-rate-sync-source.mjs",
      );
      const { startLocalRateSource } = createRequire(__filename)(file) as {
        startLocalRateSource(owner: string): Promise<Source>;
      };
      source = await startLocalRateSource(boundary.owner);
    }
    await exercise(fixture);
    if (source) {
      const proof = source.snapshot();
      assert.deepEqual(
        proof,
        {
          owner: boundary.owner,
          accepted: 1,
          requests: [
            { app: "finance.rate_cnyquot_history", currency: "USD", day: date },
          ],
          errors: [],
        },
        "settlement_repair_local_source_proof",
      );
    }
  } catch (error) {
    failure = { error };
  } finally {
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
        await source?.close();
        stopped = true;
      },
      async () => {
        assert(
          closed && stopped && !unknownOrigin,
          "settlement_repair_cleanup_boundary",
        );
        cleanupReceipt = fixture.cleanup();
      },
      async () =>
        info.attach("settlement-repair-case", {
          body: JSON.stringify(
            {
              ...fixture.evidence(),
              boundary,
              provider: source?.snapshot(),
              mode,
              closed,
              stopped,
              unknownOrigin,
              cleanupReceipt,
            },
            null,
            2,
          ),
          contentType: "application/json",
        }),
    );
  }
}

export async function publishRepairRelease(page: Page, fixture: RepairCase) {
  await page.getByRole("button", { name: "发布收款", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "发布结汇收款" });
  await chooseSelectOption(dialog.getByRole("combobox", { name: "选择客户" }), {
    label: fixture.identity.customerName,
  });
  await dialog.getByLabel("结汇金额").fill("10");
  await chooseSelectOption(dialog.getByLabel("币种"), { value: "USD" });
  await fillDateControl(dialog.getByLabel("收款日期"), fixture.identity.date);
  await dialog.getByLabel("备注").fill(fixture.note);
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url() === rpc(publicationRpc) &&
        r.request().method() === "POST" &&
        r.request().postDataJSON()?.p_note === fixture.note,
      { timeout: 30_000 },
    ),
    dialog.getByRole("button", { name: "发布收款", exact: true }).click(),
  ]);
  const releaseId: unknown = await response.json();
  const { p_publication_request_id: requestId } = response
    .request()
    .postDataJSON();
  assert(
    response.ok() &&
      typeof releaseId === "string" &&
      repairUuid.test(releaseId) &&
      typeof requestId === "string" &&
      repairUuid.test(requestId),
    "settlement_repair_publication_response",
  );
  fixture.published(releaseId, requestId);
  await expect(page.getByText("结汇收款已发布。")).toBeVisible();
  return releaseId;
}

export async function openRepairAllocation(
  page: Page,
  fixture: RepairCase,
  releaseId: string,
) {
  await page.getByLabel("搜索收款").fill(fixture.note);
  const row = page.getByTestId(`wholesale-settlement-release-row-${releaseId}`);
  await row.getByRole("button", { name: "开始分配", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "分配收款", exact: true });
  return dialog.getByRole("button", { name: "保存全部分配", exact: true });
}

export async function requestPageRepair(
  page: Page,
  releaseId: string,
  click: () => Promise<unknown>,
) {
  // 只认当前收款的派发应答；页面其它任务的成功轮询不能成为当前补价凭证。
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url() === rpc(repairRpc) &&
        r.request().method() === "POST" &&
        r.request().postDataJSON()?.p_release_id === releaseId,
      { timeout: 30_000 },
    ),
    click(),
  ]);
  const body = await response.json();
  assert(
    response.ok() &&
      typeof body?.operationId === "string" &&
      repairUuid.test(body.operationId) &&
      Number.isSafeInteger(body.transportRequestId) &&
      body.transportRequestId > 0 &&
      ["queued", "running", "succeeded"].includes(body.status),
    "settlement_repair_dispatch_response",
  );
  return {
    operationId: body.operationId as string,
    transportRequestId: body.transportRequestId as number,
  };
}

export function recordRepairPageRequests(page: Page) {
  const observed = {
    allocations: [] as unknown[],
    repairs: [] as unknown[],
    polls: [] as unknown[],
  };
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    if (request.url() === rpc(allocationRpc))
      observed.allocations.push(request.postDataJSON());
    if (request.url() === rpc(repairRpc))
      observed.repairs.push(request.postDataJSON());
    if (request.url() === rpc("get_operation_run"))
      observed.polls.push(request.postDataJSON()?.p_operation_id);
  });
  return observed;
}

/** 故障注入只匹配此收款和本次模拟任务。其余参数一律中断，避免落到真实写入。 */
export async function mockPartialPageRepair(
  page: Page,
  fixture: RepairCase,
  releaseId: string,
  operationId: string,
) {
  const reply = (value: unknown, status = 200) => ({
    body: JSON.stringify(value),
    contentType: "application/json",
    status,
  });
  await page.route(rpc(allocationRpc), (route) =>
    route.request().postDataJSON()?.p_release_id === releaseId
      ? route.fulfill(
          reply(
            {
              code: "P0001",
              details: null,
              hint: null,
              message: "wholesale_order_settlement_rate_missing",
            },
            400,
          ),
        )
      : route.abort("blockedbyclient"),
  );
  await page.route(rpc(repairRpc), (route) =>
    route.request().postDataJSON()?.p_release_id === releaseId
      ? route.fulfill(
          reply({ operationId, status: "queued", transportRequestId: 91 }),
        )
      : route.abort("blockedbyclient"),
  );
  await page.route(rpc("get_operation_run"), (route) => {
    if (route.request().postDataJSON()?.p_operation_id !== operationId)
      return route.abort("blockedbyclient");
    const now = new Date().toISOString();
    return route.fulfill(
      reply({
        attemptCount: 1,
        completedAt: now,
        createdAt: now,
        expectedCount: 2,
        failedCount: 1,
        lastErrorCode: "provider_partial_result",
        lastErrorMessage: "部分日期暂时没有可用汇率。",
        nextAttemptAt: null,
        operationId,
        operationKey: "exchange-rate-sync",
        resultProof: { verifiedDates: [fixture.identity.date] },
        status: "partial_failed",
        succeededCount: 1,
      }),
    );
  });
}

export async function expectRepairReload(
  page: Page,
  note: string,
  releaseId: string,
  action: string,
) {
  await page.reload();
  await page.getByLabel("搜索收款").fill(note);
  const row = page.getByTestId(`wholesale-settlement-release-row-${releaseId}`);
  await expect(
    row.getByRole("button", { name: action, exact: true }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}
