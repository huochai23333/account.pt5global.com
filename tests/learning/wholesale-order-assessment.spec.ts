import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { setTimeout as wait } from "node:timers/promises";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const mockPort = 38481;
const responseText = "Learning assessment result";
test.skip(process.env.PT5_LEARNING_ASSESSMENT_MOCK !== "1", "先按批发订单指南配置本地模拟地址。");

// 只允许向本机模拟端口发送评估。运行前的探针确认当前 Next.js 已读到临时配置。
test.beforeAll(async () => {
  const settings = await readFile(".env.development.local", "utf8");
  expect(settings).toBe(
    `DEEPSEEK_BASE_URL=http://127.0.0.1:${mockPort}\nDEEPSEEK_API_KEY=pt5-learning-assessment\n`,
  );
  const probe = await fetch("http://localhost:3000/api/learning-assessment-probe");
  expect(probe.status).toBe(200);
  expect(await probe.json()).toEqual({ localMock: true });
});

function readRuns(userId: string) {
  return JSON.parse(executeLearningSql(`
    select coalesce(json_agg(t order by created_at),'[]') from (
      select id, idempotency_key, status, succeeded_count, failed_count, result_proof, created_at
      from private.operation_runs where requested_by_user_id='${userId}' and operation_key='ai-order-assessment'
    ) t;`));
}

