import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

test.describe("API request limits", () => {
  test("邮件接口先检查登录，再限制请求体并提示坏内容", async ({ page }) => {
    // Buffer 会原样发送损坏的 JSON；普通字符串会被 Playwright 自动编码为合法 JSON。
    const anonymous = await page.request.post("/api/mail/threads", { data: Buffer.from("{"), headers: { "content-type": "application/json" } });
    expect(anonymous.status()).toBe(401);
    expect((await anonymous.json()).error).toContain("重新登录");

    await loginAs(page, "administrator");
    const malformed = await page.request.post("/api/mail/threads", { data: Buffer.from("{"), headers: { "content-type": "application/json" } });
    expect(malformed.status()).toBe(400);
    expect((await malformed.json()).error).toContain("提交内容无法读取");
    const oversized = await page.request.post("/api/mail/ai/report", { data: "x".repeat(70 * 1024), headers: { "content-type": "application/json" } });
    expect(oversized.status()).toBe(413);
    expect((await oversized.json()).error).toContain("内容超过允许大小");
  });

  test("AI endpoint stops oversized request bodies", async ({ page }) => {
    await loginAs(page, "client");

    const assistantResult = await postOversizedBody(
      page,
      "/api/assistant/chat",
      70 * 1024,
    );

    expect(assistantResult.status).toBe(413);
    expect(assistantResult.body.error).toBe("requestTooLarge");

  });

});

async function postOversizedBody(page: Page, url: string, paddingSize: number) {
  return page.evaluate(
    async ({ paddingSize: bodyPaddingSize, url: requestUrl }) => {
      const response = await fetch(requestUrl, {
        body: JSON.stringify({ padding: "x".repeat(bodyPaddingSize) }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      return {
        body: (await response.json()) as Record<string, unknown>,
        retryAfter: response.headers.get("Retry-After"),
        status: response.status,
      };
    },
    { paddingSize, url },
  );
}
