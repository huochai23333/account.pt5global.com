import { createServer } from "node:http";
import { once } from "node:events";
import type { Page } from "@playwright/test";
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql } from "../../scripts/learning/local-fixture-session.mjs";
import { expect } from "./fixtures";

const origin = "http://localhost:3000";
const copy = zh.MailWorkspace;

export async function verifyReplyDraftScope(page: Page, userId: string, threadId: string, subject: string, otherSubject: string) {
  const endpoint = "**/api/mail/ai/reply";
  const suggestion = "Learning suggestion for the first mail";
  const enableProvider = process.env.PT5_LEARNING_MAIL_AI_MOCK === "1";
  const providerRequests: string[] = [];
  const requestIds: string[] = [];
  const ledger = () => JSON.parse(executeLearningSql(`select coalesce(json_agg(r order by created_at),'[]') from (
    select id,idempotency_key,status,result_proof,created_at from private.operation_runs
    where requested_by_user_id='${userId}' and operation_key='ai-assistant-generation'
  ) r;`));
  const mock = createServer(async (request, response) => {
    if (request.url !== "/chat/completions" || request.method !== "POST") {
      response.writeHead(400).end();
      return;
    }
    let raw = "";
    for await (const part of request) raw += part;
    let prompt: string | undefined;
    try {
      prompt = JSON.parse(raw).messages?.[1]?.content;
    } catch {
      response.writeHead(400).end();
      return;
    }
    // 只接收本测试的会话，避免给其他本机请求返回业务结果。
    if (typeof prompt !== "string" || !prompt.includes(subject)) {
      response.writeHead(400).end();
      return;
    }
    providerRequests.push(prompt);
    if (providerRequests.length === 4) {
      response.writeHead(503).end();
      return;
    }
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.end(`data: ${JSON.stringify({ choices: [{ delta: { content: suggestion } }] })}\n\ndata: [DONE]\n\n`);
  });
  if (enableProvider) {
    expect(await (await fetch(`${origin}/api/learning-mail-ai-probe`)).json()).toEqual({ localMock: true });
    mock.listen(4110, "127.0.0.1");
    await once(mock, "listening");
  }
  const runDelayed = async (whileWaiting: () => Promise<void>, complete = true) => {
    const captured = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const settled = Promise.withResolvers<void>();
    await page.route(endpoint, async (route) => {
      try {
        const input = route.request().postDataJSON();
        expect(input.threadId).toBe(threadId);
        requestIds.push(input.requestId);
        const response = enableProvider ? await route.fetch({ maxRetries: 0 }) : null;
        if (response) expect(response.ok()).toBe(complete);
        captured.resolve();
        await release.promise;
        if (response) await route.fulfill({ response });
        else await route.fulfill({
          contentType: "application/x-ndjson",
          body: `${JSON.stringify({ type: "delta", text: suggestion })}\n${complete ? JSON.stringify({ type: "completed", contentLength: suggestion.length }) : ""}\n`,
        });
      } finally {
        settled.resolve();
      }
    }, { times: 1 });
    try {
      await page.getByRole("button", { name: copy.suggestReply, exact: true }).click();
      await captured.promise;
      await whileWaiting();
    } finally {
      release.resolve();
    }
    await settled.promise;
    await page.evaluate(() => new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ));
  };
  const body = page.getByRole("textbox", { name: copy.body, exact: true });
  try {
    await runDelayed(async () => {
      await page.getByRole("button", { name: new RegExp(otherSubject) }).click();
      await expect(page.getByRole("heading", { name: otherSubject, exact: true })).toBeVisible();
    });
    await expect(body).toHaveValue("");
    await page.getByTestId(`mail-thread-${threadId}`).click();
    await expect(page.getByRole("heading", { name: subject, exact: true })).toBeVisible();
    await runDelayed(async () => { await body.fill("Text typed while waiting"); });
    await expect(body).toHaveValue("Text typed while waiting");
    await runDelayed(async () => {});
    await expect(body).toHaveValue(suggestion);
    await runDelayed(async () => {}, false);
    await expect(page.getByText(copy.replySuggestionFailed, { exact: true })).toBeVisible();
    await expect(body).toHaveValue(suggestion);

    // 报告共享流读取器，单独用页面边界模拟确认正文不会写进回复草稿。
    const report = "Learning mail report";
    await page.getByRole("button", { name: copy.mailSettings, exact: true }).click();
    await page.route("**/api/mail/ai/report", (route) => route.fulfill({
      contentType: "application/x-ndjson",
      body: `${JSON.stringify({ type: "delta", text: report })}\n${JSON.stringify({ type: "completed", contentLength: report.length })}\n`,
    }), { times: 1 });
    await page.getByRole("button", { name: copy.generateReport, exact: true }).click();
    await expect(page.getByText(report, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: copy.workspaceInbox, exact: true }).click();
    await expect(body).toHaveValue(suggestion);
    if (!enableProvider) return null;
    const runs = ledger();
    expect(providerRequests).toHaveLength(4);
    expect(runs).toHaveLength(4);
    for (const id of requestIds.slice(0, 3)) expect(runs).toContainEqual(expect.objectContaining({
      idempotency_key: id,
      status: "succeeded",
      result_proof: { completed: true, contentLength: suggestion.length },
    }));
    const failed = runs.find((run: { idempotency_key: string }) => run.idempotency_key === requestIds[3]);
    expect(["failed", "needs_attention"]).toContain(failed?.status);
    return runs;
  } finally {
    if (enableProvider) {
      mock.closeAllConnections();
      await new Promise<void>((resolve) => mock.close(() => resolve()));
      executeLearningSql(`delete from private.operation_runs where requested_by_user_id='${userId}'
        and operation_key='ai-assistant-generation';`);
      expect(ledger()).toEqual([]);
    }
  }
}
