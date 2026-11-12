import { expect, type Page } from "@playwright/test";

import { expectNotForbiddenPage, expectWorkspaceShell, loginAs } from "./helpers/auth";
import { test } from "./helpers/client-business-fixture";

test("administrator is blocked from tourism and can add a verified wholesale client", async ({
  page, clientBusinessFixture,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await loginAs(page, "administrator");

  // 停用业务进入说明页，管理员身份也不能绕过业务启用范围。
  await page.goto("/admin/tourism/customers");
  await expect(page).toHaveURL(
    /\/business-unavailable\?business=tourism$/,
  );
  await expect(
    page.getByRole("heading", { name: "旅游业务暂时停止服务" }),
  ).toBeVisible();

  await addClientFromBusinessPage({
    candidateEmail: clientBusinessFixture.email,
    dialogName: "添加到批发业务",
    page,
    path: "/admin/wholesale/customers",
    successMessage: "客户已添加到批发业务。",
  });

  // Toast 只表示页面收到响应；独立服务端查询必须同时确认访问表和正式客户档案。

  await clientBusinessFixture.expectLinked();
  await page.reload();
  await expect(
    page
      .getByText(clientBusinessFixture.name, { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);

  await clientBusinessFixture.expectLinked();
});

async function addClientFromBusinessPage({
  candidateEmail,
  dialogName,
  page,
  path,
  successMessage,
}: {
  candidateEmail: string;
  dialogName: string;
  page: Page;
  path: string;
  successMessage: string;
}) {
  await page.goto(path);
  await expectWorkspaceShell(page);
  await expectNotForbiddenPage(page);
  await page.getByRole("button", { name: "添加客户", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: dialogName });
  await dialog
    .getByRole("searchbox", { name: "搜索客户" })
    .fill(candidateEmail);
  await expect(
    dialog.getByText(candidateEmail, { exact: false }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "添加客户", exact: true }).click();

  await expect(page.getByText(successMessage)).toBeVisible();
  await expect(dialog).toHaveCount(0);
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflowPixels).toBeLessThanOrEqual(2);
}
