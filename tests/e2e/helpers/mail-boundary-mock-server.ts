import {
  readBoundaryJson,
  startLoopbackBoundary,
  writeBoundaryJson as json,
} from "../../test-support/loopback-http-boundary";
import {
  mailBoundaryState as state,
  resetMailBoundaryState,
} from "./mail-boundary-state";
import { handleGmailBoundary } from "./mail-gmail-boundary";

/** 只模拟外部供应商；应用、Worker、数据库与 Storage 仍应走真实本地实现。 */
export async function startMailBoundaryMockServer(port = 4110) {
  const server = await startLoopbackBoundary(async (request, response) => {
    const body = await readBoundaryJson(request);
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname.startsWith("/gmail/v1/"))
      return handleGmailBoundary(url, body, response);
    if (url.pathname === "/scan")
      return json(response, { clean: true, engine: "local-regression" });
    if (url.pathname === "/chat/completions") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream");
      const prompt = JSON.stringify(body.messages ?? []);
      const content = prompt.includes("运营分析")
        ? "本期询盘稳定，建议优先处理待回复会话。"
        : "Hello, thank you for your inquiry. We can prepare a quotation for 500 units.";
      response.end(
        `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`,
      );
      return;
    }
    if (url.pathname === "/open-apis/auth/v3/tenant_access_token/internal") {
      return json(response, {
        code: 0,
        tenant_access_token: "local-feishu-token",
      });
    }
    if (url.pathname === "/open-apis/im/v1/messages") {
      const messageId = `feishu-${state.feishuMessageIds.length + 1}`;
      state.feishuMessageIds.push(messageId);
      return json(response, { code: 0, data: { message_id: messageId } });
    }
    return json(response, { error: "not found" }, 404);
  }, port);
  // 端口冲突时保留已经运行的服务状态，不能在启动失败前清空它的凭证。
  resetMailBoundaryState();
  return server;
}
