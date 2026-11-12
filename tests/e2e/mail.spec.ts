import { expect } from "@playwright/test";
import { test, loginMailAccount as login } from "./helpers/mail-test";
import { getMailAdmin } from "./helpers/mail-fixture-admin";

// 页面关键操作与独立凭证沿用原场景；自动夹具负责本例准备和模拟服务回收。
test("明确拒绝后可修改收件人再发送，后台只产生一个任务", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const composer = page.getByTestId("mail-composer");
  await composer.getByRole("textbox", { name: "收件人" }).fill("bad");
  await composer.getByRole("textbox", { name: "主题" }).fill("修正地址回归");
  await composer
    .getByRole("textbox", { name: "正文" })
    .fill("这是一封本地测试邮件。");
  await composer.getByRole("button", { name: "发送邮件" }).click();
  await expect(page.getByText("请检查收件人邮箱地址。")).toBeVisible();
  const { count: rejectedCount } = await getMailAdmin()
    .from("mail_outbound_jobs")
    .select("id", { count: "exact", head: true });
  expect(rejectedCount).toBe(0);
  await composer
    .getByRole("textbox", { name: "收件人" })
    .fill("client@example.test");
  await composer.getByRole("button", { name: "发送邮件" }).click();
  await expect(
    page.getByText("邮件已在公司邮箱的“已发送”中确认。"),
  ).toBeVisible({ timeout: 30_000 });
  const { data: jobs } = await getMailAdmin()
    .from("mail_outbound_jobs")
    .select("id,status,provider_message_id");
  expect(jobs).toHaveLength(1);
  expect(jobs?.[0]).toMatchObject({ status: "sent" });
  expect(jobs?.[0].provider_message_id).toBeTruthy();
  await page.reload();
  const { count: afterReloadCount } = await getMailAdmin()
    .from("mail_outbound_jobs")
    .select("id", { count: "exact", head: true });
  expect(afterReloadCount).toBe(1);
});

test("邮件正文超限后可缩短重试，后台只建立一次发送任务", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const composer = page.getByTestId("mail-composer");
  await composer
    .getByRole("textbox", { name: "收件人" })
    .fill("client@example.test");
  await composer.getByRole("textbox", { name: "主题" }).fill("超限后重试回归");
  await composer
    .getByRole("textbox", { name: "正文" })
    .fill("a".repeat(270_000));
  await composer.getByRole("button", { name: "发送邮件" }).click();
  await expect(
    page.getByText("提交内容超过允许大小，请缩短文字或减少附件后重试。"),
  ).toBeVisible();
  const { count: rejectedCount } = await getMailAdmin()
    .from("mail_outbound_jobs")
    .select("id", { count: "exact", head: true });
  expect(rejectedCount).toBe(0);
  // 只有明确拒绝且未建任务时才允许沿用草稿重试，最后以后台发送凭证确认结果。
  await composer.getByRole("textbox", { name: "正文" }).fill("缩短后的正文");
  await composer.getByRole("button", { name: "发送邮件" }).click();
  await expect(
    page.getByText("邮件已在公司邮箱的“已发送”中确认。"),
  ).toBeVisible({ timeout: 30_000 });
  const { data: jobs } = await getMailAdmin()
    .from("mail_outbound_jobs")
    .select("id,status,provider_message_id");
  expect(jobs).toHaveLength(1);
  expect(jobs?.[0]).toMatchObject({ status: "sent" });
  expect(jobs?.[0].provider_message_id).toBeTruthy();
  await page.reload();
  const { count: afterReloadCount } = await getMailAdmin()
    .from("mail_outbound_jobs")
    .select("id", { count: "exact", head: true });
  expect(afterReloadCount).toBe(1);
});

test("站内离开、返回和刷新仍恢复未发送草稿", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const composer = page.getByTestId("mail-composer");
  await composer
    .getByRole("textbox", { name: "收件人" })
    .fill("draft@example.test");
  await composer.getByRole("textbox", { name: "主题" }).fill("待续草稿");
  await composer
    .getByRole("textbox", { name: "正文" })
    .fill("离开后继续编辑的正文");
  await page.getByRole("link", { name: "返回我的页面" }).click();
  await page.goto("/salesman/mail");
  await expect(composer.getByRole("textbox", { name: "正文" })).toHaveValue(
    "离开后继续编辑的正文",
  );
  page.once("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await expect(composer.getByRole("textbox", { name: "收件人" })).toHaveValue(
    "draft@example.test",
  );
  await expect(composer.getByRole("textbox", { name: "主题" })).toHaveValue(
    "待续草稿",
  );
  await expect(composer.getByRole("textbox", { name: "正文" })).toHaveValue(
    "离开后继续编辑的正文",
  );
});

test("未发送邮件切换会话时保留当前输入", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  const composer = page.getByTestId("mail-composer");
  await composer.getByLabel("收件人").fill("draft@example.test");
  await composer.getByLabel("主题").fill("待继续的邮件");
  await composer.getByLabel("正文").fill("离开前先确认");
  await page.getByRole("button", { name: "新邮件", exact: true }).click();
  await expect(
    page.getByText("离开后当前输入会丢失。确定要离开吗？").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "暂不操作" }).click();
  await expect(composer.getByLabel("收件人")).toHaveValue("draft@example.test");
  await expect(composer.getByLabel("主题")).toHaveValue("待继续的邮件");
  await expect(composer.getByLabel("正文")).toHaveValue("离开前先确认");
  await page.getByText("New wholesale inquiry").click();
  await expect(
    page.getByText("离开后当前输入会丢失。确定要离开吗？").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "确认操作" }).click();
  await expect(page.getByText("New wholesale inquiry")).toBeVisible();
});
