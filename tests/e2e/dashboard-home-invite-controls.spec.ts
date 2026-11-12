import { expect, test } from "@playwright/test";
import { loginAs, type RegressionRole } from "./helpers/auth";
import { widgetCard, expectNoHorizontalOverflow, expectTouchTarget, expectNoClippedHomeWidgets } from "./helpers/home-widget-assertions";

// 原三岗位的邀请卡片尺寸与触控检查；不触发注册流程、不证明真实剪贴板内容。
test.describe.configure({ mode: "serial" });

for (const role of ["administrator", "salesman", "client"] as const satisfies readonly RegressionRole[]) {
  test(`${role} 的邀请码操作在 390px 下保持可用`, async ({ page }) => {
    const account = await loginAs(page, role);

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto(`${account.workspacePath}/home`);

    const inviteCard = widgetCard(page, "invite");

    await expect(inviteCard).toBeVisible();
    await expectNoHorizontalOverflow(page);
    for (const button of await inviteCard.getByRole("button").all()) {
      if (await button.isVisible()) {
        await expectTouchTarget(button, 44);
      }
    }

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto(`${account.workspacePath}/home`);

    const desktopInviteCard = widgetCard(page, "invite");

    expect(
      Number(await desktopInviteCard.getAttribute("data-home-widget-width")),
    ).toBeGreaterThanOrEqual(2);
    expect(
      Number(await desktopInviteCard.getAttribute("data-home-widget-height")),
    ).toBeGreaterThanOrEqual(2);
    for (const button of await desktopInviteCard.getByRole("button").all()) {
      await expect(button).toBeVisible();
      await expectTouchTarget(button, 44);
    }
    await expectNoClippedHomeWidgets(page);
  });
}
