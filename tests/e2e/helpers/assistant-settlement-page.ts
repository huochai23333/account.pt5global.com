import assert from "node:assert/strict";
import { expect, type Locator, type Page, type Route } from "@playwright/test";
import type { AiAssistantSettlementReleaseAction } from "../../../lib/ai-assistant/assistant-types";
import type { createAssistantSettlementCase } from "../../test-support/assistant-settlement-case";

type Fixture = ReturnType<typeof createAssistantSettlementCase>;
const app = (pathname: string) =>
  new URL(pathname, process.env.PLAYWRIGHT_BASE_URL!).href;
const api = (pathname: string) =>
  new URL(pathname, process.env.NEXT_PUBLIC_SUPABASE_URL!).href;
const confirm = () => app("/api/assistant/settlement-release");

export async function openAssistant(page: Page) {
  await page.getByTestId("ai-assistant-launcher").click();
  await expect(page.getByLabel("问题内容")).toBeVisible();
}

export async function closeAssistant(page: Page) {
  await page.getByRole("button", { name: /^关闭.*助手$/ }).click();
  await expect(page.getByLabel("问题内容")).toHaveCount(0);
}

export async function sendAssistantMessage(page: Page, message: string) {
  const input = page.getByLabel("问题内容");
  await input.fill(message);
  await input.press("Enter");
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(page.getByText("正在回复", { exact: true })).toHaveCount(0);
}

export async function postAssistantCommand(page: Page, message: string) {
  return page.evaluate(async (command) => {
    const response = await fetch("/api/assistant/chat", {
      body: JSON.stringify({
        history: [],
        locale: "zh",
        message: command,
        pathname: window.location.pathname,
        requestId: crypto.randomUUID(),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    return {
      body: (await response.json()) as unknown,
      status: response.status,
    };
  }, message);
}

export function getResponseAction(value: unknown) {
  assert(
    typeof value === "object" &&
      value !== null &&
      "action" in value &&
      typeof value.action === "object" &&
      value.action !== null,
    "assistant_settlement_command_action_missing",
  );
  return value.action;
}

/** 匹配指定卡片的真实请求与响应。卡片状态之后仍要独立查数据库。 */
export async function confirmAssistantPublication(
  page: Page,
  note: string,
  submit: () => Promise<unknown>,
) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url() === confirm() &&
        r.request().method() === "POST" &&
        r.request().postDataJSON()?.action?.note === note,
    ),
    submit(),
  ]);
  const body = await response.json();
  const action = response.request().postDataJSON()
    ?.action as AiAssistantSettlementReleaseAction;
  assert(
    response.ok() &&
      typeof body?.releaseId === "string" &&
      typeof action?.requestId === "string",
    "assistant_settlement_confirmation_response",
  );
  return { id: body.releaseId as string, action };
}

export async function interceptAssistantConfirmation(
  page: Page,
  note: string,
  mode: "delay" | "failure",
) {
  const endpoint = confirm(),
    requestIds: string[] = [];
  const handler = async (route: Route) => {
    const request = route.request(),
      action = request.postDataJSON()?.action;
    if (
      request.method() !== "POST" ||
      action?.note !== note ||
      typeof action.requestId !== "string"
    ) {
      await route.abort("blockedbyclient");
      return;
    }
    requestIds.push(action.requestId);
    if (mode === "failure") {
      await route.fulfill({
        body: JSON.stringify({ error: "serviceUnavailable" }),
        contentType: "application/json",
        status: 503,
      });
      return;
    }
    // 让键盘操作能观察发布中和重复确认保护。
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  };
  await page.route(endpoint, handler);
  return { requestIds, restore: () => page.unroute(endpoint, handler) };
}

export function observeAssistantConfirmations(page: Page) {
  const notes: unknown[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url() === confirm()) {
      notes.push(request.postDataJSON()?.action?.note);
    }
  });
  return notes;
}

export async function expectAssistantLayout(page: Page, card?: Locator) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
  if (!card) return;
  const buttons = card.getByRole("button");
  for (const button of await buttons.all()) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  const compressed = await card
    .locator("dt, dd, button")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return (
            element.textContent?.trim() &&
            box.width > 0 &&
            box.width < 24 &&
            box.height > 48
          );
        })
        .map((element) => element.textContent?.trim()),
    );
  expect(compressed).toEqual([]);
}

export async function createAssistantAliasCustomer(
  page: Page,
  fixture: Fixture,
  index: 0 | 1,
) {
  const name = fixture.data.customerNames[index];
  await page.getByRole("button", { name: "新增客户" }).click();
  const dialog = page.getByRole("dialog", { name: "新增批发客户" });
  await dialog.getByLabel("客户唯一标识名称").fill(name);
  await dialog.getByLabel("客户其他名称").fill(fixture.data.sharedAlias);
  await dialog.getByLabel("联系方式").fill("自动测试");
  await dialog.getByLabel("客户来源").fill("自动测试");
  await dialog.getByLabel("备注").fill("用于结汇名称歧义回归");
  fixture.begin(`create:${index}`);
  const endpoint = new URL(api("/rest/v1/wholesale_customers"));
  const [response] = await Promise.all([
    page.waitForResponse((r) => {
      const target = new URL(r.url());
      return (
        target.origin === endpoint.origin &&
        target.pathname === endpoint.pathname &&
        r.request().method() === "POST" &&
        r.request().postDataJSON()?.unique_name === name
      );
    }),
    dialog.getByRole("button", { name: "保存客户" }).click(),
  ]);
  const body = await response.json();
  const id = Array.isArray(body) && body.length === 1 ? body[0]?.id : body?.id;
  assert(
    response.ok() && typeof id === "string",
    "assistant_settlement_customer_create_response",
  );
  fixture.created(index, id);
  await expect(page.getByText("批发客户已保存。")).toBeVisible();
  return id;
}

export async function deleteAssistantAliasCustomer(
  page: Page,
  fixture: Fixture,
  index: 0 | 1,
  id: string,
) {
  const name = fixture.data.customerNames[index];
  await page.getByLabel("搜索客户").fill(name);
  await page
    .getByText(name, { exact: true })
    .filter({ visible: true })
    .first()
    .click();
  const details = page.getByRole("dialog", { name });
  await details.getByRole("button", { name: "删除客户" }).click();
  const dialog = page.getByRole("dialog", { name: "删除批发客户" });
  fixture.begin(`delete:${index}`);
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url() === api("/rest/v1/rpc/delete_wholesale_customer") &&
        r.request().method() === "POST" &&
        r.request().postDataJSON()?.p_customer_id === id,
    ),
    dialog.getByRole("button", { name: "确认删除" }).click(),
  ]);
  assert(response.ok(), "assistant_settlement_customer_delete_response");
  fixture.deleted(index);
  await expect(page.getByText("批发客户已删除。")).toBeVisible();
  await page.getByLabel("搜索客户").fill("");
}
