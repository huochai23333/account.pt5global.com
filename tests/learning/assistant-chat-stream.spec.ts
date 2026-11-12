import { once } from "node:events";
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";

import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const origin = "http://localhost:3000";
const completedText = "Learning assistant completed answer";
const interruptedText = "Learning assistant unfinished answer";
test.skip(process.env.PT5_LEARNING_ASSISTANT_MOCK !== "1", "需要显式启用本地供应商和临时配置探针");

async function assertLocalProvider() {
  const guard = await fetch(`${origin}/api/learning-mail-ai-probe`);
  expect(guard.ok).toBe(true);
  expect(await guard.json()).toEqual({ localMock: true });
}

async function startProviderFixture(runId: string) {
  const prompts: string[] = [];
  const disconnect = Promise.withResolvers<void>();
  const server = createServer(async (request, response) => {
    let raw = "";
    for await (const part of request) raw += part;
    let prompt: unknown;
    try {
      prompt = JSON.parse(raw).messages?.at(-1)?.content;
    } catch {
      response.writeHead(400).end();
      return;
    }
    // 模拟服务只响应这个账号的专属标记，不接触其他对话或真实供应商。
    if (request.method !== "POST" || request.url !== "/chat/completions" ||
        typeof prompt !== "string" || !prompt.startsWith(`${runId}:`)) {
      response.writeHead(400).end();
      return;
    }

    const mode = prompt.slice(runId.length + 1);
    prompts.push(mode);
    const text = mode === "complete" ? completedText : interruptedText;
    const chunk = JSON.stringify({ choices: [{ delta: { content: text } }] });
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.write(`data: ${chunk}\n\n`);
    if (mode === "disconnect") {
      response.once("close", () => disconnect.resolve());
      return;
    }
    response.end(mode === "complete" ? "data: [DONE]\n\n" : "");
  });

  server.listen(4110, "127.0.0.1");
  await once(server, "listening");
  return {
    prompts,
    disconnected: disconnect.promise,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

function readChatRuns(userId: string) {
  // 直接查询私有账本，避免把页面或接口的响应当作完成凭证。
  return JSON.parse(executeLearningSql(`select coalesce(json_agg(run order by created_at), '[]') from (
    select id, idempotency_key, status, result_proof, last_error_code, last_error_message, created_at,
      (select json_agg(attempt.status order by attempt.attempt_number)
       from private.operation_attempts attempt where attempt.operation_run_id=operation.id) as attempts
    from private.operation_runs operation where requested_by_user_id='${userId}' and operation_key='ai-assistant-generation'
  ) run;`));
}

function readQuota(userId: string) {
  return JSON.parse(executeLearningSql(`select json_build_object('total', count(*), 'released', count(released_at))
    from private.api_request_quota_events where user_id='${userId}' and kind='ai';`));
}

function cleanupChatRecords(userId: string) {
  // 账本保留业务留痕，删账号前先仅清理本次专属运行及其配额。
  executeLearningSql(`delete from private.operation_runs where requested_by_user_id='${userId}' and operation_key='ai-assistant-generation';`);
  executeLearningSql(`delete from private.api_request_quota_events where user_id='${userId}' and kind='ai';`);
  expect(readChatRuns(userId)).toEqual([]);
  expect(readQuota(userId)).toEqual({ total: 0, released: 0 });
}

for (const [locale, width, copy] of [
  ["zh", 1440, zh.DashboardShell.aiAssistant],
  ["en", 390, en.DashboardShell.aiAssistant],
] as const) {
  test(`工作台助手独立核对流终态与租约 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    await assertLocalProvider();

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const requestIds: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/assistant/chat") {
        requestIds.push(request.postDataJSON().requestId);
      }
    });

    const { id, runId } = learningUser;
    const provider = await startProviderFixture(runId);
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: origin }]);
      if (locale === "en") {
        await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
          await page.keyboard.press("Escape");
        });
      }
      await loginLearningUser(page, learningUser);
      await expect(page).toHaveURL(/\/admin\/home/);

      const launch = page.getByTestId("ai-assistant-launcher");
      const panel = page.getByRole("region", { name: locale === "en" ? "PT5 Assistant" : "PT5 助手", exact: true });
      const input = panel.getByRole("textbox", { name: copy.inputLabel });
      const send = panel.getByRole("button", { name: copy.send, exact: true });
      await launch.click();
      await expect(panel.getByText(copy.greeting, { exact: true })).toBeVisible();
      await expect(send).toBeDisabled();
      await input.fill(`${runId}:complete`);
      // 两个提交事件在同一帧进入真实表单，验证按钮尚未来得及禁用的窗口。
      await input.evaluate((element: HTMLTextAreaElement) => {
        element.form?.requestSubmit();
        element.form?.requestSubmit();
      });
      const completedMessage = panel.locator("[data-motion-list-item]").filter({ hasText: completedText });
      await expect(completedMessage).toHaveCSS("opacity", "1");
      await expect(input).toBeEnabled();
      await expect(panel.getByText(copy.thinking, { exact: true })).toHaveCount(0);
      // 等打开动画结束，再测量稳定边界；不同系统的子像素取整可相差 1px。
      await expect(panel).toHaveCSS("opacity", "1");
      const bounds = await panel.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight };
      });
      const heading = panel.getByRole("heading", { level: 2 });
      expect(await heading.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("assistant-completed.png") });
      expect(bounds.left).toBeGreaterThanOrEqual(-1);
      expect(bounds.top).toBeGreaterThanOrEqual(-1);
      expect(bounds.right).toBeLessThanOrEqual(bounds.width + 1);
      expect(bounds.bottom).toBeLessThanOrEqual(bounds.height + 1);
      await expect.poll(() => readQuota(id)).toEqual({ total: 1, released: 1 });
      const [success] = readChatRuns(id);
      expect(success).toMatchObject({ idempotency_key: requestIds[0], status: "succeeded", attempts: ["succeeded"], result_proof: { completed: true, contentLength: completedText.length } });

      await input.fill(`${runId}:truncated`);
      await send.click();
      await expect(panel.getByRole("alert")).toHaveText(copy.serviceUnavailable);
      await expect(panel.getByText(interruptedText, { exact: true })).toHaveCount(0);
      await expect.poll(() => readQuota(id)).toEqual({ total: 2, released: 2 });
      const [, truncated] = readChatRuns(id);
      expect(truncated).toMatchObject({ idempotency_key: requestIds[1], status: "failed", attempts: ["failed"], last_error_message: "provider_stream_incomplete" });

      await input.fill(`${runId}:disconnect`);
      await send.click();
      await expect(panel.getByText(interruptedText, { exact: true })).toBeVisible();
      await expect(panel.getByText(copy.thinking, { exact: true })).toBeVisible();
      await page.reload({ waitUntil: "domcontentloaded" });
      // 等待上限短于应用 20 秒超时，区分真实断开与供应商请求自然超时。
      await expect.poll(() => readQuota(id), { timeout: 10_000 }).toEqual({ total: 3, released: 3 });
      await provider.disconnected;
      await launch.click();
      await expect(panel.getByText(copy.greeting, { exact: true })).toBeVisible();
      await expect(panel.getByText(interruptedText, { exact: true })).toHaveCount(0);
      await expect(panel.getByText(completedText, { exact: true })).toHaveCount(0);
      const runs = readChatRuns(id);
      expect(runs).toHaveLength(3);
      expect(runs.slice(0, 2)).toEqual([success, truncated]);
      expect(runs[2]).toMatchObject({ idempotency_key: requestIds[2], status: "failed", attempts: ["failed"], last_error_message: "provider_stream_cancelled" });
      expect(provider.prompts).toEqual(["complete", "truncated", "disconnect"]);
      expect(requestIds).toHaveLength(3);
      expect(errors).toEqual([]);
      await writeFile(testInfo.outputPath("terminal-receipts.json"), JSON.stringify({ runs, quota: readQuota(id), bounds }, null, 2));
    } finally {
      await provider.close();
      cleanupChatRecords(id);
    }
  });
}

test.describe("助手结汇指令的权限", () => {
  test.use({ learningRole: "manager" });

  test("经理在刷新前后都只看到权限提示", async ({ page, learningUser }) => {
    await assertLocalProvider();
    const { id, runId } = learningUser;
    const copy = zh.DashboardShell.aiAssistant;
    await page.context().addCookies([{ name: "bs-locale", value: "zh", url: origin }]);
    await loginLearningUser(page, learningUser);

    const launch = page.getByTestId("ai-assistant-launcher");
    const input = page.getByRole("textbox", { name: copy.inputLabel });
    const checkPermission = async () => {
      await launch.click();
      await input.fill(`${runId}收款USD 12.34`);
      await input.press("Enter");
      await expect(page.getByText(copy.settlementGuidanceNotAllowed, { exact: true })).toBeVisible();
      await expect(page.getByTestId("ai-settlement-release-card")).toHaveCount(0);
      // 被拒绝的结汇指令不调用模型、不占配额，也不会写结汇收款记录。
      expect(readChatRuns(id)).toEqual([]);
      expect(readQuota(id)).toEqual({ total: 0, released: 0 });
      expect(Number(executeLearningSql(`select count(*) from public.wholesale_settlement_releases where published_by_user_id='${id}';`))).toBe(0);
    };

    try {
      await checkPermission();
      await page.reload();
      await checkPermission();
    } finally {
      cleanupChatRecords(id);
    }
  });
});
