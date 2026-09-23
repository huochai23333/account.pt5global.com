import { expect, test, type Page } from "@playwright/test";

import { getRegressionAccount } from "./helpers/accounts";
import { setTestLocale } from "./helpers/auth";
import { getMailAdmin, resetIntegratedMailFixture, seedUnknownMailThread, THREAD_ID } from "./helpers/mail-fixtures";
import { readLocalEnvValue } from "./helpers/local-supabase-admin";

const FIRST_UNKNOWN_THREAD = "84000000-0000-4000-8000-000000000001";
const SECOND_UNKNOWN_THREAD = "84000001-0000-4000-8000-000000000002";

test.beforeEach(async () => { await resetIntegratedMailFixture(); });

async function loginAdministrator(page: Page) {
  const account = getRegressionAccount("administrator");
  await setTestLocale(page, "zh");
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('input[name="email"]')).toHaveCount(0, { timeout: 30_000 });
  const acknowledge = page.getByRole("button", { name: "我知道了" });
  if (await acknowledge.isVisible().catch(() => false)) await acknowledge.click();
}

async function callMaintenance(page: Page, data: Record<string, string>) {
  const taskSecret = readLocalEnvValue("MAIL_TASK_SECRET");
  if (!taskSecret) throw new Error("本地邮件后台任务密钥未配置。");
  return page.request.post("/api/mail/tasks/recipient-maintenance", {
    headers: { authorization: `Bearer ${taskSecret}` },
    data,
  });
}

test("历史回填后只删除陌生会话，并对部分失败给出最终凭证", async ({ page }) => {
  await seedUnknownMailThread({
    threadId: FIRST_UNKNOWN_THREAD,
    messageId: "85000000-0000-4000-8000-000000000001",
    providerThreadId: "unknown-history-first",
  });
  await seedUnknownMailThread({
    threadId: SECOND_UNKNOWN_THREAD,
    messageId: "85000001-0000-4000-8000-000000000002",
    providerThreadId: "unknown-history-second",
    blockDeletion: true,
  });

  await loginAdministrator(page);
  await page.goto("/admin/mail");
  await expect(page.getByText("Unknown historical message").first()).toBeVisible();
  const denied = await page.request.post("/api/mail/tasks/recipient-maintenance", { data: { action: "prepare" } });
  expect(denied.status()).toBe(401);

  const preparedResponse = await callMaintenance(page, { action: "prepare" });
  expect(preparedResponse.ok()).toBe(true);
  const prepared = await preparedResponse.json() as {
    status: string;
    backfill: { scannedMessages: number; recipientRows: number };
    preview: { candidateThreadIds: string[]; candidateCount: number; confirmationToken: string };
  };
  expect(prepared.status).toBe("prepared");
  expect(prepared.backfill.scannedMessages).toBeGreaterThanOrEqual(1);
  expect(prepared.preview.candidateThreadIds).toEqual([FIRST_UNKNOWN_THREAD, SECOND_UNKNOWN_THREAD]);
  expect(prepared.preview.candidateThreadIds).not.toContain(THREAD_ID);

  const staleResponse = await callMaintenance(page, { action: "purge", confirmationToken: "wrong-preview" });
  expect(staleResponse.status()).toBe(500);
  const { count: unchangedCount } = await getMailAdmin().from("mail_threads")
    .select("id", { count: "exact", head: true }).in("id", [FIRST_UNKNOWN_THREAD, SECOND_UNKNOWN_THREAD]);
  expect(unchangedCount).toBe(2);

  const purgeResponse = await callMaintenance(page, {
    action: "purge",
    confirmationToken: prepared.preview.confirmationToken,
  });
  expect(purgeResponse.ok()).toBe(true);
  const purge = await purgeResponse.json() as {
    status: string;
    deleted: Array<{ threadId: string; auditId: number }>;
    failed: Array<{ threadId: string; error: string }>;
  };
  expect(purge.status).toBe("partial_failed");
  expect(purge.deleted.map((item) => item.threadId)).toEqual([FIRST_UNKNOWN_THREAD]);
  expect(purge.failed.map((item) => item.threadId)).toEqual([SECOND_UNKNOWN_THREAD]);

  const { data: survivingThreads } = await getMailAdmin().from("mail_threads")
    .select("id").in("id", [THREAD_ID, FIRST_UNKNOWN_THREAD, SECOND_UNKNOWN_THREAD]).order("id");
  expect(survivingThreads?.map((thread) => thread.id)).toEqual([THREAD_ID, SECOND_UNKNOWN_THREAD]);
  const { data: audit } = await getMailAdmin().from("mail_audit_events")
    .select("id,event_type,details").eq("entity_id", FIRST_UNKNOWN_THREAD).single();
  expect(audit?.event_type).toBe("mail_unknown_thread_deleted");
  expect(JSON.stringify(audit)).not.toContain("This content must be deleted locally");
  await page.reload();
  await expect(page.getByText("Unknown historical message")).toHaveCount(1);
});
