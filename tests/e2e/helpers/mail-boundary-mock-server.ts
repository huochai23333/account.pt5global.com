import { createServer, type Server } from "node:http";

type SentReceipt = { messageId: string; threadId: string; verifiedInSent: boolean; raw: string };

const state: { sent: SentReceipt[]; feishuMessageIds: string[] } = { sent: [], feishuMessageIds: [] };

export function resetMailBoundaryState() {
  state.sent = [];
  state.feishuMessageIds = [];
}

export function getMailBoundaryState() {
  return structuredClone(state);
}

function json(response: import("node:http").ServerResponse, value: unknown, status = 200) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(value));
}

/**
 * 只模拟系统外部边界，邮件列表、指派、任务和最终状态仍由本地 Supabase 真实保存。
 * 这样测试可以故意让 Gmail 返回编号却缺少 SENT 标签，验证页面不会误报成功。
 */
export function startMailBoundaryMockServer(port = 4110) {
  resetMailBoundaryState();
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const rawBody = Buffer.concat(chunks).toString("utf8");
    const body = rawBody && request.headers["content-type"]?.includes("application/json")
      ? JSON.parse(rawBody) as Record<string, unknown>
      : {};
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);

    if (url.pathname === "/scan") return json(response, { clean: true, engine: "local-regression" });
    if (url.pathname === "/chat/completions") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream");
      const prompt = JSON.stringify(body.messages ?? []);
      const content = prompt.includes("运营分析")
        ? "本期询盘稳定，建议优先处理待回复会话。"
        : "Hello, thank you for your inquiry. We can prepare a quotation for 500 units.";
      response.end(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`);
      return;
    }
    if (url.pathname === "/gmail/v1/users/me/messages/send") {
      const raw = Buffer.from(String(body.raw ?? ""), "base64url").toString("utf8");
      const messageId = `gmail-${state.sent.length + 1}`;
      const threadId = typeof body.threadId === "string" ? body.threadId : `gmail-thread-${state.sent.length + 1}`;
      state.sent.push({ messageId, threadId, verifiedInSent: !raw.includes("BROKEN RECEIPT"), raw });
      return json(response, { id: messageId, threadId });
    }
    const messageMatch = url.pathname.match(/^\/gmail\/v1\/users\/me\/messages\/(gmail-\d+)$/);
    if (messageMatch) {
      const receipt = state.sent.find((item) => item.messageId === messageMatch[1]);
      if (!receipt) return json(response, { error: "not found" }, 404);
      return json(response, { id: receipt.messageId, threadId: receipt.threadId, labelIds: receipt.verifiedInSent ? ["SENT"] : [] });
    }
    if (url.pathname === "/open-apis/auth/v3/tenant_access_token/internal") {
      return json(response, { code: 0, tenant_access_token: "local-feishu-token" });
    }
    if (url.pathname === "/open-apis/im/v1/messages") {
      const messageId = `feishu-${state.feishuMessageIds.length + 1}`;
      state.feishuMessageIds.push(messageId);
      return json(response, { code: 0, data: { message_id: messageId } });
    }
    return json(response, { error: "not found" }, 404);
  });
  return new Promise<Server>((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
