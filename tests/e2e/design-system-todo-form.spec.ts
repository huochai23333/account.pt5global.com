import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { expectStandardFormContract } from "./helpers/design-system-governance";
import { readGovernanceTodo, removeGovernanceTodo, type GovernanceTodoRecord } from "./helpers/governance-todo-database";
import { requireDisposableFixture } from "../test-support/disposable-fixture";
import { withOwnedGovernanceTodo } from "../test-support/owned-governance-todo.mjs";

// 固定账号仍走原受限认证链。本声明是额外前提，不授权执行原套件或重置共享数据。
test.beforeAll(() => requireDisposableFixture({
  baseURL: process.env.PLAYWRIGHT_BASE_URL,
  supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  mode: process.env.PT5_E2E_FIXTURE_MODE,
}));

test.describe("设计系统治理守卫", () => {
  test("待办编辑表单共享字段契约并在失败后保留输入", async ({ page }, testInfo) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/home");
    const title = `governance-todo-${randomUUID()}`;
    const section = page.getByTestId("home-todos-section");
    const item = section.getByTestId("home-todo-item").filter({ hasText: title });
    await section.getByTestId("home-todo-filter-all").click();

    // 始终创建自己的记录，不再打开可能属于人工维护的第一条待办。
    const receipt = await withOwnedGovernanceTodo(title, {
      read: readGovernanceTodo,
      remove: removeGovernanceTodo,
      createFromPage: async () => {
        await section.getByTestId("home-todo-title-input").fill(title);
        await section.getByTestId("home-todo-add-button").click();
        await expect(item).toBeVisible();
        await expect.poll(() => readGovernanceTodo(title).length).toBe(1);
      },
    }, async (created: GovernanceTodoRecord) => {
      await page.reload();
      await section.getByTestId("home-todo-filter-all").click();
      await expect(item).toBeVisible();
      expect(readGovernanceTodo(title)).toEqual([created]);
      await item.getByTestId("home-todo-edit-button").click();
      const dialog = page.getByRole("dialog", { name: "编辑待办" });
      await expectStandardFormContract(dialog);
      const titleInput = dialog.getByLabel("待办事项");
      await titleInput.fill("");
      await dialog.getByRole("button", { name: "保存", exact: true }).click();
      await expect(dialog.locator('[data-slot="feedback-notice"][data-tone="error"]')).toBeVisible();
      await expect(titleInput).toHaveValue("");
      expect(readGovernanceTodo(title)).toEqual([created]);
      await page.keyboard.press("Escape");

      // 正常删除仍从页面发起，独立读回与刷新证明终态；失败时由外层限定回收。
      await item.getByTestId("home-todo-delete-button").click();
      await page.getByRole("dialog", { name: "删除" }).getByTestId("home-todo-delete-dialog-confirm").click();
      await expect.poll(() => readGovernanceTodo(title).length).toBe(0);
      await page.reload();
      await section.getByTestId("home-todo-filter-all").click();
      await expect(item).toHaveCount(0);
    });
    await testInfo.attach("owned-governance-todo-receipt", {
      body: JSON.stringify(receipt), contentType: "application/json",
    });
  });
});
