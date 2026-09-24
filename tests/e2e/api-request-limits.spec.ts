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

  test("AI and 1688 endpoints stop oversized request bodies", async ({ page }) => {
    await loginAs(page, "client");

    const assistantResult = await postOversizedBody(
      page,
      "/api/assistant/chat",
      70 * 1024,
    );

    expect(assistantResult.status).toBe(413);
    expect(assistantResult.body.error).toBe("requestTooLarge");

    // 同一浏览器切换测试角色前先走真实退出入口，避免登录页把有效会话送回客户首页。
    await page.goto("/auth/sign-out?next=%2Flogin");
    await page.getByRole("button", { name: "退出登录" }).click();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await loginAs(page, "administrator");

    const ingestResult = await postOversizedBody(
      page,
      "/api/wholesale/1688-orders",
      5 * 1024 * 1024 + 1024,
    );

    expect(ingestResult.status).toBe(413);
    expect(ingestResult.body.error).toContain("内容太大");
  });

  test("1688 endpoint returns a retry time after five recent calls", async ({
    page,
  }) => {
    await loginAs(page, "administrator");

    const orderNumber = `1688-API-LIMIT-${Date.now()}`;
    const payload = {
      fileName: "接口额度自动测试",
      rows: [
        {
          external_order_number: orderNumber,
          item_summary: "接口额度自动测试商品",
          purchase_amount: 1,
          quantity: 1,
          seller_name: "接口额度自动测试供应商",
        },
      ],
    };

    let deniedResult: Awaited<ReturnType<typeof postJson>> | null = null;

    // 调用窗口保存在数据库中，重复执行整套回归时可能已经有近期记录；
    // 因此这里验证“最迟第六次被拒绝”，精确的 5 次边界由事务 SQL 断言覆盖。
    for (let index = 0; index < 6; index += 1) {
      const result = await postJson(page, "/api/wholesale/1688-orders", payload);

      if (result.status === 429) {
        deniedResult = result;
        break;
      }

      expect(result.status).toBe(200);
    }

    expect(deniedResult).not.toBeNull();
    expect(deniedResult?.status).toBe(429);
    expect(Number(deniedResult?.retryAfter)).toBeGreaterThan(0);
    expect(deniedResult?.body.error).toContain("稍后再试");
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

async function postJson(page: Page, url: string, body: unknown) {
  return page.evaluate(
    async ({ body: requestBody, url: requestUrl }) => {
      const response = await fetch(requestUrl, {
        body: JSON.stringify(requestBody),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      return {
        body: (await response.json()) as Record<string, unknown>,
        retryAfter: response.headers.get("Retry-After"),
        status: response.status,
      };
    },
    { body, url },
  );
}
