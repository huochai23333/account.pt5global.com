import type { Page } from "@playwright/test";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
/** 编号来自本次页面预览RPC的实际回包；绝不退回全库created_at最新记录。 */
export async function requestRecalculationPreview(
  page: Page,
  click: () => Promise<unknown>,
) {
  const endpoint = (value: string) =>
    new URL(value).pathname.replace(/\/$/, "") ===
    "/rest/v1/rpc/preview_exchange_rate_recalculation";
  // 同步注册后才点击。两份Promise一起等待，点击失败也不会遗留无人处理的响应等待拒绝。
  const responsePromise = page.waitForResponse(
    (response) =>
      endpoint(response.url()) && response.request().method() === "POST",
    { timeout: 60_000 },
  );
  const [response] = await Promise.all([responsePromise, click()]);
  if (!response.ok()) throw new Error("recalculation_preview_response_failed");
  const id: unknown = await response.json();
  if (typeof id !== "string" || !uuid.test(id))
    throw new Error("recalculation_preview_response_id_invalid");
  return id;
}
