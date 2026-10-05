import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

test.describe("API request limits", () => {
  test("未登录时损坏的邮件请求先返回登录失败", async ({ page }) => {
    const response = await page.request.post("/api/mail/threads", { data: Buffer.from("{"), headers: { "content-type": "application/json" } });
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toContain("重新登录");
  });

  test("已登录时邮件接口拒绝损坏的 JSON", async ({ page }) => {
    await loginAs(page, "administrator");
    const response = await page.request.post("/api/mail/threads", { data: Buffer.from("{"), headers: { "content-type": "application/json" } });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("提交内容无法读取");
  });

  test("邮件报告拒绝超限的合法 JSON 请求体", async ({ page }) => {
    await loginAs(page, "administrator");
    const response = await page.request.post("/api/mail/ai/report", {
      data: Buffer.from(JSON.stringify({ start: "2000-01-01", end: "2000-01-01", requestId: "synthetic-limit-check", padding: "x".repeat(70 * 1024) })),
      headers: { "content-type": "application/json" },
    });
    expect(response.status()).toBe(413);
    expect(await response.json()).toMatchObject({ code: "confirmed_rejection" });
    expect((await response.json()).error).toContain("内容超过允许大小");
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