function cleanupRuns(userId: string) {
  executeLearningSql(`delete from private.operation_runs where requested_by_user_id='${userId}'
    and operation_key='ai-order-assessment';`);
  expect(readRuns(userId)).toEqual([]);
}

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  test(`精确搜索评估沿用列表范围并核对终态 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    if (locale === "zh") test.setTimeout(90_000);
    const messages = locale === "zh" ? zh : en;
    const copy = messages.WholesaleBusiness.ordersUi.assessment;
    const id = randomUUID();
    const name = `Learning-${id}`;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const prompts: string[] = [];
    const mock = createServer(async (request, response) => {
      if (request.url !== "/chat/completions" || request.headers.authorization !== "Bearer pt5-learning-assessment") {
        response.writeHead(400).end();
        return;
      }
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const prompt = JSON.parse(raw).messages[1].content as string;
      // 只接受含本次合成编号的请求，其他本机请求一律拒绝。
      if (!prompt.includes(name)) {
        response.writeHead(400).end();
        return;
      }
      prompts.push(prompt);
      const attempt = prompts.length;
      if (attempt === 1) await wait(500);
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      const text = attempt === 1 ? responseText : attempt === 2 ? "Partial text without completion" : "   ";
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
      // 第四次故意保持连接打开，由真实接口的超时控制器终止。
      if (attempt === 4) return;
      response.end(attempt !== 2 ? "data: [DONE]\n\n" : "");
    });
    mock.listen(mockPort, "127.0.0.1");
    await once(mock, "listening");

    try {
      await page.addLocatorHandler(
        page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }),
        async () => { await page.keyboard.press("Escape"); },
      );
      executeLearningSql(`begin;
        insert into public.wholesale_customers (id,unique_name,created_by_user_id,salesman_commission_cohort)
          values ('${id}','Customer-${id}','${learningUser.id}','new');
        insert into public.wholesale_orders (id,order_number,customer_id,created_by_user_id,ordered_at,order_month)
          values ('${id}','${name}','${id}','${learningUser.id}','2025-03-01 00:05:00+08','2025-03-01');
        commit;`);
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/wholesale/orders");
      const filter = messages.UiText.components_dashboard_wholesale_wholesale_order_filters;
      const search = page.getByPlaceholder(filter.attribute002);
      await search.fill(name);
      await search.press("Enter");
      const order = page.getByTestId(width === 390 ? `wholesale-order-card-${id}` : `wholesale-order-row-${id}`);
      await expect(order.getByText(name, { exact: true })).toBeVisible();

      const button = page.getByRole("button", { name: copy.generate, exact: true });
      const [started] = await Promise.all([
        page.waitForRequest("**/api/wholesale/order-assessment", { timeout: 15_000 }),
        button.click({ timeout: 10_000 }),
      ]);
      const firstPayload = started.postDataJSON();
      const output = page.getByTestId("wholesale-order-assessment-output");
      await expect(page.getByRole("button", { name: copy.pending, exact: true })).toBeDisabled();
      await expect(output).toHaveText(responseText);
      await expect(button).toBeEnabled();
      // 关键词也会写进筛选说明，所以必须从样例和全量合计分别确认是否命中旧订单。
      expect(prompts[0].split("订单样例：")[1]).toContain(name);
      expect(prompts[0]).toContain('"订单数量": 1');
      expect(readRuns(learningUser.id)).toMatchObject([{
        status: "succeeded", succeeded_count: 1, failed_count: 0,
        idempotency_key: firstPayload.requestId,
        result_proof: { completed: true, contentLength: responseText.length },
      }]);

      const duplicate = await page.request.post("/api/wholesale/order-assessment", { data: firstPayload });
      expect(duplicate.status()).toBe(409);
      expect(prompts).toHaveLength(1);
      expect(readRuns(learningUser.id)).toHaveLength(1);
      // 结果可见时，中心点应能实际命中结果区域，不能只落在被固定页头盖住的视口内。
      await expect.poll(() => output.evaluate((element) => {
        element.scrollIntoView({ block: "center", behavior: "instant" });
        const bounds = element.getBoundingClientRect();
        const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        return element.contains(hit);
      })).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("assessment-complete.png"), animations: "disabled", fullPage: true });

      // 缺结束事件和收到空正文是两种失败，均不能留下生成结果。
      for (const attempt of [2, 3]) {
        await button.click();
        await expect(page.getByRole("alert").filter({ hasText: copy.failed })).toBeVisible();
        await expect(button).toBeEnabled();
        await expect(output).toHaveCount(0);
        expect(prompts).toHaveLength(attempt);
      }
      const expectedRuns = locale === "zh" ? 4 : 3;
      if (locale === "zh") {
        await button.click();
        await expect(page.getByRole("button", { name: copy.pending, exact: true })).toBeDisabled();
        await expect(page.getByRole("alert").filter({ hasText: copy.failed })).toBeVisible({ timeout: 40_000 });
        await expect(button).toBeEnabled();
        await expect(output).toHaveCount(0);
      }
      const runs = readRuns(learningUser.id);
      expect(runs).toHaveLength(expectedRuns);
      for (const run of runs.slice(1)) {
        expect(run).toMatchObject({ succeeded_count: 0, failed_count: 1 });
        expect(["failed", "needs_attention"]).toContain(run.status);
      }
      const missing = await page.request.post("/api/wholesale/order-assessment", {
        data: { requestId: randomUUID(), filters: { ...firstPayload.filters, searchText: `Missing-${id}` } },
      });
      expect(missing.status()).toBe(400);
      expect(prompts).toHaveLength(expectedRuns);
      await expect.poll(() => executeLearningSql(`select count(*) from private.api_request_quota_events
        where user_id='${learningUser.id}' and released_at is null;`)).toBe("0");
      await page.reload();
      await expect(output).toHaveCount(0);
      expect(readRuns(learningUser.id)).toEqual(runs);
      await search.fill(`Missing-${id}`);
      await search.press("Enter");
      await expect(button).toBeDisabled();
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await writeFile(testInfo.outputPath("assessment-receipts.json"), JSON.stringify(runs, null, 2));
    } finally {
      try {
        cleanupRuns(learningUser.id);
        executeLearningSql(`begin;
          delete from public.wholesale_orders where id='${id}' and created_by_user_id='${learningUser.id}';
          delete from public.wholesale_customers where id='${id}' and created_by_user_id='${learningUser.id}';
          commit;`);
        expect(executeLearningSql(`select count(*) from public.wholesale_customers where id='${id}';`)).toBe("0");
      } finally {
        mock.closeAllConnections();
        await new Promise<void>((resolve, reject) => mock.close((error) => error ? reject(error) : resolve()));
      }
    }
  });
}

test.describe("客户没有内部评估权限", () => {
  test.use({ learningRole: "client" });
  test("页面不展示入口，直接请求也不创建运行", async ({ page, learningUser }) => {
    try {
      await loginLearningUser(page, learningUser);
      await page.goto("/client/wholesale/orders");
      await expect(page.getByRole("button", { name: zh.WholesaleBusiness.ordersUi.assessment.generate, exact: true })).toHaveCount(0);
      const response = await page.request.post("/api/wholesale/order-assessment", {
        data: { requestId: randomUUID(), filters: { searchText: "owned-learning-check" } },
      });
      expect(response.status()).toBe(403);
      expect(readRuns(learningUser.id)).toEqual([]);
    } finally {
      cleanupRuns(learningUser.id);
    }
  });
});
