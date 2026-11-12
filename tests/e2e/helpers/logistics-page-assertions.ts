import { expect, type Page } from "@playwright/test";
import type { LogisticsPagingRow } from "./logistics-paging-oracle";

export async function expectResponsiveLayout(page: Page) {
  await expectNoDocumentHorizontalOverflow(page);
  await expectNoCompressedText(page);
  await page.setViewportSize({ height: 844, width: 390 });
  await expectNoDocumentHorizontalOverflow(page);
  await expectNoCompressedText(page);
}

export async function isolateSourceRefresh(page: Page) {
  // 上下文级拦截覆盖查询参数/末尾斜杠；页面拦截排空后仍不能外发同步。
  await page.context().route(
    (url) => /\/functions\/v1\/wholesale-logistics-sync\/?$/.test(url.pathname),
    (route) =>
      route.fulfill({
        status: route.request().method() === "OPTIONS" ? 200 : 503,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
        },
        json: { error: "local_read_regression" },
      }),
  );
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const overflowPixels = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflowPixels).toBeLessThanOrEqual(2);
}

async function expectNoCompressedText(page: Page) {
  const compressedText = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>("button, label, th, td, dt, dd"),
    );
    return candidates
      .filter((element) => {
        const text = element.innerText.trim();
        const rect = element.getBoundingClientRect();
        if (!text || rect.width === 0 || rect.height === 0) return false;
        // 正常换行允许两三行；极窄且高度远大于宽度通常表示中文被挤成竖排。
        return (
          rect.width < 24 && rect.height > 48 && rect.height > rect.width * 2.5
        );
      })
      .map((element) => element.innerText.trim())
      .slice(0, 5);
  });
  expect(compressedText).toEqual([]);
}

export function waitForPagingResponse(page: Page, pageNumber: number) {
  return page.waitForResponse((response) => {
    if (
      !new URL(response.url()).pathname.endsWith(
        "/rest/v1/rpc/get_wholesale_logistics_page",
      )
    )
      return false;
    const request = response.request();
    if (request.method() !== "POST") return false;
    const body = request.postDataJSON();
    return (
      body?.p_page === pageNumber &&
      body?.p_filters?.storeName === "Local Paging Shop"
    );
  });
}

export async function readRenderedPagingRows(
  page: Page,
  response: Awaited<ReturnType<typeof waitForPagingResponse>>,
  count: number,
): Promise<LogisticsPagingRow[]> {
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.totalCount).toBe(55);
  expect(data.rows).toHaveLength(count);
  const rows: LogisticsPagingRow[] = data.rows.map(
    (row: { id: string; package_number: string }) => ({
      id: row.id,
      packageNumber: row.package_number,
    }),
  );
  await expect(page.locator("tbody tr")).toHaveCount(count);
  // 包裹号在第五列：按实际渲染顺序核对，不能只相信接口返回值。
  await expect(page.locator("tbody tr td:nth-child(5)")).toHaveText(
    rows.map((row) => row.packageNumber),
  );
  return rows;
}
