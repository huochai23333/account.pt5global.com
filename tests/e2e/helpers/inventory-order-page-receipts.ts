import { expect, test, type Locator, type Page } from "@playwright/test";
import type { InventoryOrderFixture } from "../../test-support/inventory-order-fixture";

type OrderCase = Parameters<InventoryOrderFixture["note"]>[0];
type Change = Parameters<InventoryOrderFixture["recordChange"]>[1];

export function orderNumber(fixture: InventoryOrderFixture, kind: OrderCase) {
  return String(fixture.graph(kind).orders[0].order_number);
}

export function inventoryOrderRow(page: Page, number: string) {
  return page.getByRole("row").filter({
    has: page.getByRole("cell", { exact: true, name: number }),
  });
}

export function inventoryCreditCard(page: Page, number: string) {
  return page.getByRole("article").filter({
    has: page.getByText(number, { exact: true }),
  });
}

export async function createInventoryOrder(
  button: Locator,
  fixture: InventoryOrderFixture,
  kind: OrderCase,
  amount: number,
) {
  const response = await submitWrite(
    button,
    fixture,
    "create_customer_inventory_order",
    "p_notes",
    fixture.note(kind),
  );
  const value = await response.json();
  const receipt = Array.isArray(value) && value.length === 1 ? value[0] : value;
  const graph = fixture.recordCreation(kind, receipt?.id, amount);
  await attachReceipt(graph, "created");
  return graph;
}

export async function changeInventoryOrder(
  button: Locator,
  fixture: InventoryOrderFixture,
  kind: OrderCase,
  action: Change,
  rpc: string,
  identity: "order" | "credit" | "extension" = "order",
) {
  const graph = fixture.graph(kind);
  const [param, id] = {
    order: ["p_order_id", graph.orders[0].id],
    credit: ["p_credit_application_id", graph.credits[0]?.id],
    extension: ["p_extension_request_id", graph.extensions[0]?.id],
  }[identity];
  if (!id) throw new Error("缺少上一步确认的信贷凭证");
  await submitWrite(button, fixture, rpc, param, id);
  const confirmed = fixture.recordChange(kind, action);
  await attachReceipt(confirmed, action);
  return confirmed;
}

async function submitWrite(
  button: Locator,
  fixture: InventoryOrderFixture,
  rpc: string,
  parameter: string,
  expected: string,
) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) throw new Error("专属夹具缺少本地 API 地址");
  const endpoint = new URL(`/rest/v1/rpc/${rpc}`, projectUrl);
  await expect(button).toBeEnabled();
  fixture.beginWrite();
  // 在点击前订阅相同项目、相同动作和精确目标的响应，避免把后台刷新或相邻订单当作本次写入。
  const [response] = await Promise.all([
    button.page().waitForResponse(
      (candidate) => {
        const url = new URL(candidate.url());
        const request = candidate.request();
        return (
          url.origin === endpoint.origin &&
          url.pathname === endpoint.pathname &&
          request.method() === "POST" &&
          request.postDataJSON()?.[parameter] === expected
        );
      },
      { timeout: 10_000 },
    ),
    button.click(),
  ]);
  expect(response.ok(), "页面写入请求失败").toBe(true);
  expect(await response.finished(), "页面写入响应不完整").toBeNull();
  return response;
}

async function attachReceipt(
  graph: ReturnType<InventoryOrderFixture["graph"]>,
  action: string,
) {
  const [order] = graph.orders;
  await test.info().attach(`inventory-${action}`, {
    contentType: "application/json",
    body: JSON.stringify({
      orderId: order.id,
      orderNumber: order.order_number,
      revision: order.revision,
      paymentStatus: order.payment_status,
      creditIds: graph.credits.map((row) => row.id),
      extensionIds: graph.extensions.map((row) => row.id),
      repaymentIds: graph.repayments.map((row) => row.id),
      auditIds: graph.audit
        .filter((row) => row.action === action)
        .map((row) => row.id),
    }),
  });
}
