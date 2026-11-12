import { writeFile } from "node:fs/promises";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const origin = "http://localhost:3000";
const copy = en.MailWorkspace;

test("发件人设置必须确认同一人和下一版本", async ({ page, browser, learningUser, learningStaff }, testInfo) => {
  test.setTimeout(90_000);
  const read = (userId: string) => JSON.parse(executeLearningSql(`select coalesce(
    (select row_to_json(p)::text from (select user_id,alias_local_part,ref_prefix,enabled,version
      from public.mail_agent_profiles where user_id='${userId}') p), 'null');`));
  // 管理员列表会初始化缺少发件资料的人，确保这个用例只初始化两个专属账号。
  expect(executeLearningSql(`select count(*) from public.user_profiles p
    where p.status='active' and p.user_id not in ('${learningUser.id}','${learningStaff.id}')
    and exists(select 1 from public.user_roles_data d join public.user_roles r on r.id=d.role_id
      where d.user_id=p.user_id and r.role in ('administrator','salesman'))
    and not exists(select 1 from public.mail_agent_profiles m where m.user_id=p.user_id);`)).toBe("0");

  await loginLearningUser(page, learningStaff);
  await page.context().addCookies([{ name: "bs-locale", value: "en", url: origin }]);
  await page.setViewportSize({ width: 390, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const announcement = page.getByRole("dialog", { name: en.DashboardShell.announcements.newTitle, exact: true });
  await page.addLocatorHandler(announcement, () =>
    announcement.getByRole("button", { name: en.DashboardShell.announcements.acknowledge, exact: true }).click(),
  );
  async function openSettings(reload = false) {
    // 等客户端发出人员读取，随后再点设置，避免静态首屏吞掉点击。
    await Promise.all([
      page.waitForResponse((response) => response.url() === `${origin}/api/mail/assignable-agents` && response.ok()),
      reload ? page.reload() : page.goto("/salesman/mail"),
    ]);
    await page.getByRole("button", { name: copy.mySenderSettings, exact: true }).click();
  }

  await openSettings();
  const card = page.getByTestId(`mail-agent-${learningStaff.id}`);
  const alias = card.getByLabel(copy.plusAlias, { exact: true });
  const ref = card.getByLabel(copy.refPrefix, { exact: true });
  const save = card.getByRole("button", { name: copy.save, exact: true });
  const before = read(learningStaff.id);
  expect(before).toMatchObject({ user_id: learningStaff.id, enabled: true, version: 1 });
  const nextAlias = `learn.${learningStaff.runId.slice(0, 8)}`;
  const nextRef = `L${learningStaff.runId.slice(0, 8).toUpperCase()}`;
  await alias.fill(nextAlias);
  await ref.fill(nextRef);
  const endpoint = "**/api/mail/agents";
  await page.route(endpoint, (route) => route.fulfill({ status: 200, json: {
    memberId: learningStaff.id, aliasLocalPart: nextAlias, refPrefix: nextRef, version: before.version + 2, enabled: true,
  } }), { times: 1 });
  await save.click();
  await expect(page.getByText(copy.senderSaveUnconfirmed, { exact: true })).toBeVisible();
  expect(read(learningStaff.id)).toEqual(before);
  await expect(alias).toHaveValue(nextAlias);
  let submissions = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url() === `${origin}/api/mail/agents`) submissions += 1;
  });
  await save.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByText(copy.senderSaved, { exact: true })).toBeVisible();
  expect(submissions).toBe(1);
  const saved = read(learningStaff.id);
  expect(saved).toEqual({ ...before, alias_local_part: nextAlias, ref_prefix: nextRef, version: 2 });
  const stalePayload = {
    memberId: learningStaff.id, aliasLocalPart: nextAlias, refPrefix: nextRef,
    senderDisplayName: "Local sender", signatureHtml: "", enabled: false, version: 1,
  };
  const stale = await page.request.put("/api/mail/agents", { data: stalePayload });
  expect(stale.ok()).toBe(false);
  expect(read(learningStaff.id)).toEqual(saved);
  await openSettings(true);
  await expect(alias).toHaveValue(nextAlias);
  await expect(ref).toHaveValue(nextRef);
  await expect(card.getByRole("checkbox", { name: copy.enabled, exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mail-sender-en-390.png"), animations: "disabled" });

  const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await admin.context().addCookies([{ name: "bs-locale", value: "zh", url: origin }]);
    await loginLearningUser(admin, learningUser);
    const notice = admin.getByRole("dialog", { name: zh.DashboardShell.announcements.newTitle, exact: true });
    await admin.addLocatorHandler(notice, () =>
      notice.getByRole("button", { name: zh.DashboardShell.announcements.acknowledge, exact: true }).click(),
    );
    await Promise.all([
      admin.waitForResponse((response) => response.url() === `${origin}/api/mail/agents` && response.ok()),
      admin.goto(`${origin}/admin/mail`),
    ]);
    await admin.getByRole("button", { name: zh.MailWorkspace.mailSettings, exact: true }).click();
    const staffCard = admin.getByTestId(`mail-agent-${learningStaff.id}`);
    await expect(staffCard.getByLabel(zh.MailWorkspace.plusAlias, { exact: true })).toHaveValue(nextAlias);
    await expect(staffCard.getByRole("checkbox", { name: zh.MailWorkspace.enabled, exact: true })).toBeChecked();
    const adminBefore = read(learningUser.id);
    const denied = await page.request.put("/api/mail/agents", { data: {
      ...stalePayload, memberId: learningUser.id, version: adminBefore.version,
    } });
    expect(denied.ok()).toBe(false);
    expect(read(learningUser.id)).toEqual(adminBefore);
    await staffCard.scrollIntoViewIfNeeded();
    await admin.screenshot({ path: testInfo.outputPath("mail-sender-zh-1440.png"), animations: "disabled" });
  } finally {
    await admin.close();
  }
  expect(errors).toEqual([]);
  await writeFile(testInfo.outputPath("mail-sender-receipt.json"), JSON.stringify({ before, saved }, null, 2));
});
