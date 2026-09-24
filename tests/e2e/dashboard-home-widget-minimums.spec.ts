import { expect, test, type Locator, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

const EXPECTED_MINIMUMS = {
  announcements: { height: 2, width: 2 },
  clock: { height: 2, width: 2 },
  greeting: { height: 1, width: 2 },
  invite: { height: 2, width: 2 },
  todos: { height: 3, width: 3 },
} as const;

test("各首页组件在最小尺寸仍保留完整功能", async ({ page }) => {
  await loginAs(page, "administrator");
  await resetHomeLayout(page);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/admin/home");

  await expectDefaultWidgetSizes(page);
  await page.getByTestId("home-edit-button").click();
  // 本用例检查最小尺寸的功能；暂停循环摇动，避免持续动画干扰真实按钮点击。
  await page.addStyleTag({ content: ".dashboard-home-wiggle { animation: none !important; }" });
  await expectMinimumButtonsDisabled(page);
  await verifyInviteCanOnlyShrinkToMinimum(page);
  await verifyGreetingCanOnlyShrinkToMinimum(page);
  await page.getByTestId("home-edit-done-button").click();

  await expectMinimumWidgetFunctions(page);
  await expectNoClippedHomeWidgets(page);
  await resetHomeLayout(page);
});

async function expectDefaultWidgetSizes(page: Page) {
  const defaultSizes = {
    ...EXPECTED_MINIMUMS,
    greeting: { height: 1, width: 5 },
    invite: { height: 2, width: 3 },
  };

  for (const [type, size] of Object.entries(defaultSizes)) {
    const card = widgetCard(page, type);

    await expect(card).toHaveAttribute(
      "data-home-widget-height",
      String(size.height),
    );
    await expect(card).toHaveAttribute(
      "data-home-widget-width",
      String(size.width),
    );
  }
}

async function expectMinimumWidgetFunctions(page: Page) {
  await expect(page.getByTestId("home-todo-title-input")).toBeVisible();
  await expect(page.getByLabel("截止日期")).toBeVisible();
  await expect(page.getByTestId("home-todo-quick-important")).toBeVisible();
  await expect(page.getByTestId("home-todo-add-button")).toBeVisible();

  const inviteCard = widgetCard(page, "invite");

  await expect(inviteCard.getByTestId("home-invite-copy-code")).toBeVisible();
  await expect(inviteCard.getByTestId("home-invite-copy-link")).toBeVisible();
  for (const button of await inviteCard.getByRole("button").all()) {
    await expectTouchTarget(button, 44);
  }

  await expect(page.getByTestId("home-clock-time")).toBeVisible();
  await expect(widgetCard(page, "clock").getByText("北京时间")).toBeVisible();
  await expect(page.getByTestId("home-announcements-compact")).toBeVisible();
}

async function expectMinimumButtonsDisabled(page: Page) {
  for (const type of ["announcements", "clock", "todos"]) {
    const dialog = await openAdjustDialog(page, widgetCard(page, type));

    await expect(dialog.getByTestId("home-adjust-make-narrower")).toBeDisabled();
    await expect(dialog.getByTestId("home-adjust-make-shorter")).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
}

async function verifyInviteCanOnlyShrinkToMinimum(page: Page) {
  const inviteCard = widgetCard(page, "invite");

  const dialog = await openAdjustDialog(page, inviteCard);
  const makeNarrower = dialog.getByTestId("home-adjust-make-narrower");

  await expect(makeNarrower).toBeEnabled();
  await makeNarrower.click();
  await expect(inviteCard).toHaveAttribute("data-home-widget-width", "2");
  await expect(makeNarrower).toBeDisabled();
  await expect(dialog.getByTestId("home-adjust-make-shorter")).toBeDisabled();
  await page.keyboard.press("Escape");
}

async function verifyGreetingCanOnlyShrinkToMinimum(page: Page) {
  const greetingCard = widgetCard(page, "greeting");

  const dialog = await openAdjustDialog(page, greetingCard);
  const makeNarrower = dialog.getByTestId("home-adjust-make-narrower");

  await expect(dialog.getByTestId("home-adjust-make-shorter")).toBeDisabled();
  await expect(makeNarrower).toBeEnabled();
  await makeNarrower.click();
  await makeNarrower.click();
  await makeNarrower.click();
  await expect(greetingCard).toHaveAttribute("data-home-widget-width", "2");
  await expect(makeNarrower).toBeDisabled();
  await page.keyboard.press("Escape");
}

async function openAdjustDialog(page: Page, card: Locator) {
  const button = card.getByTestId("home-widget-adjust-button");
  // 循环动画已在本用例暂停，直接验证调整按钮是否可点击。
  await button.click();

  const dialog = page.getByRole("dialog", { name: /调整组件/ });

  await expect(dialog).toBeVisible();
  return dialog;
}

async function resetHomeLayout(page: Page) {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/admin/home");
  await page.getByTestId("home-manage-button").click();
  const manager = page.getByRole("dialog", { name: "管理首页" });

  await expect(manager).toBeVisible();
  await manager.getByTestId("home-manager-reset").click();
  await page.waitForTimeout(900);
  await expect(
    manager.getByText("首页调整还没有保存，请检查网络后重试。"),
  ).toHaveCount(0);
  await manager.getByTestId("home-manager-done").click();
}

function widgetCard(page: Page, type: string) {
  return page.locator(
    `[data-testid="home-widget-card"][data-home-widget-type="${type}"]`,
  );
}

async function expectNoClippedHomeWidgets(page: Page) {
  const clippedWidgets = await page
    .getByTestId("home-widget-card")
    .evaluateAll((cards) =>
      cards
        .map((card) => ({
          overflow: card.scrollHeight - card.clientHeight,
          type: card.getAttribute("data-home-widget-type"),
        }))
        .filter((item) => item.overflow > 2),
    );

  expect(clippedWidgets).toEqual([]);
}

async function expectTouchTarget(locator: Locator, minimum: number) {
  const box = await requiredBox(locator);

  expect(box.height).toBeGreaterThanOrEqual(minimum - 0.1);
  expect(box.width).toBeGreaterThanOrEqual(minimum - 0.1);
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();

  expect(box).not.toBeNull();
  return box!;
}
