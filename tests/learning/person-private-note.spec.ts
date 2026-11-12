import { writeFile } from "node:fs/promises";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const origin = "http://localhost:3000";
const noteEndpoint = "**/api/people/note";

function readNote(ownerId: string, targetId: string) {
  return JSON.parse(executeLearningSql(`select coalesce(json_agg(row), '[]') from (
    select owner_user_id, target_user_id, note, updated_at, xmin::text as row_version
    from public.person_private_notes where owner_user_id='${ownerId}' and target_user_id='${targetId}'
  ) row;`));
}

test.use({ learningStaffRole: "administrator" });

for (const [locale, width, copy] of [["zh", 1440, zh], ["en", 390, en]] as const) {
  test(`账号私有备注核对保存、异常回执与清空 ${locale}/${width}`, async ({ page, browser, learningUser, learningStaff }, testInfo) => {
    const ownerId = learningUser.id;
    const targetId = learningStaff.id;
    const original = `Private learning note ${learningUser.runId}`;
    const replacement = "Learning note with changed content";
    const text = copy.PersonPrivateNotes;
    const errors: string[] = [];
    let noteRequests = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/people/note") noteRequests += 1;
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
    await expect(page.getByRole("heading", { name: copy.AdminPeople.header.title, exact: true })).toBeVisible();

    const search = page.getByPlaceholder(copy.AdminPeople.filters.searchPlaceholder);
    const dialog = page.getByRole("dialog").filter({ has: page.getByPlaceholder(text.dialog.placeholder) });
    const input = dialog.getByPlaceholder(text.dialog.placeholder);
    const save = dialog.getByRole("button", { name: text.actions.save, exact: true });
    const openNote = async () => {
      await search.fill(learningStaff.email);
      await page.getByRole("button", { name: copy.AdminPeople.actions.note, exact: true }).filter({ visible: true }).click();
      await expect(input).toBeVisible();
    };

    try {
      await openNote();
      await expect(save).toBeDisabled();
      await input.fill(original);
      // 两次提交发生在同一轮事件内，按钮状态还来不及随 React 重绘。
      await save.evaluate((element: HTMLButtonElement) => { element.click(); element.click(); });
      await expect(page.getByText(text.feedback.saved, { exact: true })).toBeVisible();
      expect(noteRequests).toBe(1);
      const saved = readNote(ownerId, targetId);
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ owner_user_id: ownerId, target_user_id: targetId, note: original });
      expect(saved[0].updated_at).toEqual(expect.any(String));

      await page.reload();
      await openNote();
      await expect(input).toHaveValue(original);
      // 请求从真实页面发出，只损坏备注字段，实际路由必须保留已保存的行。
      let malformedStatus: number | undefined;
      await page.route(noteEndpoint, async (route) => {
        const response = await route.fetch({ postData: { targetUserId: targetId, note: { invalid: true } } });
        malformedStatus = response.status();
        await route.fulfill({ response });
      }, { times: 1 });
      await input.fill(replacement);
      await save.click();
      await expect.poll(() => malformedStatus).toBeDefined();
      expect(readNote(ownerId, targetId)).toEqual(saved);
      expect(malformedStatus).toBe(400);
      await expect(page.getByText(text.errors.invalidInput, { exact: true })).toBeVisible();
      await expect(input).toHaveValue(replacement);

      // HTTP 200 携带另一账号的凭证时，页面应保留草稿，不能报保存或清空成功。
      await page.route(noteEndpoint, (route) => route.fulfill({
        json: { targetUserId: ownerId, note: replacement, updatedAt: saved[0].updated_at },
      }), { times: 1 });
      await save.click();
      await expect(page.getByText(text.errors.unknown, { exact: true })).toBeVisible();
      await expect(input).toHaveValue(replacement);
      expect(readNote(ownerId, targetId)).toEqual(saved);

      // 另一个管理员登录并打开同一档案，看到的仍是自己的空备注。
      const other = await browser.newPage();
      try {
        await other.context().addCookies([{ name: "bs-locale", value: "zh", url: origin }]);
        await loginLearningUser(other, learningStaff);
        await other.goto(`${origin}/admin/accounts`);
        await expect(other.getByRole("heading", { name: zh.AdminPeople.header.title, exact: true })).toBeVisible();
        await other.getByPlaceholder(zh.AdminPeople.filters.searchPlaceholder).fill(learningStaff.email);
        await other.getByRole("button", { name: zh.AdminPeople.actions.note, exact: true }).filter({ visible: true }).click();
        await expect(other.getByPlaceholder(zh.PersonPrivateNotes.dialog.placeholder)).toHaveValue("");
        await expect(other.getByText(original, { exact: true })).toHaveCount(0);
      } finally {
        await other.close();
      }

      await expect(dialog).toHaveCSS("opacity", "1");
      expect(await dialog.evaluate((element) => element.getBoundingClientRect().width <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("note-editor.png") });
      await input.fill("");
      await save.click();
      await expect(page.getByText(text.feedback.cleared, { exact: true })).toBeVisible();
      expect(readNote(ownerId, targetId)).toEqual([]);
      await page.reload();
      await openNote();
      await expect(input).toHaveValue("");
      await expect(save).toBeDisabled();
      expect(errors).toEqual([]);
      await writeFile(testInfo.outputPath("note-receipt.json"), JSON.stringify({ saved, malformedStatus, afterClear: [] }, null, 2));
    } finally {
      // 只清理本用例的一对账号，先于账号夹具的自动级联删除。
      executeLearningSql(`delete from public.person_private_notes where owner_user_id='${ownerId}' and target_user_id='${targetId}';`);
      expect(readNote(ownerId, targetId)).toEqual([]);
    }
  });
}
