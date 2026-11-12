import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { Page } from "@playwright/test";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { parseEnvironment } from "../../scripts/learning/doctor-checks.mjs";
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";
import { verifyReplyDraftScope } from "./mail-reply-draft-verification";
import { reloadAdminMail, verifyTransferVisibility } from "./mail-transfer-verification";

const origin = "http://localhost:3000";
const copy = zh.MailWorkspace;
const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;
const { createBlindIndex, encryptMailValue } = createRequire(import.meta.url)("../../lib/mail/mail-security.ts") as typeof import("../../lib/mail/mail-security");

async function delayThreadResponse(page: Page, endpoint: string) {
  const gate = Promise.withResolvers<void>();
  const captured = Promise.withResolvers<void>();
  const delivered = Promise.withResolvers<void>();
  await page.route(endpoint, async (route) => {
    try {
      const response = await route.fetch({ maxRetries: 0 });
      expect(response.ok()).toBe(true);
      captured.resolve();
      await gate.promise;
      // 页面切换可以取消浏览器读取，即使服务端已经返回内容。
      await route.fulfill({ response }).catch(() => undefined);
    } finally {
      delivered.resolve();
    }
  }, { times: 1 });
  return {
    captured: captured.promise,
    release: gate.resolve,
    async settle() {
      await delivered.promise;
      await page.evaluate(() => new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ));
    },
  };
}

