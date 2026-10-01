import { expect, test } from "@playwright/test";
import type { Server } from "node:http";
import { loginAs } from "./helpers/auth";
import { resetMailBoundaryState, startMailBoundaryMockServer } from "./helpers/mail-boundary-mock-server";
import { getMailAdmin, resetIntegratedMailFixture, seedNumberedMailThreads, THREAD_ID } from "./helpers/mail-fixtures";
import { readLocalPostgresRows } from "./helpers/local-postgres-query";

// 邮件分页只模拟外部提供方，所有列表、数量和权限仍走本地真实数据库。
let boundaryServer: Server;
test.beforeAll(async () => { boundaryServer = await startMailBoundaryMockServer(); });
test.beforeEach(async () => { resetMailBoundaryState(); await resetIntegratedMailFixture(); });
test.afterAll(async () => { await new Promise<void>((resolve, reject) => boundaryServer.close((error) => error ? reject(error) : resolve())); });

test("邮件固定二十条分页，翻页清除勾选并与数据库顺序一致", async ({ page }) => {
  const fixtureIds = await seedNumberedMailThreads();
  try {
  const records = readLocalPostgresRows<{ id: string }>(
    "select id from public.mail_threads where intake_status = 'active' and deleted_at is null order by last_message_at desc, id desc",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await loginAs(page, "administrator");
  await page.goto("/admin/mail");
  const list = page.locator('[data-testid^="mail-thread-"]');
  await expect(list).toHaveCount(20);
  await expect(page.getByText(`第 1-20 条，共 ${records.length} 条`)).toBeVisible();
  const ids = () => list.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-testid")!.replace("mail-thread-", "")));
  expect(await ids()).toEqual(records.slice(0, 20).map((row) => row.id));
  await page.getByRole("checkbox").first().check();
  await expect(page.getByRole("button", { name: "隔离所选 1 封" })).toBeVisible();
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByText(`第 21-40 条，共 ${records.length} 条`)).toBeVisible();
  expect(await ids()).toEqual(records.slice(20, 40).map((row) => row.id));
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(list).toHaveCount(records.length - 40);
  await expect(page.getByRole("button", { name: "下一页" })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: "output/pagination/mail-mobile.png", fullPage: true });
  await page.reload();
  await expect(list).toHaveCount(20);
  expect(await ids()).toEqual(records.slice(0, 20).map((row) => row.id));
  expect(errors).toEqual([]);
  } finally {
    const result = await getMailAdmin().from("mail_threads").delete().in("id", fixtureIds).select("id");
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(fixtureIds.length);
  }
});

test("隔离记录也按二十条读取，末页数量与数据库一致", async ({ page }) => {
  const fixtureIds = await seedNumberedMailThreads(45, "quarantined");
  try {
    const records = readLocalPostgresRows<{ id: string }>(
      "select id from public.mail_threads where intake_status = 'quarantined' and deleted_at is null order by quarantined_at desc, id desc",
    );
    await loginAs(page, "administrator");
    await page.goto("/admin/mail");
    await page.getByRole("button", { name: /^隔离区/ }).click();
    const panel = page.getByTestId("mail-quarantine-panel");
    const items = panel.getByRole("button", { name: /^Paging inquiry/ });
    await expect(items).toHaveCount(20);
    await expect(panel.getByText(`第 1-20 条，共 ${records.length} 条`)).toBeVisible();
    await panel.getByRole("button", { name: "下一页" }).click();
    await expect(panel.getByText(`第 21-40 条，共 ${records.length} 条`)).toBeVisible();
    await expect(items).toHaveCount(20);
    await panel.getByRole("button", { name: "下一页" }).click();
    await expect(items).toHaveCount(5);
    await expect(panel.getByRole("button", { name: "下一页" })).toBeDisabled();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
    await page.reload();
    await page.getByRole("button", { name: /^隔离区/ }).click();
    await expect(items).toHaveCount(20);
  } finally {
    const cleanup = await getMailAdmin().from("mail_threads").delete().in("id", fixtureIds).select("id");
    expect(cleanup.error).toBeNull();
    expect(cleanup.data).toHaveLength(fixtureIds.length);
  }
});

test("删除末页唯一会话后回到有效页，独立删除凭证与刷新结果一致", async ({ page }) => {
  const fixtureIds = await seedNumberedMailThreads(20);
  try {
    await loginAs(page, "administrator");
    await page.goto("/admin/mail");
    await expect(page.getByText("第 1-20 条，共 21 条")).toBeVisible();
    await page.getByRole("button", { name: "下一页" }).click();
    await expect(page.getByText("第 21-21 条，共 21 条")).toBeVisible();
    // 基础会话也是本用例独立重建的夹具，带一封真实的本地消息以覆盖详情和删除链路。
    await page.getByTestId(`mail-thread-${THREAD_ID}`).click();
    await page.getByRole("button", { name: "删除系统副本", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "删除系统副本？" });
    await confirmation.getByRole("button", { name: "确认操作", exact: true }).click();
    await expect(page.getByText("第 1-20 条，共 20 条")).toBeVisible();
    await expect(page.locator('[data-testid^="mail-thread-"]')).toHaveCount(20);
    await expect(page.getByRole("button", { name: "下一页" })).toBeDisabled();
    const [receipt] = readLocalPostgresRows<{ count: number; audit_count: number }>(
      `select (select count(*) from public.mail_threads where id = '${THREAD_ID}') as count,
        (select count(*) from public.mail_audit_events where entity_id = '${THREAD_ID}'
          and event_type = 'mail_thread_deleted') as audit_count`,
    );
    expect(receipt).toEqual({ count: 0, audit_count: 1 });
    await page.reload();
    await expect(page.getByText("第 1-20 条，共 20 条")).toBeVisible();
    await expect(page.getByTestId(`mail-thread-${THREAD_ID}`)).toHaveCount(0);
  } finally {
    const cleanup = await getMailAdmin().from("mail_threads").delete().in("id", fixtureIds).select("id");
    expect(cleanup.error).toBeNull();
    expect(cleanup.data).toHaveLength(20);
    await resetIntegratedMailFixture();
  }
});
