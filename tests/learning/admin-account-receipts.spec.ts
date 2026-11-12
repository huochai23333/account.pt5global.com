import { writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const origin = "http://localhost:3000";
const savePath = "/api/admin/people/account";

function readAccount(targetId: string) {
  // 通过 Docker 直接读取应用账号、Auth、补偿状态和审计，独立于页面保存响应。
  return JSON.parse(executeLearningSql(`select json_build_object(
    'role', (select role.role from public.user_roles_data data join public.user_roles role on role.id=data.role_id where data.user_id='${targetId}'),
    'profile', (select json_build_object('status', status, 'city', city, 'version', xmin::text) from public.user_profiles where user_id='${targetId}'),
    'auth', (select json_build_object('role', raw_app_meta_data->>'role', 'status', raw_app_meta_data->>'status') from auth.users where id='${targetId}'),
    'sync', (select json_build_object('status', sync_status, 'role', desired_role, 'accountStatus', desired_status, 'syncedAt', synced_at) from public.admin_auth_metadata_sync where user_id='${targetId}'),
    'logs', (select coalesce(json_agg(log order by created_at), '[]') from (
      select id, actor_user_id, target_user_id, previous_role, next_role, next_status, next_city, note, created_at
      from public.admin_user_account_change_logs where target_user_id='${targetId}'
    ) log)
  );`));
}

async function openAccount(page: Page, copy: typeof en.AdminPeople, email: string) {
  await expect(page.getByRole("heading", { name: copy.header.title, exact: true })).toBeVisible();
  await page.getByPlaceholder(copy.filters.searchPlaceholder).fill(email);
  await page.getByRole("button", { name: copy.actions.adjust, exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog").filter({ has: page.getByPlaceholder(copy.dialog.cityPlaceholder) });
  await expect(dialog).toBeVisible();
  return dialog;
}

for (const [locale, width, copy] of [["zh", 1440, zh.AdminPeople], ["en", 390, en.AdminPeople]] as const) {
  test(`账号调整验证回执、冲突和登录信息恢复 ${locale}/${width}`, async ({ page, browser, learningUser, learningStaff }, testInfo) => {
    test.setTimeout(100_000);
    const targetId = learningStaff.id;
    const city = `Learning City ${width}`;
    const reason = `Learning account update ${learningUser.runId}`;
    const errors: string[] = [];
    let saveRequests = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === savePath) saveRequests += 1;
    });
    await page.setViewportSize({ width, height: 900 });
    await page.context().addCookies([{ name: "bs-locale", value: locale, url: origin }]);
    if (locale === "en") {
      await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
        await page.keyboard.press("Escape");
      });
    }
    await loginLearningUser(page, learningUser);
    await page.goto("/admin/accounts");
    const dialog = await openAccount(page, copy, learningStaff.email);
    const save = dialog.getByRole("button", { name: copy.actions.save, exact: true });
    const role = dialog.getByRole("combobox", { name: copy.dialog.nextRole });
    await role.click();
    await page.getByRole("option", { name: copy.roles.finance, exact: true }).click();
    await dialog.getByPlaceholder(copy.dialog.cityPlaceholder).fill(city);
    await dialog.getByPlaceholder(copy.dialog.notePlaceholder).fill(reason);
    const before = readAccount(targetId);
    expect(before).toMatchObject({ role: "salesman", auth: { role: "salesman" }, logs: [] });

    try {
      // 只伪造回执，不写任何记录。成功提示必须核对本次选中人。
      await page.route(`**${savePath}`, (route) => route.fulfill({ json: {
        outcome: "success",
        person: { user_id: learningUser.id, role: "finance", status: "active", city, created_at: new Date().toISOString(), customer_type: null },
      } }), { times: 1 });
      await save.click();
      await expect(page.getByText(copy.errors.unknown, { exact: true })).toBeVisible();
      await expect(dialog.getByPlaceholder(copy.dialog.cityPlaceholder)).toHaveValue(city);
      expect(readAccount(targetId)).toEqual(before);

      const stalePage = await page.context().newPage();
      try {
        await stalePage.goto(`${origin}/admin/accounts`);
        const staleDialog = await openAccount(stalePage, copy, learningStaff.email);
        await staleDialog.getByPlaceholder(copy.dialog.cityPlaceholder).fill("Stale learning draft");

        await expect(dialog).toHaveCSS("opacity", "1");
        expect(await dialog.evaluate((element) => element.getBoundingClientRect().width <= innerWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath("account-draft.png") });
        await save.evaluate((element: HTMLButtonElement) => { element.click(); element.click(); });
        await expect(page.getByText(copy.feedback.saved, { exact: true })).toBeVisible();
        expect(saveRequests).toBe(2);
        const committed = readAccount(targetId);
        expect(committed).toMatchObject({
          role: "finance", profile: { status: "active", city }, auth: { role: "finance", status: "active" },
          sync: { status: "synced", role: "finance", accountStatus: "active", syncedAt: expect.any(String) },
          logs: [{ id: expect.any(String), target_user_id: targetId, actor_user_id: learningUser.id, previous_role: "salesman", next_role: "finance", next_status: "active", next_city: city, note: reason }],
        });
        expect(committed.profile.version).not.toBe(before.profile.version);

        await staleDialog.getByRole("button", { name: copy.actions.save, exact: true }).click();
        await expect(stalePage.getByText(copy.errors.conflict, { exact: true })).toBeVisible();
        expect(readAccount(targetId)).toEqual(committed);

        // 只在专属测试账号制造 Auth 偏差，实际目录协调与重试恢复原权威结果。
        const drift = await learningStaff.client.auth.admin.updateUserById(targetId, { app_metadata: { role: "salesman" } });
        expect(drift.error).toBeNull();
        await page.reload();
        const reloaded = await openAccount(page, copy, learningStaff.email);
        await expect(reloaded.getByRole("combobox", { name: copy.dialog.nextRole })).toHaveText(copy.roles.finance);
        expect(readAccount(targetId)).toMatchObject({ auth: { role: "salesman" }, sync: { status: "pending" } });
        await reloaded.getByRole("button", { name: copy.dialog.retryAuthSync, exact: true }).click();
        await expect(page.getByText(copy.feedback.authSyncComplete, { exact: true })).toBeVisible();
        const restored = readAccount(targetId);
        expect(restored).toMatchObject({ role: "finance", profile: committed.profile, auth: committed.auth, logs: committed.logs, sync: { status: "synced", role: "finance", syncedAt: expect.any(String) } });

        await page.reload();
        const finalDialog = await openAccount(page, copy, learningStaff.email);
        await expect(finalDialog.getByPlaceholder(copy.dialog.cityPlaceholder)).toHaveValue(city);
        await expect(finalDialog.getByRole("button", { name: copy.dialog.retryAuthSync, exact: true })).toHaveCount(0);
        const staffPage = await browser.newPage();
        try {
          await staffPage.context().addCookies([{ name: "bs-locale", value: "zh", url: origin }]);
          await loginLearningUser(staffPage, learningStaff, /\/finance\/home/);
        } finally {
          await staffPage.close();
        }
        expect(readAccount(targetId)).toEqual(restored);
        expect(errors).toEqual([]);
        await writeFile(testInfo.outputPath("account-receipts.json"), JSON.stringify({ before, committed, restored }, null, 2));
      } finally {
        await stalePage.close();
      }
    } finally {
      // 固定目标是本次新建账号；删除只覆盖本例审计和补偿记录，账号夹具随后清理身份。
      executeLearningSql(`delete from public.admin_user_account_change_logs where actor_user_id='${learningUser.id}' and target_user_id='${targetId}';`);
      executeLearningSql(`delete from public.admin_auth_metadata_sync where user_id='${targetId}';`);
      expect(readAccount(targetId)).toMatchObject({ logs: [], sync: null });
    }
  });
}
