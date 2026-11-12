import type { Browser, Page, TestInfo } from "@playwright/test";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect } from "./fixtures";

const origin = "http://localhost:3000";

type Assignment = { actor_user_id: string; assigned_user_id: string; thread_version: number };
type Snapshot = { thread: { id: string; version: number; assigned_user_id: string }; assignments: Assignment[] };

export async function reloadAdminMail(page: Page) {
  // 人员名单由客户端挂载后读取。等这次读取后再点击，避免在服务端静态按钮上提前操作。
  await Promise.all([
    page.waitForResponse((response) => response.url() === `${origin}/api/mail/agents` && response.ok(), { timeout: 15_000 }),
    page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 }),
  ]);
}

/** 三个独立登录共用真实本地邮件记录；账号由外层测试夹具统一清理。 */
export async function verifyTransferVisibility(input: {
  admin: Page;
  previous: Page;
  browser: Browser;
  testInfo: TestInfo;
  threadId: string;
  subject: string;
  adminId: string;
  nextOwner: Parameters<typeof loginLearningUser>[1];
  read: () => Snapshot;
}) {
  const { admin, previous, browser, testInfo, threadId, subject, adminId, nextOwner, read } = input;
  const endpoint = `/api/mail/threads/${threadId}`;
  const rowId = `mail-thread-${threadId}`;
  const before = read();
  await reloadAdminMail(admin);
  await admin.getByTestId(rowId).click({ timeout: 10_000 });
  const assignee = admin.getByLabel(zh.MailWorkspace.assignee, { exact: true });
  await expect(assignee).toBeEnabled();
  await previous.bringToFront();
  const formerHeading = previous.getByRole("heading", { name: subject, exact: true });
  const formerBody = previous.getByLabel(en.MailWorkspace.body, { exact: true });
  await expect(formerHeading).toBeVisible();
  await formerBody.fill("Local reply before transfer");
  // 暂时无法确认权限时保留会话和草稿。下一次请求继续读取真实服务。
  await previous.route(`**${endpoint}`, (route) => route.request().method() === "HEAD"
    ? route.fulfill({ status: 503 })
    : route.fallback(), { times: 1 });
  await previous.waitForResponse((response) => response.request().method() === "HEAD" &&
    response.url().endsWith(endpoint) && response.status() === 503, { timeout: 12_000 });
  await expect(formerHeading).toBeVisible();
  await expect(formerBody).toHaveValue("Local reply before transfer");

  await assignee.click();
  const nextName = `学习验收 ${nextOwner.runId}`;
  await admin.getByRole("option", { name: nextName, exact: true }).click();
  await expect(assignee).toContainText(nextName);
  const transfer = read();
  const version = before.thread.version + 1;
  expect(transfer.thread).toMatchObject({ id: threadId, assigned_user_id: nextOwner.id, version });
  expect(transfer.assignments).toEqual([...before.assignments, {
    actor_user_id: adminId, assigned_user_id: nextOwner.id, thread_version: version,
  }]);

  await expect(formerHeading).toHaveCount(0, { timeout: 12_000 });
  await expect(previous.getByTestId(rowId)).toHaveCount(0);
  await expect(previous.getByText(en.MailWorkspace.threadUnavailable, { exact: true })).toBeVisible();
  await expect(formerBody).toHaveValue("");
  await expect(previous.getByLabel(en.MailWorkspace.recipient, { exact: true })).toHaveValue("");
  const deniedDetails = await previous.request.get(`${origin}${endpoint}`, { timeout: 10_000 });
  expect(deniedDetails.status()).toBe(400);
  expect(await deniedDetails.json()).toEqual({ code: "thread_unavailable", error: "没有找到可访问的邮件会话。" });
  await previous.screenshot({ path: testInfo.outputPath("mail-transfer-former-owner-mobile.png"), animations: "disabled" });
  await previous.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
  await expect(formerBody).toHaveValue("");
  await expect(previous.getByTestId(rowId)).toHaveCount(0);

  const next = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await loginLearningUser(next, nextOwner);
    await next.context().addCookies([{ name: "bs-locale", value: "en", url: origin }]);
    const announcement = next.getByRole("dialog", { name: en.DashboardShell.announcements.newTitle, exact: true });
    await next.addLocatorHandler(announcement, () =>
      announcement.getByRole("button", { name: en.DashboardShell.announcements.acknowledge, exact: true }).click(),
    );
    await next.goto(`${origin}/salesman/mail`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await next.getByTestId(rowId).click({ timeout: 12_000 });
    await expect(next.getByRole("heading", { name: subject, exact: true })).toBeVisible();
    expect(await next.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await next.screenshot({ path: testInfo.outputPath("mail-transfer-next-owner-desktop.png"), animations: "disabled" });
  } finally {
    await next.close();
  }
  expect(read()).toEqual(transfer);
  return transfer;
}
