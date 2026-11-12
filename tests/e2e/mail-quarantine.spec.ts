import { expect } from "@playwright/test";
import { test, loginMailAccount as login } from "./helpers/mail-test";
import { getMailAdmin } from "./helpers/mail-fixture-admin";
import { THREAD_ID, SALESMAN_ID, MESSAGE_ID } from "./helpers/mail-fixture-identity";

// 页面关键操作与独立凭证沿用原场景；自动夹具负责本例准备和模拟服务回收。
test("业务员隔离自己的会话后列表、数据库和审计一致", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByText("New wholesale inquiry").click();
  await page.getByRole("button", { name: "移入隔离区" }).click();
  await expect(
    page.getByText("邮件已移入隔离区，Gmail 原件仍然保留。"),
  ).toBeVisible();
  await expect(page.getByText("New wholesale inquiry")).toHaveCount(0);
  const { data: thread } = await getMailAdmin()
    .from("mail_threads")
    .select("intake_status,assigned_user_id,ref_code,version")
    .eq("id", THREAD_ID)
    .single();
  expect(thread).toMatchObject({
    intake_status: "quarantined",
    assigned_user_id: SALESMAN_ID,
    ref_code: "PT5-2026-LOCAL-ABC12345",
    version: 2,
  });
  const { data: audit } = await getMailAdmin()
    .from("mail_audit_events")
    .select("event_type,details")
    .eq("entity_id", THREAD_ID)
    .single();
  expect(audit?.event_type).toBe("mail_thread_quarantined");
  expect(JSON.stringify(audit)).not.toContain("Hello, we need");
  const { count: notifications } = await getMailAdmin()
    .from("mail_notifications")
    .select("id", { count: "exact", head: true });
  expect(notifications).toBe(0);
  await page.reload();
  await expect(page.getByText("New wholesale inquiry")).toHaveCount(0);
});

test("管理员创建规则、批量隔离并恢复后取得最终凭证", async ({ page }) => {
  await login(page, "administrator");
  await page.goto("/admin/mail");
  await page.getByRole("button", { name: "收件规则" }).click();
  const rulesPanel = page.getByTestId("mail-intake-rules-panel");
  await rulesPanel.getByLabel("匹配内容").fill("newsletter@example.com");
  await rulesPanel.getByRole("button", { name: "添加规则" }).click();
  await expect(page.getByText("收件规则已创建。")).toBeVisible();
  const { data: createdRule } = await getMailAdmin()
    .from("mail_intake_rules")
    .select("id,pattern_enc,pattern_hash,version")
    .single();
  expect(createdRule?.id).toBeTruthy();
  expect(createdRule?.pattern_hash).toBeTruthy();
  expect(createdRule?.pattern_enc).not.toContain("newsletter@example.com");

  await page.getByRole("button", { name: "邮件", exact: true }).click();
  await page.getByLabel("选择邮件：New wholesale inquiry").check();
  await page.getByLabel("后续来信").click();
  await page.getByRole("option", { name: "屏蔽发件人" }).click();
  await page.getByRole("button", { name: "隔离所选 1 封" }).click();
  await expect(
    page.getByText("邮件已移入隔离区，Gmail 原件仍然保留。"),
  ).toBeVisible();
  const { data: quarantined } = await getMailAdmin()
    .from("mail_threads")
    .select("intake_status,assigned_user_id,ref_code,version")
    .eq("id", THREAD_ID)
    .single();
  expect(quarantined).toMatchObject({
    intake_status: "quarantined",
    assigned_user_id: SALESMAN_ID,
    ref_code: "PT5-2026-LOCAL-ABC12345",
    version: 2,
  });
  const { count: ruleCount } = await getMailAdmin()
    .from("mail_intake_rules")
    .select("id", { count: "exact", head: true });
  expect(ruleCount).toBe(2);

  await page.getByRole("button", { name: /隔离区 1/ }).click();
  await page.getByText("New wholesale inquiry").click();
  await page.getByRole("button", { name: "恢复到工作台" }).click();
  await expect(page.getByText("邮件已恢复到工作台。")).toBeVisible();
  const { data: restored } = await getMailAdmin()
    .from("mail_threads")
    .select("intake_status,assigned_user_id,ref_code,version")
    .eq("id", THREAD_ID)
    .single();
  expect(restored).toMatchObject({
    intake_status: "active",
    assigned_user_id: SALESMAN_ID,
    ref_code: "PT5-2026-LOCAL-ABC12345",
    version: 3,
  });
  const { data: events } = await getMailAdmin()
    .from("mail_audit_events")
    .select("event_type")
    .eq("entity_id", THREAD_ID)
    .order("created_at");
  expect(events?.map((event) => event.event_type)).toEqual([
    "mail_thread_quarantined",
    "mail_thread_restored",
  ]);
  const { data: notification } = await getMailAdmin()
    .from("mail_notifications")
    .select("message_id,target_user_id,reason,status")
    .single();
  expect(notification).toMatchObject({
    message_id: MESSAGE_ID,
    target_user_id: SALESMAN_ID,
    reason: "assigned_inbound",
    status: "pending",
  });
  await page.getByRole("button", { name: "邮件", exact: true }).click();
  await expect(page.getByText("New wholesale inquiry")).toBeVisible();
  await page.reload();
  await expect(page.getByText("New wholesale inquiry")).toBeVisible();
});

test("隔离接口 HTTP 200 但没有任何更新时页面不会误报成功", async ({ page }) => {
  await login(page, "salesman");
  await page.route("**/api/mail/quarantine", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "completed",
          updated: [],
          failed: [],
          ruleId: null,
        }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto("/salesman/mail");
  await page.getByText("New wholesale inquiry").click();
  await page.getByRole("button", { name: "移入隔离区" }).click();
  await expect(page.getByText("部分邮件没有确认移入隔离区。")).toBeVisible();
  await expect(
    page.getByText("邮件已移入隔离区，Gmail 原件仍然保留。"),
  ).toHaveCount(0);
  const { data: thread } = await getMailAdmin()
    .from("mail_threads")
    .select("intake_status,version")
    .eq("id", THREAD_ID)
    .single();
  expect(thread).toMatchObject({ intake_status: "active", version: 1 });
});

test("管理员可删除隔离区系统副本且不留下正文", async ({ page }) => {
  await login(page, "administrator");
  await page.goto("/admin/mail");
  await page.getByLabel("选择邮件：New wholesale inquiry").check();
  await page.getByRole("button", { name: "隔离所选 1 封" }).click();
  await page.getByRole("button", { name: /隔离区 1/ }).click();
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
  expect(count).toBe(0);
  const { data: audit } = await getMailAdmin()
    .from("mail_audit_events")
    .select("event_type,details")
    .eq("event_type", "mail_thread_deleted")
    .single();
  expect(audit?.event_type).toBe("mail_thread_deleted");
  expect(JSON.stringify(audit)).not.toContain("Hello, we need");
});
