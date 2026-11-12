import { test, expect } from "./fixtures";
import { writeFile } from "node:fs/promises";
import {
  executeLearningSql,
  loginLearningUser,
} from "../../scripts/learning/local-fixture-session.mjs";
import zh from "../../messages/zh.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };

for (const [language, width] of [
  ["zh", 1440],
  ["en", 390],
] as const) {
  test(`首页待办写入、失败恢复与刷新：${language}/${width}`, async ({
    page,
    context,
    learningUser,
  }, testInfo) => {
    test.setTimeout(100_000);
    const copy = (language === "zh" ? zh : en).DashboardHome.todos;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const readTodos = () =>
      JSON.parse(
        executeLearningSql(`select coalesce(json_agg(t),'[]') from (
      select id,user_id,title,notes,due_date,is_important,is_completed,created_at,updated_at
      from public.user_todo_items where user_id='${learningUser.id}') t;`),
      );
    try {
      await context.addCookies([
        { name: "bs-locale", value: "zh", url: "http://localhost:3000" },
      ]);
      await loginLearningUser(page, learningUser);
      await context.addCookies([
        { name: "bs-locale", value: language, url: "http://localhost:3000" },
      ]);
      await page.setViewportSize({ width, height: 1000 });
      await page.reload();
      const section = page.getByTestId("home-todos-section");
      const add = section.getByTestId("home-todo-add-button");
      await add.click();
      await expect(
        section.getByText(copy.validation.titleRequired, { exact: true }),
      ).toBeVisible();
      expect(readTodos()).toHaveLength(0);
      const title = `Learning ${learningUser.runId}`;
      const editedTitle = `Verified ${learningUser.runId}`;
      await section.getByTestId("home-todo-title-input").fill(title);
      await add.click();
      await expect.poll(() => readTodos().length).toBe(1);
      const created = readTodos()[0];
      expect(created).toMatchObject({
        user_id: learningUser.id,
        title,
        is_completed: false,
        is_important: false,
      });
      const row = (value: string) =>
        section.getByTestId("home-todo-item").filter({ hasText: value });
      await row(title).getByTestId("home-todo-edit-button").click();
      const dateInput = page.getByTestId("home-todo-dialog-due-date");
      const calendar = page.locator('[data-slot="date-picker-popup"]');
      // 浮层从表单中打开，但由 Portal 放到外部。一次 Escape 只应关闭最内层控件。
      await dateInput.press("Alt+ArrowDown");
      await expect(calendar).toBeVisible();
      await calendar.locator('[data-slot="select"]').first().click();
      await expect(page.locator('[data-slot="select-popup"]')).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator('[data-slot="select-popup"]')).toBeHidden();
      await expect(calendar).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(calendar).toBeHidden();
      await expect(dateInput).toBeFocused();
      // 用闰日检查本地化输入与数据库规范值的转换，不依赖执行当天。
      await dateInput.fill(language === "zh" ? "2028/02/29" : "02/29/2028");
      await dateInput.press("Enter");
      await expect(dateInput).toHaveAttribute("data-value", "2028-02-29");
      await page.getByTestId("home-todo-dialog-title").fill(editedTitle);
      await page.getByTestId("home-todo-dialog-notes").fill("owned test note");

      // 先模拟零影响返回，真实记录必须原样保留；解除模拟后从同一弹窗重试写入。
      const updateRoute = "**/rest/v1/rpc/update_user_todo";
      await page.route(updateRoute, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "[]",
        }),
      );
      await page.getByTestId("home-todo-dialog-save").click();
      await expect(
        page
          .getByRole("dialog")
          .getByText(copy.errors.unknown, { exact: true }),
      ).toBeVisible();
      expect(readTodos()).toEqual([created]);
      await page.unroute(updateRoute);
      await page.getByTestId("home-todo-dialog-save").click();
      await expect.poll(() => readTodos()[0]?.title).toBe(editedTitle);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(readTodos()[0]).toMatchObject({
        id: created.id,
        notes: "owned test note",
        due_date: "2028-02-29",
      });
      await row(editedTitle).getByTestId("home-todo-important-button").click();
      await expect.poll(() => readTodos()[0]?.is_important).toBe(true);
      await row(editedTitle).getByTestId("home-todo-complete-button").click();
      await expect.poll(() => readTodos()[0]?.is_completed).toBe(true);
      const updated = readTodos()[0];
      expect(updated.id).toBe(created.id);
      expect(Date.parse(updated.updated_at)).toBeGreaterThan(
        Date.parse(created.updated_at),
      );
      expect(readTodos()).toHaveLength(1);
      await page.reload();
      await expect(row(editedTitle)).toHaveCount(0);
      await section.getByTestId("home-todo-filter-completed").click();
      await expect(row(editedTitle)).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`todo-${language}-${width}.png`),
        fullPage: true,
      });
      await row(editedTitle).getByTestId("home-todo-delete-button").click();
      await page.getByTestId("home-todo-delete-dialog-confirm").click();
      await expect.poll(() => readTodos().length).toBe(0);
      await page.reload();
      await section.getByTestId("home-todo-filter-all").click();
      await expect(row(editedTitle)).toHaveCount(0);
      expect(errors).toEqual([]);
      await writeFile(
        testInfo.outputPath("todo-business-receipts.json"),
        JSON.stringify(
          {
            created,
            updated,
            zeroImpactPreservedRow: true,
            finalRows: 0,
            reloadConsistent: true,
          },
          null,
          2,
        ),
      );
    } finally {
      // 夹具账号从空待办开始；失败后只清理这个账号的记录，再由外层夹具删除账号。
      executeLearningSql(
        `delete from public.user_todo_items where user_id='${learningUser.id}';`,
      );
      expect(readTodos()).toHaveLength(0);
    }
  });
}
