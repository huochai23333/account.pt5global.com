import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { Page } from "@playwright/test";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { parseEnvironment } from "../../scripts/learning/doctor-checks.mjs";
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const origin = "http://localhost:3000";
const copy = zh.MailWorkspace;
const { createBlindIndex, encryptMailValue } = createRequire(import.meta.url)("../../lib/mail/mail-security.ts") as
  typeof import("../../lib/mail/mail-security");

async function openInbox(page: Page, reload = false) {
  // 等客户端开始读取人员资料，再操作首屏按钮，避免点击尚未水合的 HTML。
  await Promise.all([
    page.waitForResponse((response) => response.url() === `${origin}/api/mail/agents` && response.ok()),
    reload ? page.reload() : page.goto("/admin/mail"),
  ]);
}

test("批量隔离必须核对同一组会话和版本，恢复后刷新一致", async ({ page, learningUser, learningStaff, browser }, testInfo) => {
  test.setTimeout(100_000);
  const env = parseEnvironment(await readFile(".env.local", "utf8")) as Record<string, string>;
  const encrypt = (value: string) => `'${encryptMailValue(value, env.MAIL_CONTENT_ENCRYPTION_KEY)}'`;
  const cases = Array.from({ length: 2 }, () => {
    const id = randomUUID();
    return { id, subject: `Learning quarantine ${id}`, messageId: randomUUID(), ref: `L-${id.toUpperCase()}`, address: `${id}@example.invalid` };
  });
  const [known, unknown] = cases;
  const ids = cases.map(({ id }) => `'${id}'`).join(",");
  const providers = cases.map(({ id }) => `'learning-${id}'`).join(",");
  const hash = (address: string) => createBlindIndex(address, env.MAIL_EMAIL_HASH_SECRET);
  // 页面可能给未初始化的员工生成发件配置，只允许本次两个专属账号走这一步。
  expect(executeLearningSql(`select count(*) from public.user_profiles p
    where p.status='active' and p.user_id not in ('${learningUser.id}','${learningStaff.id}')
    and exists(select 1 from public.user_roles_data d join public.user_roles r on r.id=d.role_id
      where d.user_id=p.user_id and r.role in ('administrator','salesman'))
    and not exists(select 1 from public.mail_agent_profiles m where m.user_id=p.user_id);`)).toBe("0");
  expect(executeLearningSql("select count(*) from public.mail_shared_mailboxes;")).toBe("1");
  const snapshot = () => JSON.parse(executeLearningSql(`select json_build_object(
    'threads', (select coalesce(json_agg(t order by id),'[]') from
      (select id,version,intake_status,assigned_user_id,ref_code from public.mail_threads where id in (${ids})) t),
    'events', (select coalesce(json_agg(a order by id),'[]') from
      (select id,entity_id,event_type,actor_user_id,details->>'version' as version
        from public.mail_audit_events where entity_id in (${ids})) a),
    'notifications', (select count(*) from public.mail_notifications where message_id in ('${known.messageId}','${unknown.messageId}'))
  );`));

  executeLearningSql(`begin;
    ${cases.map((item) => `insert into public.mail_threads
      (id,mailbox_id,provider_thread_id,subject_enc,customer_email_enc,customer_email_hash,assigned_user_id,ref_code,routing_source,last_message_at,last_inbound_at)
      select '${item.id}',id,'learning-${item.id}',${encrypt(item.subject)},${encrypt(item.address)},'${hash(item.address)}',
        '${learningStaff.id}','${item.ref}','manual',now(),now() from public.mail_shared_mailboxes;
      insert into public.mail_messages(id,mailbox_id,thread_id,provider_message_id,direction,from_enc,to_enc,cc_enc,bcc_enc,
        subject_enc,text_body_enc,html_body_enc,raw_headers_enc,occurred_at)
      select '${item.messageId}',mailbox_id,id,provider_thread_id || '-inbound','inbound',customer_email_enc,
        ${encrypt("[]")},${encrypt("[]")},${encrypt("[]")},subject_enc,${encrypt("Learning mail body")},
        ${encrypt("")},${encrypt("{}")},last_inbound_at from public.mail_threads where id='${item.id}';`).join("\n")}
    insert into public.mail_outbound_recipients(mailbox_id,thread_id,actor_user_id,email_hash,recipient_kind,occurred_at)
      select mailbox_id,id,'${learningStaff.id}',customer_email_hash,'to',now() from public.mail_threads where id='${known.id}';
    commit;`);
  try {
    const before = snapshot();
    expect(before.threads).toHaveLength(2);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.context().addCookies([{ name: "bs-locale", value: "zh", url: origin }]);
    await loginLearningUser(page, learningUser);
    const announcement = page.getByRole("dialog", { name: zh.DashboardShell.announcements.newTitle, exact: true });
    await page.addLocatorHandler(announcement, () =>
      announcement.getByRole("button", { name: zh.DashboardShell.announcements.acknowledge, exact: true }).click(),
    );
    await openInbox(page);
    await page.getByRole("button", { name: copy.intakeRules, exact: true }).click();
    await expect(page.getByTestId("mail-intake-rules-panel")).toBeVisible();
    await page.getByRole("button", { name: copy.workspaceInbox, exact: true }).click();
    for (const item of cases) await page.getByLabel(copy.selectThread.replace("{subject}", item.subject)).check();
    const move = page.getByRole("button", { name: copy.quarantineSelected.replace("{count}", "2"), exact: true });
    const endpoint = "**/api/mail/quarantine";
    await page.route(endpoint, (route) => route.fulfill({ status: 200, json: {
      status: "completed", updated: [{ threadId: known.id, version: 2 }, { threadId: randomUUID(), version: 2 }], failed: [], ruleId: null,
    } }), { times: 1 });
    await move.click();
    await expect(page.getByText("部分邮件没有确认移入隔离区。", { exact: true })).toBeVisible();
    expect(snapshot()).toEqual(before);
    for (const item of cases) await expect(page.getByTestId(`mail-thread-${item.id}`)).toBeVisible();

    let submissions = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url() === `${origin}/api/mail/quarantine`) submissions += 1;
    });
    await move.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(page.getByText("邮件已移入隔离区，Gmail 原件仍然保留。", { exact: true })).toBeVisible();
    expect(submissions).toBe(1);
    const quarantined = snapshot();
    expect(quarantined.threads).toEqual(before.threads.map((item: object) => ({ ...item, intake_status: "quarantined", version: 2 })));
    expect(quarantined.events).toHaveLength(2);
    expect(quarantined.events).toEqual(expect.arrayContaining(cases.map(({ id }) => expect.objectContaining({
      entity_id: id, version: "2", actor_user_id: learningUser.id, event_type: "mail_thread_quarantined",
    }))));
    expect(quarantined.notifications).toBe(0);
    const stale = await page.request.post("/api/mail/quarantine", { data: {
      threads: cases.map(({ id }) => ({ threadId: id, expectedVersion: 1 })), reason: "Learning repeat",
    } });
    expect(stale.ok()).toBe(false);
    expect(snapshot()).toEqual(quarantined);
    await openInbox(page, true);
    for (const item of cases) await expect(page.getByTestId(`mail-thread-${item.id}`)).toHaveCount(0);
    await page.getByRole("button", { name: new RegExp(`^${copy.quarantine} \\d+$`) }).click();
    const panel = page.getByTestId("mail-quarantine-panel");
    await panel.getByRole("button", { name: new RegExp(unknown.subject) }).click();
    const restore = panel.getByRole("button", { name: copy.restoreToWorkspace, exact: true });
    await restore.click();
    await expect(page.getByText("该发件邮箱不在系统已联系名单中，不能恢复到工作台。", { exact: true })).toBeVisible();
    expect(snapshot()).toEqual(quarantined);
    await panel.getByRole("button", { name: new RegExp(known.subject) }).click();
    await restore.click();
    await expect(page.getByText("邮件已恢复到工作台。", { exact: true })).toBeVisible();
    const restored = snapshot();
    expect(restored.threads.find((row: { id: string }) => row.id === known.id)).toMatchObject({
      version: 3, intake_status: "active", assigned_user_id: learningStaff.id, ref_code: known.ref,
    });
    expect(restored.events).toEqual([...quarantined.events, expect.objectContaining({
      entity_id: known.id, version: "3", actor_user_id: learningUser.id, event_type: "mail_thread_restored",
    })]);
    expect(restored.notifications).toBe(0);
    await openInbox(page, true);
    await expect(page.getByTestId(`mail-thread-${known.id}`)).toBeVisible();
    await expect(page.getByTestId(`mail-thread-${unknown.id}`)).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("mail-quarantine-zh-1440.png"), animations: "disabled" });

    const staff = await browser.newPage({ viewport: { width: 390, height: 900 } });
    try {
      await loginLearningUser(staff, learningStaff);
      await staff.context().addCookies([{ name: "bs-locale", value: "en", url: origin }]);
      const staffAnnouncement = staff.getByRole("dialog", { name: en.DashboardShell.announcements.newTitle, exact: true });
      await staff.addLocatorHandler(staffAnnouncement, () =>
        staffAnnouncement.getByRole("button", { name: en.DashboardShell.announcements.acknowledge, exact: true }).click(),
      );
      await Promise.all([
        staff.waitForResponse((response) => response.url() === `${origin}/api/mail/assignable-agents` && response.ok()),
        staff.goto(`${origin}/salesman/mail`),
      ]);
      await expect(staff.getByRole("heading", { name: en.MailWorkspace.title, exact: true })).toBeVisible();
      await staff.getByTestId(`mail-thread-${known.id}`).click();
      await expect(staff.getByRole("heading", { name: known.subject, exact: true })).toBeVisible();
      await expect(staffAnnouncement).toHaveCount(0);
      await expect(staff.getByTestId(`mail-thread-${unknown.id}`)).toHaveCount(0);
      const denied = await staff.request.patch(`${origin}/api/mail/quarantine/${unknown.id}`, { data: { expectedVersion: 2 } });
      expect(denied.ok()).toBe(false);
      expect(await staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await staff.screenshot({ path: testInfo.outputPath("mail-quarantine-en-390.png"), animations: "disabled" });
    } finally {
      await staff.close();
    }
    expect(snapshot()).toEqual(restored);
    expect(errors).toEqual([]);
    await writeFile(testInfo.outputPath("mail-quarantine-receipt.json"), JSON.stringify({ before, quarantined, restored }, null, 2));
  } finally {
    // 删除会话前清理不会级联的历史索引和审计；条件只覆盖本次生成的两个编号。
    executeLearningSql(`begin;
      delete from public.mail_outbound_recipients where thread_id in (${ids}) and actor_user_id='${learningStaff.id}';
      delete from public.mail_audit_events where entity_id in (${ids}) and actor_user_id='${learningUser.id}';
      delete from public.mail_threads where id in (${ids}) and provider_thread_id in (${providers});
      commit;`);
    expect(snapshot()).toEqual({ threads: [], events: [], notifications: 0 });
  }
});
