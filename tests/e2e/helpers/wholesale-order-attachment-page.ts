import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { cleanupFixtureResources } from "../../test-support/fixture-cleanup-sequence";
import {
  readFeeCustomer,
  readWholesaleOrderAttachmentObjects,
} from "./wholesale-fee-database";
import {
  cleanupFeeOrder,
  type FeeOrderFixture,
} from "./wholesale-fee-order-fixture";
import {
  createFeeOrderPage,
  type FeePageOrder,
} from "./wholesale-fee-order-page";
import { withFeePageRoute } from "./wholesale-fee-page-route";
import { createAttachmentCapability } from "./wholesale-order-attachment-capability";
import {
  createOrderAttachmentFixture,
  type AttachmentFile,
} from "./wholesale-order-attachment-fixture";

/** CSV保留原业务样本；XLSX使用真实OpenXML工作簿，不能把普通文本改后缀冒充。 */
export function attachmentFileInputs(
  prefix: string,
  csvOnly = false,
  sku = "LOCAL-001",
): AttachmentFile[] {
  return [
    {
      name: `${prefix}-a.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(`sku,quantity\n${sku},2\n`, "utf8"),
    },
    csvOnly
      ? {
          name: `${prefix}-b.csv`,
          mimeType: "text/csv",
          buffer: Buffer.from(`sku,quantity\n${prefix},1\n`, "utf8"),
        }
      : {
          name: `${prefix}-b.xlsx`,
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: readFileSync(
            path.resolve(
              __dirname,
              "../../test-support/fixtures/wholesale-order-list.xlsx",
            ),
          ),
        },
  ];
}

export function createAttachmentPageScope(csvOnly = false, sku = "LOCAL-001") {
  const prefix = `fees-e2e-${randomUUID()}`,
    files = attachmentFileInputs(`order-list-${randomUUID()}`, csvOnly, sku),
    orders: FeeOrderFixture[] = [];
  let saved: FeePageOrder | undefined,
    fixture: ReturnType<typeof createOrderAttachmentFixture> | undefined,
    capability: ReturnType<typeof createAttachmentCapability> | undefined;
  function current() {
    assert(saved && fixture && capability, "attachment_page_not_prepared");
    return { order: saved, fixture, capability };
  }
  return {
    files,
    current,
    async prepare(page: Page) {
      const customer = readFeeCustomer("c1000000-0000-4000-8000-000000000002");
      assert(
        customer?.registered_user_id === "77777777-7777-4777-8777-777777777777",
        "attachment_page_client_customer_missing",
      );
      assert(
        customer.salesman_commission_cohort === "new" ||
          customer.salesman_commission_cohort === "existing",
      );
      saved = await createFeeOrderPage(page, {
        prefix,
        customer: {
          id: String(customer.id),
          name: String(customer.unique_name),
          cohort: customer.salesman_commission_cohort,
        },
        role: "admin",
        kind: "attachment",
        orders,
        outputPath: () => {
          throw Error("attachment_page_has_no_form_screenshot");
        },
      });
      capability = createAttachmentCapability(saved.fixture.actor);
      fixture = createOrderAttachmentFixture(saved.fixture, files, () =>
        capability!.client(),
      );
    },
    async watch(page: Page, body: () => Promise<void>, incomplete = false) {
      const { fixture, capability } = current(),
        origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
      const pattern = new RegExp(
        "^" +
          origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
          "(?:/storage/v1/object/wholesale-order-lists(?:/|\\?|$)|/rest/v1/(?:rpc/register_wholesale_order_list_attachments|wholesale_order_list_attachments)(?:\\?|$))",
      );
      await withFeePageRoute(
        page,
        pattern,
        async (route) => {
          const request = route.request(),
            url = new URL(request.url());
          if (
            request.method() === "POST" &&
            url.pathname.startsWith("/storage/v1/object/wholesale-order-lists/")
          ) {
            const objectPath = decodeURIComponent(
              url.pathname.slice(
                "/storage/v1/object/wholesale-order-lists/".length,
              ),
            );
            const name = fixture.beginUpload(objectPath);
            capability.capture(request);
            const response = await route.fetch({
              timeout: 60000,
              maxRetries: 0,
            });
            if (response.ok())
              await fixture.confirmUpload(name, await response.json());
            await route.fulfill({ response });
          } else if (
            request.method() === "POST" &&
            url.pathname.endsWith(
              "/rpc/register_wholesale_order_list_attachments",
            )
          ) {
            const value = request.postDataJSON();
            fixture.register(value);
            capability.capture(request);
            if (incomplete) {
              // 本测试明确不转发，才能在断言后限定回收孤立对象；真实未知提交不能使用这个许可。
              fixture.markNotForwarded();
              await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify([
                  {
                    ...value.p_attachments[0],
                    id: "00000000-0000-4000-8000-000000000001",
                    order_id: value.p_order_id,
                  },
                ]),
              });
            } else {
              const response = await route.fetch({
                timeout: 60000,
                maxRetries: 0,
              });
              if (response.ok())
                fixture.receiveRegistration(await response.json());
              await route.fulfill({ response });
            }
          } else if (request.method() === "DELETE") {
            capability.capture(request);
            const paths = url.pathname.includes("/storage/")
              ? request.postDataJSON().prefixes
              : [String(url.searchParams.get("storage_path")).slice(3)];
            fixture.beginRemovalTransport(paths);
            const response = await route.fetch({
              timeout: 60000,
              maxRetries: 0,
            });
            if (response.ok()) fixture.finishRemovalTransport();
            await route.fulfill({ response });
          } else await route.continue();
        },
        body,
      );
    },
    async cleanup() {
      // 附件收尾失败仍核对父订单，但父层必须独立查空，不能级联删登记后留下实际对象。
      await cleanupFixtureResources(
        async () => {
          if (fixture) await fixture.cleanup();
        },
        async () => {
          await cleanupFixtureResources(
            ...orders
              .slice()
              .reverse()
              .map((order) => async () => {
                if (order.proof?.order)
                  assert.equal(
                    readWholesaleOrderAttachmentObjects(
                      String(order.proof.order.id),
                    ).length,
                    0,
                    "attachment_fixture_objects_remaining",
                  );
                cleanupFeeOrder(order);
              }),
          );
        },
      );
    },
  };
}

export async function findAttachmentOrder(
  page: Page,
  order: FeePageOrder,
  role = "admin",
) {
  await page.goto(`/${role}/wholesale/orders`);
  await page.getByLabel("搜索订单").fill(order.order_number);
  if ((page.viewportSize()?.width ?? 1440) <= 390) {
    await page.getByTestId(`wholesale-order-card-${order.id}`).click();
    return page.getByRole("dialog", { name: `订单 ${order.order_number}` });
  }
  if (role === "admin") {
    const expand = page.getByRole("button", { name: "查看全部字段" });
    if (await expand.isVisible()) await expand.click();
  }
  const row = page.getByTestId(`wholesale-order-row-${order.id}`);
  await expect(row).toBeVisible();
  return row;
}

export async function deleteAttachmentFromPage(
  page: Page,
  dialog: ReturnType<Page["getByRole"]>,
  scope: ReturnType<typeof createAttachmentPageScope>,
  name: string,
  directClick = false,
) {
  scope.current().fixture.beginRemoval(name);
  const button = dialog
    .locator(`[data-attachment-name="${name}"]`)
    .getByRole("button", { name: "删除" });
  await expect(button).toBeEnabled();
  if (directClick)
    await button.evaluate((element: HTMLButtonElement) => element.click());
  else await button.click();
  await page
    .getByRole("dialog", { name: "请确认这项操作" })
    .getByRole("button", { name: "确认操作" })
    .click();
  await expect(dialog.getByText(name, { exact: true })).toHaveCount(0);
  scope.current().fixture.confirmRemoved(name);
}
