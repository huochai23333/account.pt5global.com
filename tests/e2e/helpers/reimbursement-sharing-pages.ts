import { expect, type Page } from "@playwright/test";

/** 页面读取提示不是数据库终态；写入的完整凭证由sharingCase独立核对。 */
export async function waitForRecords(page: Page) {
  await expect(page.getByText("正在读取报销记录…")).toHaveCount(0);
  await expect(
    page.getByText("报销记录暂时无法读取，请重新加载。"),
  ).toHaveCount(0);
}

export async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(2);
  const overflow = await page
    .locator("main, [role=dialog]")
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons
        .filter(
          (button) =>
            button.getBoundingClientRect().width > 0 &&
            Boolean(button.textContent?.trim()) &&
            button.scrollWidth > button.clientWidth + 2,
        )
        .map((button) => button.textContent),
    );
  expect(overflow).toEqual([]);
}

/** 信号只观测，闸门会阻塞请求；统一登记释放器，让断言失败后的收尾也能排空路由。 */
export function createSharingGates() {
  const releases: (() => void)[] = [];
  function createGate() {
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    releases.push(resolve);
    return { promise, resolve };
  }
  return {
    createGate,
    createSignal: createGate,
    releaseAll: () => releases.forEach((release) => release()),
  };
}
