import { expect } from "@playwright/test";
import { test, loginMailAccount as login } from "./helpers/mail-test";
import { getMailAdmin } from "./helpers/mail-fixture-admin";
import { THREAD_ID, PEER_SALESMAN_ID } from "./helpers/mail-fixture-identity";

// 页面关键操作与独立凭证沿用原场景；自动夹具负责本例准备和模拟服务回收。
test("新建邮件在桌面和窄屏都直接显示核心输入框", async ({ page }) => {
  await login(page, "administrator");
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/mail");
    await page.getByRole("button", { name: "新邮件", exact: true }).click();

    const panel = page.getByTestId("mail-new-message-panel");
    const composer = page.getByTestId("mail-composer");
    await expect(panel).toBeVisible();
    await expect(composer.getByLabel("收件人")).toBeInViewport();
    await expect(composer.getByLabel("主题")).toBeInViewport();
    await expect(composer.getByLabel("正文")).toBeInViewport();

    const panelBox = await panel.boundingBox();
    const composerBox = await composer.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(composerBox).not.toBeNull();
    // 紧凑标题区应保持在 120px 内，防止再次出现把表单推到首屏以下的大块空白。
    expect((composerBox?.y ?? 0) - (panelBox?.y ?? 0)).toBeLessThanOrEqual(120);
  }
});

test("当前负责人转交后版本、审计与刷新结果一致", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByText("New wholesale inquiry").click();
  await page.getByLabel("负责人").click();
  await expect(page.getByRole("option", { name: "本地管理员" })).toHaveCount(0);
  await page.getByRole("option", { name: "本地协作业务员" }).click();
  await expect(page.getByText("会话已转交。")).toBeVisible();
  const { data: thread } = await getMailAdmin()
    .from("mail_threads")
    .select("assigned_user_id,version")
    .eq("id", THREAD_ID)
    .single();
  const { data: audit } = await getMailAdmin()
    .from("mail_assignment_events")
    .select("assigned_user_id,thread_version")
    .eq("thread_id", THREAD_ID)
    .single();
  expect(thread).toMatchObject({
    assigned_user_id: PEER_SALESMAN_ID,
    version: 2,
  });
  expect(audit).toMatchObject({
    assigned_user_id: PEER_SALESMAN_ID,
    thread_version: 2,
  });
  await page.reload();
  await expect(page.getByText("New wholesale inquiry")).toHaveCount(0);
});

test("管理员生成报告并删除系统副本，数据库保留无正文审计", async ({ page }) => {
  await login(page, "administrator");
  await page.goto("/admin/mail");
  await page.getByRole("button", { name: "邮箱设置" }).click();
  await page.getByRole("button", { name: "生成分析报告" }).click();
  await expect(page.getByText("本期询盘稳定")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "邮件", exact: true }).click();
  await page.getByText("New wholesale inquiry").click();
  await page.getByRole("button", { name: "删除系统副本" }).click();
  await page.getByRole("button", { name: "确认操作" }).click();
  await expect(
    page.getByText("系统副本已删除，Gmail 原件仍然保留。"),
  ).toBeVisible();
  const { count } = await getMailAdmin()
    .from("mail_threads")
    .select("id", { count: "exact", head: true })
    .eq("id", THREAD_ID);
  const { data: audit } = await getMailAdmin()
    .from("mail_audit_events")
    .select("id,event_type,details")
    .eq("entity_id", THREAD_ID)
    .single();
  expect(count).toBe(0);
  expect(audit?.event_type).toBe("mail_thread_deleted");
  expect(JSON.stringify(audit)).not.toContain("Hello, we need");
  await page.reload();
  await expect(page.getByText("New wholesale inquiry")).toHaveCount(0);
});
