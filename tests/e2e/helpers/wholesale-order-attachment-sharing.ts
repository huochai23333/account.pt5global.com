import assert from "node:assert/strict";
import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { cleanupFixtureResources } from "../../test-support/fixture-cleanup-sequence";
import { loginAs } from "./auth";
import { attachmentSha256 } from "./wholesale-order-attachment-fixture";
import {
  createAttachmentPageScope,
  findAttachmentOrder,
  deleteAttachmentFromPage,
} from "./wholesale-order-attachment-page";

/** 两个手动context在newPage之前登记；正文、附件回收及两次关闭错误都保留。 */
export async function verifyAttachmentSharing(
  browser: Browser,
  baseURL: string | undefined,
) {
  assert(baseURL, "attachment_page_base_url_required");
  const contexts: BrowserContext[] = [],
    scope = createAttachmentPageScope();
  let adminPage: Page | undefined;
  await cleanupFixtureResources(
    async () => {
      const adminContext = await browser.newContext({
        baseURL,
        viewport: { height: 900, width: 1440 },
      });
      contexts.push(adminContext);
      adminPage = await adminContext.newPage();
      const clientContext = await browser.newContext({
        baseURL,
        viewport: { height: 900, width: 1440 },
      });
      contexts.push(clientContext);
      const clientPage = await clientContext.newPage(),
        page = adminPage;
      await loginAs(page, "administrator");
      await scope.prepare(page);
      const { order, fixture } = scope.current(),
        [file, secondFile] = scope.files;
      await scope.watch(page, async () => {
        let adminRow = await findAttachmentOrder(page, order);
        await adminRow.getByRole("button", { name: "管理附件" }).click();
        const dialog = page.getByRole("dialog", { name: /Order List 附件/ });
        await dialog.locator('input[type="file"]').setInputFiles(scope.files);
        await dialog.getByRole("button", { name: "上传附件" }).click();
        await expect(page.getByText("Order List 附件已上传。")).toBeVisible();
        await expect(dialog).toBeHidden();
        fixture.confirmRegistered();
        await expect(
          adminRow.getByRole("button", { name: file.name }),
        ).toBeVisible();
        await expect(
          adminRow.getByRole("button", { name: secondFile.name }),
        ).toBeVisible();
        await page.reload();
        adminRow = await findAttachmentOrder(page, order);
        await adminRow.getByRole("button", { name: "管理附件" }).click();
        await expect(dialog.getByText(file.name)).toBeVisible();
        await expect(dialog.getByText(secondFile.name)).toBeVisible();
        fixture.verifyPresent();
        await loginAs(clientPage, "client");
        await clientPage.goto("/client/wholesale/orders");
        await expect(
          clientPage.getByLabel("客户", { exact: true }),
        ).toHaveCount(0);
        const response = clientPage.waitForResponse(
          (r) =>
            r.url().includes("/rpc/get_wholesale_order_page") &&
            r.request().method() === "POST" &&
            Boolean(r.request().postData()?.includes(order.order_number)),
        );
        await clientPage.getByLabel("搜索订单").fill(order.order_number);
        const payload = await (await response).json();
        expect(payload.canViewInternalFields).toBe(false);
        expect(payload.orders).toHaveLength(1);
        expect(payload.orders[0].id).toBe(order.id);
        for (const field of [
          "payment_platform",
          "order_month",
          "referral_commission_fee",
          "product_purchase_amount",
          "international_shipping_fee",
          "other_fee",
        ])
          expect(payload.orders[0]).not.toHaveProperty(field);
        for (const label of [
          "收款平台",
          "订单计入月份",
          "推荐佣金费用",
          "产品采购金额",
          "国际运费",
          "其他费用",
        ])
          await expect(
            clientPage.getByRole("columnheader", { name: label }),
          ).toHaveCount(0);
        const clientRow = clientPage.getByTestId(
          `wholesale-order-row-${order.id}`,
        );
        await expect(clientRow).toContainText("本地业务员");
        await expect(clientRow).not.toContainText("未分配");
        for (const f of scope.files)
          await expect(
            clientRow.getByRole("button", { name: f.name }),
          ).toBeVisible();
        await expect(
          clientRow.getByRole("button", { name: "管理附件" }),
        ).toHaveCount(0);
        const waitingDownload = clientPage.waitForEvent("download");
        await clientRow.getByRole("button", { name: file.name }).click();
        const download = await waitingDownload;
        expect(download.suggestedFilename()).toBe(file.name);
        expect(await download.failure()).toBeNull();
        const stream = await download.createReadStream(),
          chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        expect(attachmentSha256(Buffer.concat(chunks))).toBe(
          attachmentSha256(file.buffer),
        );
        await clientPage.reload();
        await clientPage.getByLabel("搜索订单").fill(order.order_number);
        await expect(
          clientPage
            .getByTestId(`wholesale-order-row-${order.id}`)
            .getByRole("button", { name: file.name }),
        ).toBeVisible();
        await clientPage.setViewportSize({ height: 844, width: 390 });
        await clientPage.goto("/client/wholesale/orders");
        await clientPage.getByLabel("搜索订单").fill(order.order_number);
        await clientPage
          .getByTestId(`wholesale-order-card-${order.id}`)
          .click();
        const mobile = clientPage.getByRole("dialog", {
          name: `订单 ${order.order_number}`,
        });
        await expect(mobile).toContainText("本地业务员");
        for (const f of scope.files)
          await expect(
            mobile.getByRole("button", { name: f.name }),
          ).toBeVisible();
        await expect(mobile.getByText("收款平台", { exact: true })).toHaveCount(
          0,
        );
        await expect(
          mobile.getByText("产品采购金额", { exact: true }),
        ).toHaveCount(0);
        expect(
          await clientPage.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          ),
        ).toBeLessThanOrEqual(2);
        fixture.verifyPresent();
        await page.bringToFront();
        await deleteAttachmentFromPage(page, dialog, scope, file.name);
        await expect(page.getByText("Order List 附件已删除。")).toBeVisible();
        await deleteAttachmentFromPage(
          page,
          dialog,
          scope,
          secondFile.name,
          true,
        );
        fixture.requireCleared();
      });
    },
    async () => {
      if (adminPage) await adminPage.unrouteAll({ behavior: "wait" });
    },
    () => scope.cleanup(),
    async () => {
      await cleanupFixtureResources(
        ...contexts
          .slice()
          .reverse()
          .map((context) => () => context.close()),
      );
    },
  );
}
