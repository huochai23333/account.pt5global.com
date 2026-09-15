import { expect, test, type Locator, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

test.describe("设计系统治理守卫", () => {
  test("移动与桌面控件遵守共享高度令牌", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.setViewportSize({ height: 900, width: 390 });
    await page.goto("/admin/company-expenses");
    await expect(page.getByRole("heading", { name: "筛选内容" })).toHaveCount(0);
    const mobileFilterSearch = page
      .locator(
        '[data-slot="dashboard-search-input"] [data-slot="input"]',
      )
      .first();
    await expect(mobileFilterSearch).toHaveCSS("height", "44px");
    const mobileFilterSection = mobileFilterSearch.locator(
      "xpath=ancestor::section[1]",
    );
    expect(
      (await mobileFilterSection.boundingBox())?.height ??
        Number.POSITIVE_INFINITY,
    ).toBeLessThanOrEqual(220);
    await page.getByRole("button", { name: "新增费用" }).click();
    const dialog = page.getByRole("dialog", { name: "新增费用" });
    await expectVisibleControlsMeetHeight(
      dialog.locator(
        '[data-slot="button"], [data-slot="input"]:not([type="checkbox"]):not([type="radio"]), [data-slot="select"]',
      ),
      44,
    );
    await page.keyboard.press("Escape");
    await page.setViewportSize({ height: 900, width: 1440 });
    // 当前仅开放批发业务，桌面筛选高度必须从真实可用的订单入口验证。
    await page.goto("/admin/wholesale/orders");
    await expect(page.getByRole("heading", { name: "筛选订单" })).toHaveCount(0);
    const desktopFilterControls = page.locator(
      '[data-slot="dashboard-search-input"] [data-slot="input"]:visible, [data-density="filter"] :is([data-slot="input"], [data-slot="select"]):visible',
    );
    await expect(desktopFilterControls.first()).toBeVisible();
    const desktopFilterHeights = await desktopFilterControls.evaluateAll(
      (elements) =>
        elements.map((element) =>
          Number.parseFloat(window.getComputedStyle(element).height),
        ),
    );
    expect(new Set(desktopFilterHeights)).toEqual(new Set([40]));
    const desktopFilterSection = desktopFilterControls
      .first()
      .locator("xpath=ancestor::section[1]");
    expect(
      (await desktopFilterSection.boundingBox())?.height ??
        Number.POSITIVE_INFINITY,
    ).toBeLessThanOrEqual(380);
    // 紧凑控件在桌面端统一为 40px；普通输入仍由 default 令牌保持 48px。
    const compactControls = page.locator(
      '[data-slot="button"][data-size="compact"]:visible, [data-slot="button"][data-size="icon-compact"]:visible, [data-control-size="compact"]:visible',
    );
    await expect(compactControls.first()).toBeVisible();
    await expectVisibleControlsMeetHeight(compactControls, 40);
  });

  test("分页在三个验收宽度不挤压且只渲染一次", async ({ page }) => {
    await loginAs(page, "administrator");

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ height: 900, width });
      // 本地销售线索种子稳定超过一页，可从现行业务入口验证真正渲染出的页码按钮。
      await page.goto("/admin/wholesale/leads");

      const previous = page.getByRole("button", { name: "上一页" });
      const next = page.getByRole("button", { name: "下一页" });
      await expect(previous).toHaveCount(1);
      await expect(next).toHaveCount(1);
      await expect(previous).toBeVisible();
      await expect(next).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const minimumHeight = width === 390 ? 44 : 40;
      expect(
        (await previous.boundingBox())?.height ?? 0,
      ).toBeGreaterThanOrEqual(minimumHeight);
      expect((await next.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
        minimumHeight,
      );
    }
  });

  test("VIP 宽表只在 lg 断点切换", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/wholesale/vip");

    const responsiveView = page
      .locator('[data-slot="responsive-data-view"][data-breakpoint="lg"]')
      .first();
    const desktop = responsiveView.locator(":scope > div").nth(0);
    const mobile = responsiveView.locator(":scope > div").nth(1);

    for (const width of [390, 768]) {
      await page.setViewportSize({ height: 900, width });
      await expect(desktop).toBeHidden();
      await expect(mobile).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    await page.setViewportSize({ height: 900, width: 1440 });
    await expect(desktop).toBeVisible();
    await expect(mobile).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

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
    await expect(
      dialog.locator('[data-slot="feedback-notice"][data-tone="error"]'),
    ).toBeVisible();
    await expect(amount).toHaveValue("12.50");
  });

  test("待办编辑表单共享字段契约并在失败后保留输入", async ({ page }) => {
    await loginAs(page, "administrator");
    await page.goto("/admin/home");
    const todoSection = page.getByTestId("home-todos-section");
    await todoSection.getByTestId("home-todo-filter-all").click();

    let createdTitle: string | null = null;
    if ((await todoSection.getByTestId("home-todo-item").count()) === 0) {
      createdTitle = `字段治理临时待办-${Date.now()}`;
      await todoSection.getByTestId("home-todo-title-input").fill(createdTitle);
      await todoSection.getByTestId("home-todo-add-button").click();
      await expect(
        todoSection.getByText(createdTitle, { exact: true }),
      ).toBeVisible();
    }

    const todoItem = createdTitle
      ? todoSection
          .getByTestId("home-todo-item")
          .filter({ hasText: createdTitle })
      : todoSection.getByTestId("home-todo-item").first();
    await todoItem.getByTestId("home-todo-edit-button").click();

    const dialog = page.getByRole("dialog", { name: "编辑待办" });
    await expectStandardFormContract(dialog);
    const title = dialog.getByLabel("待办事项");
    await title.fill("");
    await dialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect(
      dialog.locator('[data-slot="feedback-notice"][data-tone="error"]'),
    ).toBeVisible();
    await expect(title).toHaveValue("");
    await page.keyboard.press("Escape");

    // 仅当用例为了无数据环境创建了临时待办时清理，避免污染后续本地测试。
    if (createdTitle) {
      await todoItem.getByTestId("home-todo-delete-button").click();
      const deleteDialog = page.getByRole("dialog", { name: "删除" });
      await deleteDialog.getByTestId("home-todo-delete-dialog-confirm").click();
      await expect(
        todoSection.getByText(createdTitle, { exact: true }),
      ).toBeHidden();
    }
  });
});

