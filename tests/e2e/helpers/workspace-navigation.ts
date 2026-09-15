import { expect, type Locator, type Page } from "@playwright/test";

export type DesktopBusinessGroupLabel = "批发业务";

/** 返回桌面左侧栏中的业务分组按钮，避免误选到移动端菜单里的同名文字。 */
export function getDesktopBusinessGroupButton(
  page: Page,
  label: DesktopBusinessGroupLabel,
): Locator {
  return page
    .locator("aside")
    .first()
    .getByRole("button", { exact: true, name: label });
}

/**
 * 把业务分组调整到指定状态，并等待 Supabase 确认保存成功。
 * 只有状态确实需要变化时才点击，方便多个共享种子账号的用例反复运行。
 */
export async function setDesktopBusinessGroupExpanded(
  page: Page,
  label: DesktopBusinessGroupLabel,
  expanded: boolean,
) {
  const button = getDesktopBusinessGroupButton(page, label);
  const expectedValue = String(expanded);

  await expect(button).toBeVisible();

  if ((await button.getAttribute("aria-expanded")) === expectedValue) {
    return button;
  }

  const saveResponsePromise = page.waitForResponse((response) =>
    response
      .url()
      .includes("/rest/v1/rpc/save_user_workspace_navigation_preference"),
  );

  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", expectedValue);

  const saveResponse = await saveResponsePromise;
  expect(saveResponse.ok()).toBe(true);

  return button;
}

/** 把管理员共享测试账号恢复为当前稳定状态：展开唯一启用的批发业务。 */
export async function restoreDefaultAdminBusinessGroups(page: Page) {
  await setDesktopBusinessGroupExpanded(page, "批发业务", true);
}
