import { expect } from "@playwright/test";
import { test, loginMailAccount as login } from "./helpers/mail-test";
import { getMailAdmin } from "./helpers/mail-fixture-admin";
import { THREAD_ID, MESSAGE_ID, ADMIN_ID } from "./helpers/mail-fixture-identity";
import { getMailBoundaryState } from "./helpers/mail-boundary-state";

// 页面关键操作与独立凭证沿用原场景；自动夹具负责本例准备和模拟服务回收。
test("业务员阅读、生成并编辑建议、回复后取得数据库与 Gmail 双重凭证", async ({
  page,
}) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByText("New wholesale inquiry").click();
  await expect(
    page.getByText("Hello, we need a quote for 500 units."),
  ).toBeVisible();
  await page.getByRole("button", { name: "生成回复建议" }).click();
  const body = page.locator("textarea").last();
  await expect(body).toHaveValue(/thank you for your inquiry/i, {
    timeout: 30_000,
  });
  await body.fill(`${await body.inputValue()}\nWe will send the price today.`);
  await page.getByRole("button", { name: "发送邮件" }).click();
  await expect(
    page.getByText("邮件已在公司邮箱的“已发送”中确认。"),
  ).toBeVisible({ timeout: 30_000 });
  const { data: job } = await getMailAdmin()
    .from("mail_outbound_jobs")
    .select("status,provider_message_id,sent_message_id")
    .single();
  expect(job?.status).toBe("sent");
  expect(job?.provider_message_id).toMatch(/^gmail-/);
  expect(job?.sent_message_id).toBeTruthy();
  expect(getMailBoundaryState().sent.at(-1)?.verifiedInSent).toBe(true);
  const { data: read } = await getMailAdmin()
    .from("mail_thread_reads")
    .select("last_read_message_id")
    .eq("thread_id", THREAD_ID)
    .single();
  expect(read?.last_read_message_id).toBe(MESSAGE_ID);
  await page.reload();
  await expect(page.getByText("New wholesale inquiry")).toBeVisible();
});

test("业务员上传安全附件并新建邮件", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const composer = page.getByTestId("mail-composer");
  await composer.getByLabel("收件人").fill("newbuyer@example.com");
  await composer.getByLabel("主题").fill("Sample request");
  await composer
    .getByLabel("正文")
    .fill("Please find the requested information attached.");
  await composer
    .locator('input[type="file"]')
    .setInputFiles({
      name: "quote.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("quote"),
    });
  await expect(composer.getByText("quote.txt · 可以发送")).toBeVisible();
  await composer.getByRole("button", { name: "发送邮件" }).click();
  await expect(
    page.getByText("邮件已在公司邮箱的“已发送”中确认。"),
  ).toBeVisible({ timeout: 30_000 });
  const { data: upload } = await getMailAdmin()
    .from("mail_uploads")
    .select("consumed_at,scan_status")
    .single();
  const { count } = await getMailAdmin()
    .from("mail_attachments")
    .select("id", { count: "exact", head: true });
  expect(upload?.scan_status).toBe("clean");
  expect(upload?.consumed_at).toBeTruthy();
  expect(count).toBe(1);
});

test("管理员首次打开自动生成发件资料并取得 Gmail 最终凭证", async ({
  page,
}) => {
  await login(page, "administrator");
  await page.goto("/admin/mail");
  const { data: profile } = await getMailAdmin()
    .from("mail_agent_profiles")
    .select("alias_local_part,ref_prefix,enabled,version")
    .eq("user_id", ADMIN_ID)
    .single();
  expect(profile).toMatchObject({
    alias_local_part: "local.admin",
    ref_prefix: "LOCALADMIN",
    enabled: true,
    version: 1,
  });
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const composer = page.getByTestId("mail-composer");
  await expect(composer.getByTestId("mail-sender-unavailable")).toHaveCount(0);
  await composer.getByLabel("收件人").fill("matchstick2333@gmail.com");
  await composer.getByLabel("主题").fill("ADMIN-SENDER-PROFILE-TEST");
  await composer
    .getByLabel("正文")
    .fill("Administrator sender profile verification.");
  await composer.getByRole("button", { name: "发送邮件" }).click();
  await expect(
    page.getByText("邮件已在公司邮箱的“已发送”中确认。"),
  ).toBeVisible({ timeout: 30_000 });
  const { data: job } = await getMailAdmin()
    .from("mail_outbound_jobs")
    .select("actor_user_id,status,provider_message_id,sent_message_id")
    .eq("actor_user_id", ADMIN_ID)
    .single();
  expect(job?.status).toBe("sent");
  expect(job?.provider_message_id).toMatch(/^gmail-/);
  expect(job?.sent_message_id).toBeTruthy();
  expect(getMailBoundaryState().sent.at(-1)?.verifiedInSent).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const refreshedComposer = page.getByTestId("mail-composer");
  await expect(
    refreshedComposer.getByTestId("mail-sender-unavailable"),
  ).toHaveCount(0);
  await refreshedComposer.getByLabel("收件人").fill("matchstick2333@gmail.com");
  await refreshedComposer.getByLabel("主题").fill("ADMIN-SENDER-REFRESH-CHECK");
  await refreshedComposer
    .getByLabel("正文")
    .fill("The sender profile remains available after refresh.");
  await expect(
    refreshedComposer.getByRole("button", { name: "发送邮件" }),
  ).toBeEnabled();
});

test("Gmail 返回编号但查不到 SENT 时绝不显示成功", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const composer = page.getByTestId("mail-composer");
  await composer.getByLabel("收件人").fill("buyer@example.com");
  await composer.getByLabel("主题").fill("BROKEN RECEIPT");
  await composer.getByLabel("正文").fill("This must fail final verification.");
  await composer.getByRole("button", { name: "发送邮件" }).click();
  await expect(
    page.getByText("公司邮箱的发送结果需要人工核对，请勿再次发送这封邮件。"),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText("邮件已在公司邮箱的“已发送”中确认。"),
  ).toHaveCount(0);
  const { data: job } = await getMailAdmin()
    .from("mail_outbound_jobs")
    .select("status,provider_message_id,sent_message_id")
    .single();
  expect(job?.status).toBe("partial_failed");
  expect(job?.provider_message_id).toMatch(/^gmail-/);
  expect(job?.sent_message_id).toBeNull();
});
