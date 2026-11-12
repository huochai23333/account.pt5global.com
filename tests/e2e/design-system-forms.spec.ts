import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { requireDisposableFixture } from "../test-support/disposable-fixture";
import { expectStandardFormContract, expectNoHorizontalOverflow } from "./helpers/design-system-governance";

// 指标安全带、标准字段和失败输入保留；原场景保持，不把表单错误当作保存成功。
// 包含费用与全局汇率表单提交；即使预期校验失败，也必须使用明确的可重建实例。
test.beforeAll(() => requireDisposableFixture({
  baseURL: process.env.PLAYWRIGHT_BASE_URL,
  supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  mode: process.env.PT5_E2E_FIXTURE_MODE,
}));

test.describe("设计系统治理守卫", () => {
  test("指标卡使用显式呈现契约，标准字段保持标签关联", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/company-expenses");

    await expect(
      page.locator('[data-slot="metric-card"][data-presentation="compact"]'),
    ).not.toHaveCount(0);

    await page.goto("/admin/wholesale/orders");
    // 成组的工作摘要必须走紧凑契约；这个断言会阻止批发页面再次退回高占位的数值面板。
    await expect(
      page.locator('[data-slot="metric-card"][data-presentation="compact"]'),
    ).not.toHaveCount(0);
    await expect(
      page.locator(
        '[data-slot="metric-card"][data-presentation="value-panel"]',
      ),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    for (const width of [1280, 1440]) {
      await page.setViewportSize({ height: 900, width });
      const lastMetric = page
        .locator('[data-slot="metric-card"]:visible')
        .last();
      const assistantLauncher = page.getByTestId("ai-assistant-launcher");
      const [metricBox, launcherBox] = await Promise.all([
        lastMetric.boundingBox(),
        assistantLauncher.boundingBox(),
      ]);
      expect(metricBox).not.toBeNull();
      expect(launcherBox).not.toBeNull();
      // 助手按钮在页面右下角浮动时，内容安全带必须让最右侧指标完整停在按钮左边。
      expect((metricBox?.x ?? 0) + (metricBox?.width ?? 0)).toBeLessThanOrEqual(
        launcherBox?.x ?? 0,
      );
      const metricValueLayouts = await page
        .locator(
          '[data-slot="metric-card"][data-presentation="compact"]:visible > div:last-child',
        )
        .evaluateAll((elements) =>
          elements.map((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            text: element.textContent,
          })),
        );
      for (const valueLayout of metricValueLayouts) {
        expect(
          valueLayout.scrollWidth,
          `${valueLayout.text ?? "指标数值"} 不能在紧凑卡中被截断`,
        ).toBeLessThanOrEqual(valueLayout.clientWidth + 1);
      }
      await expectNoHorizontalOverflow(page);
    }

    await page.goto("/admin/company-expenses");
    await page.getByRole("button", { name: "新增费用" }).click();
    const dialog = page.getByRole("dialog", { name: "新增费用" });
    const fields = dialog.locator('[data-slot="field"]');
    await expect(fields).not.toHaveCount(0);

    for (let index = 0; index < (await fields.count()); index += 1) {
      const field = fields.nth(index);
      const label = field.locator('[data-slot="field-label"]');
      const control = field.locator(
        '[data-slot="input"], [data-slot="textarea"], [data-slot="select"], [data-slot="date-picker-root"] input',
      );
      const controlId = await control.first().getAttribute("id");
      expect(controlId).toBeTruthy();
      await expect(label).toHaveAttribute("for", controlId!);
    }

    await dialog.getByLabel("费用名称").fill("保留输入的治理测试");
    await dialog.getByRole("button", { name: "保存费用" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("费用名称")).toHaveValue(
      "保留输入的治理测试",
    );
  });

  test("管理员的四类标准表单共享完整字段契约", async ({ page }) => {
    await loginAs(page, "administrator");

    const cases = [
      {
        dialogName: "新建公告",
        fieldLabel: "公告标题",
        fieldValue: "字段治理",
        route: "/admin/announcements",
        submitName: "保存草稿",
        triggerName: "新建公告",
      },
      {
        dialogName: "新增费用",
        fieldLabel: "费用名称",
        fieldValue: "字段治理",
        route: "/admin/company-expenses",
        submitName: "保存费用",
        triggerName: "新增费用",
      },
      {
        dialogName: "新增汇率",
        fieldLabel: "原始货币",
        fieldValue: "USD",
        route: "/admin/settings",
        submitName: "新增汇率",
        triggerName: "新增汇率",
      },
      {
        dialogName: "问题反馈",
        fieldLabel: "简短标题",
        fieldValue: "字段治理",
        route: "/admin/home",
        submitName: "提交反馈",
        triggerName: "提交反馈",
      },
    ] as const;

    for (const formCase of cases) {
      await page.goto(formCase.route);
      await page
        .getByRole("button", { name: formCase.triggerName, exact: true })
        .first()
        .click();
      const dialog = page.getByRole("dialog", {
        name: formCase.dialogName,
      });
      await expectStandardFormContract(dialog);

      const preservedField = dialog.getByLabel(formCase.fieldLabel);
      await preservedField.fill(formCase.fieldValue);
      await dialog
        .getByRole("button", { name: formCase.submitName, exact: true })
        .click();
      await expect(
        dialog.locator('[data-slot="feedback-notice"][data-tone="error"]'),
      ).toBeVisible();
      await expect(preservedField).toHaveValue(formCase.fieldValue);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });

  test("运营报销表单共享字段契约并在失败后保留输入", async ({ page }) => {
    await loginAs(page, "operator");
    await page.goto("/operator/reimbursements");
    await expect(
      page.locator('[data-slot="metric-card"][data-presentation="compact"]'),
    ).toHaveCount(3);
    await expect(
      page.locator('[data-slot="metric-card"][data-presentation="summary"]'),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "新增报销", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "新增报销" });
    await expectStandardFormContract(dialog);
    const amount = dialog.getByLabel("报销金额");
    await amount.fill("12.50");
    await dialog.getByRole("button", { name: "保存记录" }).click();
    // 缺少报销内容时错误贴在对应字段旁，保留已经输入的金额。
    await expect(dialog.getByText("请填写报销内容。")).toBeVisible();
    await expect(amount).toHaveValue("12.50");
  });
});
