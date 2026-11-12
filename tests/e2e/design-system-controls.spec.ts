import { expect, test } from "@playwright/test";
import { loginAs, setTestLocale } from "./helpers/auth";
import { stabilizeVisualPage } from "./helpers/design-system-visual";
import {
  disableControlTransitions,
  expectSemanticContrast,
  expectSemanticControlStyle,
  readControlStyle,
  readFocusStyle,
} from "./helpers/design-system-controls";

// 保留原认证入口与两个宽度；本文件只比较共享控件，不保存费用。
const viewports = [
  { height: 900, name: "desktop", width: 1440 },
  { height: 844, name: "mobile", width: 390 },
] as const;

for (const viewport of viewports) {
  test.describe(`design system visual baseline - ${viewport.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ height: viewport.height, width: viewport.width });
      await setTestLocale(page, "zh");
      await stabilizeVisualPage(page);
    });

    test("authentication large controls still use shared primitives", async ({
      page,
    }) => {
      await page.goto("/login");
      await disableControlTransitions(page);
      await expectSemanticContrast(page);
      const authInput = page.locator('[data-slot="input"]').first();
      const authPrimaryButton = page.locator(
        '[data-slot="button"][data-variant="primary"][type="submit"]',
      );
      const authInputStyle = await readControlStyle(authInput);
      const authButtonStyle = await readControlStyle(authPrimaryButton);
      await expect(authInput).toHaveAttribute("data-control-size", "large");
      await expect(authPrimaryButton).toHaveAttribute("data-size", "large");
      expect(authInputStyle.height).toBe("52px");
      expect(authButtonStyle.height).toBe("52px");
      await authInput.focus();
      const authInputFocusStyle = await readFocusStyle(authInput);

      await loginAs(page, "administrator");
      await page.goto("/admin/company-expenses");
      await disableControlTransitions(page);
      await page.getByRole("button", { name: "新增费用" }).click();
      const dialog = page.getByRole("dialog", { name: "新增费用" });
      const workspaceInput = dialog.locator('[data-slot="input"]').first();
      const workspacePrimaryButton = dialog.locator(
        '[data-slot="button"][data-variant="primary"]',
      );

      await expect(workspaceInput).toBeVisible();
      await expect(workspacePrimaryButton).toBeVisible();
      await expect(workspaceInput).toHaveAttribute(
        "data-control-size",
        "default",
      );
      await expect(workspacePrimaryButton).toHaveAttribute(
        "data-size",
        "default",
      );
      expectSemanticControlStyle(await readControlStyle(workspaceInput), authInputStyle);
      expectSemanticControlStyle(
        await readControlStyle(workspacePrimaryButton),
        authButtonStyle,
      );

      await workspaceInput.focus();
      expect(await readFocusStyle(workspaceInput)).toEqual(authInputFocusStyle);
    });
  });
}
