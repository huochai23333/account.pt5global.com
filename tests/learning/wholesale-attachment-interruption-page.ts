import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import zh from "../../messages/zh.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };

/** 实际页面的入口与翻译集中维护，故障测试只编排业务阶段。 */
export function createAttachmentInterruptionPage(
  page: Page,
  orderId: string,
  locale: "zh" | "en",
  width: number,
) {
  const copy = locale === "zh" ? zh : en;
  const ui = copy.WholesaleBusiness.ordersUi;
  const detail = page.getByRole("dialog", {
    name: ui.detailFields.title.replace("{number}", `Learning-${orderId}`),
  });
  const manager = page.getByRole("dialog", {
    name: `${ui.orderList.title} · Learning-${orderId}`,
  });
  const openDetails = async () => {
    const search = page.getByPlaceholder(
      copy.UiText.components_dashboard_wholesale_wholesale_order_filters
        .attribute002,
    );
    await search.fill(`Learning-${orderId}`);
    await search.press("Enter");
    if (width === 390)
      await page.getByTestId(`wholesale-order-card-${orderId}`).click();
    else
      await page
        .getByTestId(`wholesale-order-row-${orderId}`)
        .getByRole("button", { name: ui.compactColumns.details, exact: true })
        .click();
    await expect(detail).toBeVisible();
  };
  const openManager = async () => {
    await detail
      .getByRole("button", { name: ui.orderList.manage, exact: true })
      .click();
    await expect(manager).toBeVisible();
  };
  return { copy, ui, detail, manager, openDetails, openManager };
}

/** 凭证只包含请求数量与不带查询参数的路径；不保存认证头或签名。 */
export function observeAttachmentInterruption(page: Page, orderId: string) {
  const errors: string[] = [],
    consoleMessages: { text: string; path: string }[] = [];
  const requests = {
    uploads: 0,
    registrations: 0,
    storageDeletes: 0,
    registrationDeletes: 0,
    uploadPaths: [] as string[],
  };
  const missingReads: { path: string; status: number; notFound: boolean }[] =
    [];
  const responseEvidence: Promise<void>[] = [];
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (
      response.request().method() !== "GET" ||
      ![400, 404].includes(response.status()) ||
      !pathname.startsWith("/storage/v1/object/") ||
      !pathname.includes(`/wholesale-order-lists/${orderId}/`)
    )
      return;
    responseEvidence.push(
      (async () => {
        try {
          const body = await response.json();
          missingReads.push({
            path: pathname,
            status: response.status(),
            notFound:
              body.message === "Object not found" ||
              body.error === "not_found" ||
              body.code === "NoSuchKey",
          });
        } catch {
          missingReads.push({
            path: pathname,
            status: response.status(),
            notFound: false,
          });
        }
      })(),
    );
  });
  const redact = (text: string) =>
    text
      .replace(/https?:\/\/[^\s]+/g, (url) => url.split("?")[0]!)
      .replace(
        /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
        "[redacted-token]",
      );
  page.on("pageerror", (error) => errors.push(redact(error.message)));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      consoleMessages.push({
        text: redact(message.text()),
        path: new URL(message.location().url || "about:blank").pathname,
      });
  });
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (
      request.method() === "POST" &&
      pathname.startsWith(
        `/storage/v1/object/wholesale-order-lists/${orderId}/`,
      )
    ) {
      requests.uploads++;
      requests.uploadPaths.push(
        pathname.slice("/storage/v1/object/wholesale-order-lists/".length),
      );
    }
    if (pathname.endsWith("/rpc/register_wholesale_order_list_attachments"))
      requests.registrations++;
    if (
      request.method() === "DELETE" &&
      pathname === "/storage/v1/object/wholesale-order-lists"
    )
      requests.storageDeletes++;
    if (
      request.method() === "DELETE" &&
      pathname === "/rest/v1/wholesale_order_list_attachments"
    )
      requests.registrationDeletes++;
  });
  return {
    errors,
    consoleMessages,
    requests,
    missingReads,
    settleResponses: () => Promise.all(responseEvidence),
  };
}

/** 故障仍转发真实本机接口，只在指定阶段丢回执或改变读回正文。 */
export async function installAttachmentInterruptionFaults(
  page: Page,
  kind: string,
  orderId: string,
  capture: () => { objects: unknown[]; attachments: unknown[] },
  state: {
    injected: boolean;
    readFaulted: boolean;
    blockReadFault: boolean;
    uploadCalls: number;
    claimedSuccess: boolean;
  },
) {
  if (
    [
      "storage_response_lost",
      "storage_confirmation_navigation",
      "storage_body_mismatch",
      "storage_not_dispatched",
    ].includes(kind)
  ) {
    await page.route(
      (url) =>
        url.pathname.startsWith(
          `/storage/v1/object/wholesale-order-lists/${orderId}/`,
        ),
      async (route) => {
        if (route.request().method() !== "POST" || state.injected)
          return route.fallback();
        if (kind === "storage_not_dispatched") {
          // 先让首个文件完成，再阻断第二个，覆盖同批部分写入后的恢复。
          state.uploadCalls++;
          if (state.uploadCalls === 1) return route.fallback();
          state.injected = true;
          state.claimedSuccess = true;
          const fullPath = new URL(route.request().url()).pathname.slice(
            "/storage/v1/object/".length,
          );
          // 第二个请求没有到达服务，却返回正确路径的成功回包；实际文件读回必须识破它。
          return route.fulfill({
            status: 200,
            json: { Id: "not-persisted", Key: fullPath },
          });
        }
        // 真实写入成功并独立看到对象后才丢掉响应，区别于请求根本未发出。
        const actual = await route.fetch({ maxRetries: 0 });
        expect(actual.ok()).toBe(true);
        expect(capture().objects).toHaveLength(1);
        state.injected = true;
        await route.abort("connectionreset");
      },
    );
  }
  if (
    kind === "storage_confirmation_navigation" ||
    kind === "storage_body_mismatch"
  ) {
    await page.route(
      (url) =>
        url.pathname.startsWith("/storage/v1/object/") &&
        url.pathname.includes(`/wholesale-order-lists/${orderId}/`),
      async (route) => {
        if (route.request().method() !== "GET" || !state.blockReadFault)
          return route.fallback();
        state.readFaulted = true;
        if (kind === "storage_confirmation_navigation")
          return route.abort("connectionreset");
        // 上游仍读取真实对象；待核对期间保持正文不符，防止SDK透明重试掩盖注入。
        const actual = await route.fetch({ maxRetries: 0 });
        expect(actual.ok()).toBe(true);
        await route.fulfill({
          response: actual,
          body: "different-file-content",
        });
      },
    );
    if (kind === "storage_confirmation_navigation")
      await page.route(
        "**/storage/v1/object/list/wholesale-order-lists",
        (route) => route.abort("connectionreset"),
        { times: 1 },
      );
  }
  if (kind === "registration_navigation") {
    await page.route(
      "**/rpc/register_wholesale_order_list_attachments",
      async (route) => {
        const actual = await route.fetch({ maxRetries: 0 });
        expect(actual.ok()).toBe(true);
        expect(capture().attachments).toHaveLength(1);
        state.injected = true;
        await route.abort("connectionreset");
      },
      { times: 1 },
    );
    await page.route(
      /\/wholesale_order_list_attachments\?.*storage_path=in\./,
      (route) => route.abort("connectionreset"),
      { times: 1 },
    );
  }
}
