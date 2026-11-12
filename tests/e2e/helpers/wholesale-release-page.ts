import assert from "node:assert/strict";
import {
  expect,
  type Browser,
  type Locator,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";
import { createWholesaleReleaseCase } from "../../test-support/wholesale-release-case";
import { cleanupFixtureResources } from "../../test-support/fixture-cleanup-sequence";
import type { ReleaseName } from "../../test-support/wholesale-release-seed";
import { fillDateControl } from "./date-control";
import { runLocalSupabaseSql } from "./local-supabase";
import { chooseSelectOption } from "./select-control";

type Fixture = ReturnType<typeof createWholesaleReleaseCase>;
const rpc = (name: string) =>
  new URL(`/rest/v1/rpc/${name}`, process.env.NEXT_PUBLIC_SUPABASE_URL!).href;

/** 生命周期内每一页都限于已声明的专属项目。全部关闭后才允许回收。 */
export async function withWholesaleReleasePages(
  browser: Browser,
  info: TestInfo,
  exercise: (fixture: Fixture, open: () => Promise<Page>) => Promise<void>,
) {
  const fixture = createWholesaleReleaseCase(runLocalSupabaseSql);
  const origins = [
    process.env.PLAYWRIGHT_BASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
  ].map((url) => new URL(url).origin);
  const pages: Page[] = [];
  let closed = false,
    forbiddenOrigin = false,
    repairAttempts = 0;
  let error: { cause: unknown } | undefined, receipt: unknown;
  async function open() {
    const page = await browser.newPage({ serviceWorkers: "block" });
    pages.push(page);
    await page.route(/^https?:\/\//, (route) => {
      if (origins.includes(new URL(route.request().url()).origin))
        return route.continue();
      forbiddenOrigin = true;
      return route.abort("blockedbyclient");
    });
    // 本用例已有精确手工报价。出现补价请求本身是异常，阻止它进入后台。
    await page.route(
      rpc("request_settlement_exchange_rate_repair"),
      (route) => {
        repairAttempts++;
        return route.abort("blockedbyclient");
      },
    );
    return page;
  }
  try {
    fixture.prepare();
    await exercise(fixture, open);
    assert(repairAttempts === 0, "wholesale_release_unexpected_rate_repair");
  } catch (cause) {
    error = { cause };
  } finally {
    await cleanupFixtureResources(
      async () => {
        if (error) throw error.cause;
      },
      async () => {
        await cleanupFixtureResources(
          ...pages.map((page) => async () => {
            if (!page.isClosed()) {
              await page.unrouteAll({ behavior: "wait" });
              await page.close();
            }
          }),
        );
        closed = pages.every((page) => page.isClosed());
      },
      async () => {
        assert(
          closed && !forbiddenOrigin,
          "wholesale_release_cleanup_boundary",
        );
        receipt = fixture.cleanup();
      },
      async () =>
        info.attach("wholesale-release-case", {
          body: JSON.stringify(
            {
              ...fixture.evidence(),
              closed,
              repairAttempts,
              forbiddenOrigin,
              receipt,
            },
            null,
            2,
          ),
          contentType: "application/json",
        }),
    );
  }
}

/** 先按本次请求登记发布意向，再从真实响应取得业务编号。 */
export async function publishWholesaleRelease(
  page: Page,
  fixture: Fixture,
  name: ReleaseName,
) {
  const value = fixture.seed.releases[name];
  await page.getByRole("button", { name: "发布收款", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "发布结汇收款" });
  await expect(dialog).toBeVisible();
  if (value.customerId) {
    await chooseSelectOption(
      dialog.getByRole("combobox", { name: "选择客户" }),
      { label: value.customerName },
    );
  } else {
    await dialog.getByLabel("客户名称").fill(value.customerName);
  }
  await dialog.getByLabel("结汇金额").fill(String(value.amount));
  await chooseSelectOption(dialog.getByLabel("币种"), { value: "USD" });
  await fillDateControl(dialog.getByLabel("收款日期"), fixture.seed.date);
  await dialog.getByLabel("备注").fill(value.note);
  fixture.begin(name);
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url() === rpc("create_wholesale_settlement_release") &&
        r.request().method() === "POST" &&
        r.request().postDataJSON()?.p_note === value.note,
    ),
    dialog.getByRole("button", { name: "发布收款", exact: true }).click(),
  ]);
  const id: unknown = await response.json();
  const requestId: unknown = response
    .request()
    .postDataJSON()?.p_publication_request_id;
  assert(
    response.ok() && typeof id === "string" && typeof requestId === "string",
    "wholesale_release_publication_response",
  );
  fixture.published(name, { id, requestId });
  await expect(page.getByText("结汇收款已发布。")).toBeVisible();
  return id;
}

export async function cancelWholesaleRelease(
  page: Page,
  fixture: Fixture,
  id: string,
  click: () => Promise<unknown>,
) {
  fixture.begin("cancel");
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url() === rpc("cancel_wholesale_settlement_release") &&
        r.request().method() === "POST" &&
        r.request().postDataJSON()?.p_release_id === id,
    ),
    click(),
  ]);
  const receipt: unknown = await response.json();
  assert(
    response.ok() && typeof receipt === "string",
    "wholesale_release_cancel_response",
  );
  fixture.cancelled(receipt);
}

export async function rejectWholesaleAllocation(page: Page, id: string) {
  const endpoint = rpc("replace_wholesale_settlement_release_allocations");
  const handler = (route: Route) => {
    const request = route.request();
    if (
      request.method() !== "POST" ||
      request.postDataJSON()?.p_release_id !== id
    )
      return route.abort("blockedbyclient");
    return route.fulfill({
      body: JSON.stringify({ message: "forced_failure" }),
      contentType: "application/json",
      status: 500,
    });
  };
  await page.route(endpoint, handler);
  return () => page.unroute(endpoint, handler);
}

export function wholesaleAllocationInput(dialog: Locator, orderNumber: string) {
  return dialog.getByRole("spinbutton", {
    exact: true,
    name: `订单 ${orderNumber} 的分配金额`,
  });
}

export async function expectWholesaleReleaseLayout(
  page: Page,
  scope?: Locator,
) {
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    compressed: Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, label, option, [data-slot="metric-card"] p',
      ),
    )
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          element.innerText.trim() &&
          rect.width > 0 &&
          rect.width < 24 &&
          rect.height > 48 &&
          rect.height > rect.width * 2.5
        );
      })
      .map((element) => element.innerText.trim())
      .slice(0, 5),
  }));
  expect(layout.overflow).toBeLessThanOrEqual(2);
  expect(layout.compressed).toEqual([]);
  if (!scope) return;
  const small = await scope.locator("button, input").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        // Base UI 下拉框内的隐藏表单项不属于触控目标。
        return (
          (element as HTMLElement).tabIndex >= 0 &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.height < 43.5
        );
      })
      .map((element) => ({
        height: element.getBoundingClientRect().height,
        text:
          (element as HTMLElement).innerText ||
          element.getAttribute("aria-label"),
      }))
      .slice(0, 5),
  );
  expect(small).toEqual([]);
}
