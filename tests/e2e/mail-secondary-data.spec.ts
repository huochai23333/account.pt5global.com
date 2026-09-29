import { expect, test } from "@playwright/test";
import type { Server } from "node:http";
import { loginAs } from "./helpers/auth";
import { resetMailBoundaryState, startMailBoundaryMockServer } from "./helpers/mail-boundary-mock-server";
import { getMailAdmin, PEER_SALESMAN_ID, resetIntegratedMailFixture, THREAD_ID } from "./helpers/mail-fixtures";

let boundaryServer: Server;
test.beforeAll(async () => { boundaryServer = await startMailBoundaryMockServer(); });
test.beforeEach(async () => { resetMailBoundaryState(); await resetIntegratedMailFixture(); });
test.afterAll(async () => { await new Promise<void>((resolve, reject) => boundaryServer.close((error) => error ? reject(error) : resolve())); });

// 次要资料失败不能阻止阅读，也必须在当前工作页提供恢复入口。
for (const role of ["administrator", "salesman"] as const) {
  test(`${role} 负责人名单失败后重试并转交，最终记录与刷新一致`, async ({ page }) => {
    await loginAs(page, role);
    const workspace = role === "administrator" ? "admin" : "salesman";
    const endpoint = role === "administrator" ? "agents" : "assignable-agents";
    await page.route(`**/api/mail/${endpoint}`, route => route.fulfill({ status: 503, json: { error: "Agents unavailable" } }));
    await page.goto(`/${workspace}/mail`);
    await page.getByText("New wholesale inquiry").click();
    await expect(page.getByText("Hello, we need a quote for 500 units.")).toBeVisible();
    await expect(page.getByTestId("mail-secondary-status")).toContainText("这部分资料暂时没有加载");
    await expect(page.getByLabel("负责人")).toBeDisabled();
    await page.unroute(`**/api/mail/${endpoint}`);
    await page.getByRole("button", { name: "重新读取", exact: true }).click();
    await expect(page.getByLabel("负责人")).toBeEnabled();
    await page.getByLabel("负责人").click();
    await page.getByRole("option", { name: "本地协作业务员", exact: true }).click();
    await expect(page.getByText("会话已转交。")).toBeVisible();
    // 页面确认之后独立核对真实负责人、版本和审计，按钮恢复本身不代表转交成功。
    const { data: thread, error } = await getMailAdmin().from("mail_threads").select("assigned_user_id,version").eq("id", THREAD_ID).single();
    expect(error).toBeNull();
    expect(thread).toEqual({ assigned_user_id: PEER_SALESMAN_ID, version: 2 });
    const { data: audit } = await getMailAdmin().from("mail_assignment_events").select("assigned_user_id,thread_version").eq("thread_id", THREAD_ID);
    expect(audit).toEqual([{ assigned_user_id: PEER_SALESMAN_ID, thread_version: 2 }]);
    await page.reload();
    if (role === "salesman") await expect(page.getByText("New wholesale inquiry")).toHaveCount(0);
    else {
      await page.getByText("New wholesale inquiry").click();
      await expect(page.getByLabel("负责人")).toContainText("本地协作业务员");
    }
    await expect(page.locator("nextjs-portal")).toHaveCount(0);
  });
}

test("慢管理统计不阻塞核心会话，独立失败后可以重新读取", async ({ page }) => {
  await loginAs(page, "administrator");
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let requested = false;
  await page.route("**/api/mail/metrics", async (route) => {
    requested = true;
    await gate;
    await route.fulfill({ status: 503, json: { error: "Statistics unavailable" } });
  });
  await page.goto("/admin/mail");
  await expect(page.getByText("New wholesale inquiry")).toBeVisible();
  await expect.poll(() => requested).toBe(true);
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  await expect(page.getByTestId("mail-composer")).toBeVisible();
  await page.getByRole("button", { name: "邮箱设置", exact: true }).click();
  await expect(page.getByTestId("mail-secondary-status")).toContainText("正在读取邮件设置");
  release();
  await expect(page.getByTestId("mail-secondary-status")).toContainText("这部分资料暂时没有加载");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `output/mail-secondary-error-${width}.png` });
  }
  await page.unroute("**/api/mail/metrics");
  await page.getByRole("button", { name: "重新读取", exact: true }).click();
  await expect(page.getByTestId("mail-secondary-status")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "公司邮箱", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("New wholesale inquiry")).toBeVisible();
  await expect(page.locator("nextjs-portal")).toHaveCount(0);
});