test("邮件状态与转交按同一会话、目标和版本确认", async ({ page, browser, learningUser, learningStaff, learningNextStaff }, testInfo) => {
  test.setTimeout(120_000);
  const env = parseEnvironment(await readFile(".env.local", "utf8")) as Record<string, string | undefined>;
  const contentKey = env.MAIL_CONTENT_ENCRYPTION_KEY ?? "";
  const hashSecret = env.MAIL_EMAIL_HASH_SECRET ?? "";
  if (!/^[a-f0-9]{64}$/i.test(contentKey) || hashSecret.length < 32) {
    throw new Error("本地邮件测试缺少有效的密文或索引配置。");
  }
  const threadId = randomUUID();
  const subject = `Learning mail ${threadId}`;
  const address = `${threadId}@example.invalid`;
  const providerId = `learning-${threadId}`;
  const alternateId = randomUUID();
  const alternateSubject = `Learning alternate ${alternateId}`;
  const alternateProviderId = `learning-${alternateId}`;
  const messages = [randomUUID(), randomUUID()];
  const staffName = `学习验收 ${learningStaff.runId}`;
  const endpoint = `**/api/mail/threads/${threadId}`;
  const encrypt = (value: string) => sqlString(encryptMailValue(value, contentKey));
  const read = () => JSON.parse(executeLearningSql(`select json_build_object(
    'thread',(select row_to_json(t) from (select id,state,assigned_user_id,version from public.mail_threads where id='${threadId}' and provider_thread_id='${providerId}') t),
    'assignments',(select coalesce(json_agg(a order by thread_version),'[]') from (
      select actor_user_id,assigned_user_id,thread_version from public.mail_assignment_events where thread_id='${threadId}'
    ) a));`));
  const readPositions = () => JSON.parse(executeLearningSql(`select coalesce(json_agg(r),'[]') from (
    select thread_id,last_read_message_id from public.mail_thread_reads
    where user_id='${learningUser.id}' and thread_id in ('${threadId}','${alternateId}')
    order by thread_id
  ) r;`));

  // 管理员首次读取人员设置会自动建档，先确认共享账号都已有发件配置。
  expect(executeLearningSql(`select count(*) from public.user_profiles p
    where p.status='active' and p.user_id not in ('${learningUser.id}', '${learningStaff.id}', '${learningNextStaff.id}')
      and exists(select 1 from public.user_roles_data d join public.user_roles r on r.id=d.role_id
        where d.user_id=p.user_id and r.role in ('administrator','salesman'))
      and not exists(select 1 from public.mail_agent_profiles m where m.user_id=p.user_id);`)).toBe("0");
  // 两条合成会话各含一封来信，复用本地邮箱编号，页面只操作本次夹具。
  executeLearningSql(`begin;
    insert into public.mail_threads
    (id,mailbox_id,provider_thread_id,subject_enc,customer_email_enc,customer_email_hash,ref_code,routing_source,last_message_at,last_inbound_at)
    select '${threadId}'::uuid,id,'${providerId}',${encrypt(subject)},${encrypt(address)},
      ${sqlString(createBlindIndex(address, hashSecret))},'L-${threadId}','unassigned',now(),now()
    from public.mail_shared_mailboxes
    union all
    select '${alternateId}'::uuid,id,'${alternateProviderId}',${encrypt(alternateSubject)},${encrypt(address)},
      ${sqlString(createBlindIndex(address, hashSecret))},'L-${alternateId}','unassigned',now(),now()
    from public.mail_shared_mailboxes;
    insert into public.mail_messages(id,mailbox_id,thread_id,provider_message_id,direction,from_enc,to_enc,cc_enc,bcc_enc,
      subject_enc,text_body_enc,html_body_enc,raw_headers_enc,occurred_at)
    select case when id='${threadId}' then '${messages[0]}'::uuid else '${messages[1]}'::uuid end, mailbox_id,id,
      provider_thread_id || '-inbound','inbound',${encrypt(address)},${encrypt("[]")},${encrypt("[]")},${encrypt("[]")},
      subject_enc,${encrypt("Local conversation for learning")},${encrypt("")},${encrypt("{}")},last_inbound_at
    from public.mail_threads where id in ('${threadId}','${alternateId}');
    commit;`);
  try {
    const initial = read();
    expect(initial).toMatchObject({ thread: { id: threadId, state: "waiting_pt5", assigned_user_id: null, version: 1 }, assignments: [] });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.context().addCookies([{ name: "bs-locale", value: "zh", url: origin }]);
    await loginLearningUser(page, learningUser);
    const announcement = page.getByRole("dialog", { name: zh.DashboardShell.announcements.newTitle, exact: true });
    await page.addLocatorHandler(announcement, () =>
      announcement.getByRole("button", { name: zh.DashboardShell.announcements.acknowledge, exact: true }).click(),
    );
    const sales = await browser.newPage({ viewport: { width: 390, height: 900 } });
    try {
      sales.on("pageerror", (error) => errors.push(error.message));
      await loginLearningUser(sales, learningStaff);
      await sales.context().addCookies([{ name: "bs-locale", value: "en", url: origin }]);
      const salesAnnouncement = sales.getByRole("dialog", { name: en.DashboardShell.announcements.newTitle, exact: true });
      const denied = await sales.request.post(`${origin}/api/mail/threads/${threadId}/state`, {
        data: { state: "closed", expectedVersion: 1 },
      });
      expect(denied.ok()).toBe(false);
      expect(read()).toEqual(initial);
      const deniedRead = await sales.request.post(`${origin}/api/mail/threads/${threadId}/read`, {
        data: { messageId: messages[0] },
      });
      expect(deniedRead.ok()).toBe(false);
      expect(executeLearningSql(`select count(*) from public.mail_thread_reads
        where thread_id='${threadId}' and user_id='${learningStaff.id}';`)).toBe("0");

      await page.goto("/admin/mail");
      const row = page.getByTestId(`mail-thread-${threadId}`);
      const alternateRow = page.getByTestId(`mail-thread-${alternateId}`);
      const alternateEndpoint = `**/api/mail/threads/${alternateId}/read`;
      let arrivingMessage = "";
      await page.route(alternateEndpoint, async (route) => {
        // 在浏览器读完旧详情后提交真实来信事务，两个消息故意使用相同供应商时间。
        arrivingMessage = executeLearningSql(`select written.message_id
          from public.mail_threads t join public.mail_messages m on m.thread_id=t.id
          cross join lateral public.commit_mail_inbound(
            to_jsonb(t) || jsonb_build_object('occurred_at',t.last_inbound_at),
            to_jsonb(m) || jsonb_build_object('provider_message_id','${alternateProviderId}-arriving'),
            '[]'::jsonb,'{}'::uuid[],null
          ) written where t.id='${alternateId}' and m.id='${messages[1]}';`);
        await route.continue();
      }, { times: 1 });
      const older = await delayThreadResponse(page, endpoint);
      try {
        await row.click();
        await older.captured;
        await alternateRow.click();
        await expect(page.getByRole("heading", { name: alternateSubject, exact: true })).toBeVisible();
        await expect.poll(readPositions).toEqual([{ thread_id: alternateId, last_read_message_id: messages[1] }]);
      } finally {
        older.release();
      }
      await older.settle();
      await expect(page.getByRole("heading", { name: alternateSubject, exact: true })).toBeVisible();
      expect(readPositions()).toEqual([{ thread_id: alternateId, last_read_message_id: messages[1] }]);
      await expect(alternateRow.locator(`[aria-label="${copy.unread}"]`)).toBeVisible();
      await page.reload();
      await expect(alternateRow.locator(`[aria-label="${copy.unread}"]`)).toBeVisible();
      const unreadPage = await page.request.post(`${origin}/api/mail/threads`, { data: { scope: "all", unread: true } });
      expect((await unreadPage.json()).threads).toEqual(expect.arrayContaining([expect.objectContaining({ id: alternateId })]));
      await alternateRow.click();
      await expect.poll(readPositions).toEqual([{ thread_id: alternateId, last_read_message_id: arrivingMessage }]);
      await expect(alternateRow.locator(`[aria-label="${copy.unread}"]`)).toHaveCount(0);
      const confirmedAt = () => executeLearningSql(`select read_at from public.mail_thread_reads
        where thread_id='${alternateId}' and user_id='${learningUser.id}';`);
      const firstConfirmation = confirmedAt();
      const replay = await page.request.post(`${origin}/api/mail/threads/${alternateId}/read`, {
        data: { messageId: messages[1] },
      });
      expect(replay.ok()).toBe(true);
      expect(await replay.json()).toEqual({ threadId: alternateId, messageId: messages[1], unread: false });
      expect(readPositions()).toEqual([{ thread_id: alternateId, last_read_message_id: arrivingMessage }]);
      expect(confirmedAt()).toBe(firstConfirmation);

      const pendingBeforeNew = await delayThreadResponse(page, endpoint);
      try {
        await row.click();
        await pendingBeforeNew.captured;
        await page.getByRole("button", { name: copy.newMail, exact: true }).click();
        await expect(page.getByTestId("mail-new-message-panel")).toBeVisible();
      } finally {
        pendingBeforeNew.release();
      }
      await pendingBeforeNew.settle();
      await expect(page.getByTestId("mail-new-message-panel")).toBeVisible();
      expect(readPositions()).toEqual([{ thread_id: alternateId, last_read_message_id: arrivingMessage }]);

      await page.route(`${endpoint}/read`, (route) => route.fulfill({
        status: 200, json: { threadId, messageId: messages[1] },
      }), { times: 1 });
      await row.click();
      await expect(page.getByText(copy.threadReadFailed, { exact: true })).toBeVisible();
      expect(readPositions()).toEqual([{ thread_id: alternateId, last_read_message_id: arrivingMessage }]);
      await expect(row.locator(`[aria-label="${copy.unread}"]`)).toBeVisible();

      await row.click();
      await expect(page.getByRole("heading", { name: subject, exact: true })).toBeVisible();
      const aiRuns = await verifyReplyDraftScope(page, learningUser.id, threadId, subject, alternateSubject);
      await page.getByRole("button", { name: copy.newMail, exact: true }).click();
      const discardSuggestion = page.getByRole("dialog", { name: copy.unsavedDraftTitle, exact: true });
      await discardSuggestion.getByRole("button", { name: zh.DashboardFramework.confirm.accept, exact: true }).click();
      await row.click();
      await expect(page.getByRole("heading", { name: subject, exact: true })).toBeVisible();
      await expect.poll(readPositions).toEqual(expect.arrayContaining([
        { thread_id: threadId, last_read_message_id: messages[0] },
        { thread_id: alternateId, last_read_message_id: arrivingMessage },
      ]));

      const positionsBeforeRestore = readPositions();
      await page.getByRole("textbox", { name: copy.body, exact: true }).fill("Learning reply draft");
      const restoringDraft = await delayThreadResponse(page, endpoint);
      try {
        page.once("dialog", (dialog) => dialog.accept());
        await page.reload({ waitUntil: "domcontentloaded" });
        await restoringDraft.captured;
        await expect(page.getByRole("textbox", { name: copy.body, exact: true })).toHaveValue("Learning reply draft");
        await page.getByRole("button", { name: copy.newMail, exact: true }).click();
        const discard = page.getByRole("dialog", { name: copy.unsavedDraftTitle, exact: true });
        await discard.getByRole("button", { name: zh.DashboardFramework.confirm.accept, exact: true }).click();
      } finally {
        restoringDraft.release();
      }
      await restoringDraft.settle();
      await expect(page.getByTestId("mail-new-message-panel")).toBeVisible();
      await expect(page.getByRole("textbox", { name: copy.body, exact: true })).toHaveValue("");
      expect(readPositions()).toEqual(positionsBeforeRestore);
      await row.click();
      await expect(page.getByRole("heading", { name: subject, exact: true })).toBeVisible();
      const closed = page.getByRole("button", { name: copy.closed, exact: true }).last();
      await page.route(`${endpoint}/state`, (route) => route.fulfill({
        status: 200, json: { threadId: randomUUID(), state: "closed", version: 2 },
      }), { times: 1 });
      await closed.click();
      await expect(page.getByText(copy.threadStateFailed, { exact: true })).toBeVisible();
      expect(read()).toEqual(initial);
      await expect(closed).toBeEnabled();

      let stateRequests = 0;
      await page.route(`${endpoint}/state`, (route) => {
        stateRequests += 1;
        return route.continue();
      }, { times: 2 });
      await closed.evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      });
      await expect(closed).toBeDisabled();
      await expect.poll(() => read().thread).toMatchObject({ id: threadId, state: "closed", version: 2 });
      await expect(page.getByText(copy.threadStateSaved, { exact: true })).toBeVisible();
      expect(stateRequests).toBe(1);
      await page.unroute(`${endpoint}/state`);
      const closedState = read();
      const stale = await page.request.post(`${origin}/api/mail/threads/${threadId}/state`, {
        data: { state: "waiting_customer", expectedVersion: 1 },
      });
      expect(stale.ok()).toBe(false);
      expect(read()).toEqual(closedState);

      const assignee = page.getByLabel(copy.assignee, { exact: true });
      await expect(assignee).toBeEnabled();
      await page.route(`${endpoint}/assign`, (route) => route.fulfill({
        status: 200, json: { threadId, assignedMemberId: randomUUID(), version: 3 },
      }), { times: 1 });
      await assignee.click();
      await page.getByRole("option", { name: staffName, exact: true }).click();
      await expect(page.getByText(copy.threadAssignFailed, { exact: true })).toBeVisible();
      expect(read()).toEqual(closedState);
      await assignee.click();
      await page.getByRole("option", { name: staffName, exact: true }).click();
      await expect(assignee).toContainText(staffName);
      const final = read();
      expect(final.thread).toEqual({ id: threadId, state: "closed", assigned_user_id: learningStaff.id, version: 3 });
      expect(final.assignments).toEqual([{
        actor_user_id: learningUser.id, assigned_user_id: learningStaff.id, thread_version: 3,
      }]);
      await page.reload();
      await row.click();
      await expect(closed).toBeDisabled();
      await expect(assignee).toContainText(staffName);
      await page.screenshot({ path: testInfo.outputPath("mail-thread-desktop.png"), animations: "disabled" });

      await sales.goto(`${origin}/salesman/mail`, { waitUntil: "networkidle" });
      // 英文公告可能在水合后才弹出，先确认公告再点击邮件，避免遮住第一次操作。
      if (await salesAnnouncement.isVisible()) {
        await salesAnnouncement.getByRole("button", { name: en.DashboardShell.announcements.acknowledge, exact: true }).click();
        await expect(salesAnnouncement).toBeHidden();
      }
      await sales.getByTestId(`mail-thread-${threadId}`).click();
      await expect(sales.getByRole("heading", { name: subject, exact: true })).toBeVisible();
      expect(await sales.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await sales.screenshot({ path: testInfo.outputPath("mail-thread-mobile.png"), animations: "disabled" });
      expect(read()).toEqual(final);
      // 数据库完成修改后切断页面回执；刷新应恢复同一版本，且无需重复发出写入。
      await page.route(`${endpoint}/state`, async (route) => {
        expect((await route.fetch({ maxRetries: 0 })).ok()).toBe(true);
        await route.abort("connectionreset");
      }, { times: 1 });
      const waiting = page.getByRole("button", { name: copy.waitingCustomer, exact: true }).last();
      await waiting.click();
      await expect(page.getByText("网络连接中断，请检查网络后重试。当前内容已保留。", { exact: true })).toBeVisible();
      const recovered = read();
      expect(recovered.thread).toMatchObject({ state: "waiting_customer", version: 4, assigned_user_id: learningStaff.id });
      expect(recovered.assignments).toEqual(final.assignments);
      await reloadAdminMail(page);
      await row.click();
      await expect(waiting).toBeDisabled();
      expect(read()).toEqual(recovered);

      const transfer = await test.step("转交后核对旧负责人页面和新负责人权限", () => verifyTransferVisibility({
        admin: page, previous: sales, browser, testInfo, threadId, subject,
        adminId: learningUser.id, nextOwner: learningNextStaff, read,
      }));
      expect(errors).toEqual([]);
      await writeFile(testInfo.outputPath("mail-thread-receipts.json"), JSON.stringify({ initial, closedState, final, recovered, transfer, readPositions: readPositions(), aiRuns }, null, 2));
    } finally {
      await sales.close();
    }
  } finally {
    executeLearningSql(`delete from public.mail_threads where (id='${threadId}' and provider_thread_id='${providerId}')
      or (id='${alternateId}' and provider_thread_id='${alternateProviderId}');`);
    expect(read()).toEqual({ thread: null, assignments: [] });
    expect(readPositions()).toEqual([]);
  }
});