async function expectVisibleControlsMeetHeight(
  controls: Locator,
  minimumHeight: number,
) {
  const heights = await controls.evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          box.height > 0
        );
      })
      // 入场动画可能短暂缩放几何框；设计令牌验收读取最终 CSS 高度，避免把 44px 误判为 43.88px。
      .map((element) =>
        Number.parseFloat(window.getComputedStyle(element).height),
      ),
  );

  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights)
    expect(height).toBeGreaterThanOrEqual(minimumHeight);
}

/**
 * 六类标准弹窗共用同一个验证函数，确保新增字段不会只在某一个业务页面修好。
 * 必填、提示和错误都通过 `aria-describedby` / `aria-required` 传递，业务层无需手写关联。
 */
async function expectStandardFormContract(dialog: Locator) {
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(":focus")).not.toHaveCount(0);

  const fields = dialog.locator('[data-slot="field"]');
  await expect(fields.first()).toBeVisible();
  for (let index = 0; index < (await fields.count()); index += 1) {
    const field = fields.nth(index);
    const label = field.locator('[data-slot="field-label"]');
    const control = field
      .locator(
        '[data-slot="input"], [data-slot="textarea"], [data-slot="select"], [data-slot="date-picker-root"] input',
      )
      .first();
    const controlId = await control.getAttribute("id");
    expect(controlId).toBeTruthy();
    await expect(label).toHaveAttribute("for", controlId!);

    if ((await field.getAttribute("data-required")) === "true") {
      await expect(control).toHaveAttribute("aria-required", "true");
    }

    const descriptionIds = await control.getAttribute("aria-describedby");
    for (const descriptionId of descriptionIds?.split(/\s+/).filter(Boolean) ??
      []) {
      await expect(field.locator(`#${descriptionId}`)).toBeVisible();
    }
  }

  const firstControl = fields
    .first()
    .locator(
      '[data-slot="input"], [data-slot="textarea"], [data-slot="select"], [data-slot="date-picker-root"] input',
    )
    .first();
  await firstControl.focus();
  await expect(firstControl).toBeFocused();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}
