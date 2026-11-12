import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import {
  expectRepairReload,
  mockPartialPageRepair,
  openRepairAllocation,
  publishRepairRelease,
  recordRepairPageRequests,
  requestPageRepair,
  withSettlementRepairPage,
} from "./helpers/settlement-repair-page";

test.use({ serviceWorkers: "block" });

test("页面等待汇率精确补齐后才保存收款分配", async ({ page }, info) => {
  test.setTimeout(180_000);
  await withSettlementRepairPage(page, info, "historical", async (fixture) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/settlement-releases");
    const releaseId = await publishRepairRelease(page, fixture);
    const submit = await openRepairAllocation(page, fixture, releaseId);
    const calls = recordRepairPageRequests(page);
    fixture.beginAllocation();
    const dispatch = await requestPageRepair(page, releaseId, () =>
      submit.click(),
    );
    fixture.dispatched(dispatch);
    await expect(page.getByText("结汇收款分配已保存。")).toBeVisible({
      timeout: 120_000,
    });

    // 第一次保存因缺价停止，第二次必须仍是同一收款、订单和修订号。
    const submission = {
      p_release_id: releaseId,
      p_customer_id: fixture.identity.customerId,
      p_expected_revision: 0,
      p_allocations: [{ order_id: fixture.identity.orderId, amount: 10 }],
    };
    expect(calls.repairs).toEqual([{ p_release_id: releaseId }]);
    expect(calls.polls).toContain(dispatch.operationId);
    expect(calls.allocations).toEqual([submission, submission]);
    // 先等 pg_net 写入 HTTP 回执，再独立核对任务、日末报价、收款、分配及订单结汇。
    await expect
      .poll(
        () => {
          try {
            fixture.allocated();
            return "confirmed";
          } catch (error) {
            const code = error instanceof Error ? error.message : "";
            return /^settlement_repair_[a-z_]+$/.test(code)
              ? code
              : "unconfirmed";
          }
        },
        { timeout: 10_000, message: "实际补价和分配凭证尚未齐全" },
      )
      .toBe("confirmed");
    await expectRepairReload(page, fixture.note, releaseId, "调整分配");
    fixture.unchanged();
  });
});

test("汇率补齐返回部分失败时不重试分配，也不显示成功", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await withSettlementRepairPage(page, info, "partial", async (fixture) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/settlement-releases");
    const releaseId = await publishRepairRelease(page, fixture);
    const calls = recordRepairPageRequests(page);
    const operationId = randomUUID();
    await mockPartialPageRepair(page, fixture, releaseId, operationId);
    const submit = await openRepairAllocation(page, fixture, releaseId);

    fixture.beginAllocation();
    await submit.click();
    await expect(
      page.getByText(
        "这天的汇率还没有全部补齐，系统会继续处理，请稍后再保存。",
      ),
    ).toBeVisible();
    await expect(page.getByText("结汇收款分配已保存。")).toHaveCount(0);
    await expect(
      page.getByRole("dialog", { name: "分配收款", exact: true }),
    ).toBeVisible();
    expect(calls.repairs).toEqual([{ p_release_id: releaseId }]);
    expect(calls.polls).toContain(operationId);
    expect(calls.allocations).toEqual([
      {
        p_release_id: releaseId,
        p_customer_id: fixture.identity.customerId,
        p_expected_revision: 0,
        p_allocations: [{ order_id: fixture.identity.orderId, amount: 10 }],
      },
    ]);
    fixture.refused();
    await expectRepairReload(page, fixture.note, releaseId, "开始分配");
    fixture.unchanged();
  });
});
