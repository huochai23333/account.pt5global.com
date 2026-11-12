import type { Page, Route } from "@playwright/test";
import type { FeeOrderFixture } from "./wholesale-fee-order-fixture";

/** 正文、转发和收尾的错误全部保留；等所有处理器结束后才进入数据清理。 */
export async function withFeePageRoute<T>(
  page: Page,
  endpoint: Parameters<Page["route"]>[0],
  handle: (route: Route) => Promise<void>,
  run: () => Promise<T>,
): Promise<T> {
  const failures: unknown[] = [];
  let result: T | undefined;
  try {
    await page.route(endpoint, async (route) => {
      try {
        await handle(route);
      } catch (error) {
        failures.push(error);
        try {
          await route.abort();
        } catch (abortError) {
          failures.push(abortError);
        }
      }
    });
    result = await run();
  } catch (error) {
    failures.push(error);
  }
  try {
    await page.unrouteAll({ behavior: "wait" });
  } catch (error) {
    failures.push(error);
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length)
    throw new AggregateError(failures, "fee_page_route_failed");
  return result as T;
}

/** 原页面请求和响应原样转发；等待服务器完成，失败/超时保留待决计数，禁止自动报告清理完成。 */
export async function forwardFeeWrite(
  route: Route,
  state: FeeOrderFixture,
  register: (value: unknown) => void,
) {
  register(route.request().postDataJSON());
  state.dispatchPending++;
  const response = await route.fetch({ timeout: 30000, maxRetries: 0 });
  if (response.ok()) state.dispatchPending--;
  await route.fulfill({ response });
}
