import { startLoopbackBoundary } from "../../test-support/loopback-http-boundary";

/** 飞书同意页由浏览器拦截；服务端令牌与身份请求由此边界处理，绑定仍真实写入 Docker。 */
export async function startFeishuBoundary(port = 4110) {
  const state = {
    mode: "ok" as "ok" | "tokenFailure" | "timeout",
    tokens: 0,
    profiles: 0,
    openId: "local-feishu-admin",
  };
  const server = await startLoopbackBoundary(async (request, response) => {
    for await (const chunk of request) void chunk;
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/open-apis/authen/v2/oauth/token") {
      state.tokens++;
      if (state.mode === "timeout") return;
      return response.end(
        JSON.stringify(
          state.mode === "tokenFailure"
            ? { error_description: "private-provider-error" }
            : { access_token: "local-feishu-access" },
        ),
      );
    }
    if (request.url === "/open-apis/authen/v1/user_info") {
      state.profiles++;
      return response.end(
        JSON.stringify({
          code: 0,
          data: { open_id: state.openId, name: "Local Feishu" },
        }),
      );
    }
    response.statusCode = 404;
    response.end("{}");
  }, port);
  return { server, state };
}
