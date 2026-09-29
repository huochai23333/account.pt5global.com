import { createServer } from "node:http";

type Mode = "ok" | "tokenFailure" | "scope" | "account" | "watchFailure" | "saveFailure" | "timeout";
/** 只替换 Google 外部接口，授权状态和邮箱凭据仍由本地 Supabase 真正保存。 */
export function startOAuthBoundary() {
  const state = { mode: "ok" as Mode, tokens: 0, watches: 0 };
  const server = createServer(async (request, response) => {
    for await (const chunk of request) void chunk;
    response.setHeader("Content-Type", "application/json");
    const json = (value: unknown) => response.end(JSON.stringify(value));
    const url = new URL(request.url!, "http://127.0.0.1:4110");
    if (url.pathname === "/favicon.ico") { response.statusCode = 204; return response.end(); }
    if (url.pathname === "/google-oauth/authorize") {
      const callback = new URL(url.searchParams.get("redirect_uri")!);
      callback.searchParams.set("code", "local-one-time-code");
      callback.searchParams.set("state", url.searchParams.get("state")!);
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      return response.end(`<html><body><h1>本地 Google 授权边界</h1><a href="${callback.toString().replaceAll("&", "&amp;")}">允许连接</a></body></html>`);
    }
    if (request.url === "/google-oauth/token") {
      state.tokens++;
      if (state.mode === "timeout") return;
      return json({ access_token: "local-oauth-new-access", refresh_token: state.mode === "tokenFailure" ? undefined : "local-oauth-new-refresh",
        expires_in: 3600, scope: state.mode === "scope" ? "openid email" : "openid email https://www.googleapis.com/auth/gmail.modify" });
    }
    if (request.url === "/google-oauth/userinfo") return json({ sub: state.mode === "saveFailure" ? "conflicting-mailbox-subject" : "local-shared-mailbox",
      email: state.mode === "account" ? "wrong@example.test" : "chinapt5@gmail.com", email_verified: true });
    if (request.url === "/gmail/v1/users/me/watch") {
      state.watches++;
      return json(state.mode === "watchFailure" ? { expiration: "invalid" } : { historyId: "901", expiration: String(Date.now() + 6 * 86400_000) });
    }
    response.statusCode = 404;
    return json({ error: "unknown-test-boundary" });
  });
  return new Promise<{ server: typeof server; state: typeof state }>((resolve) => server.listen(4110, "127.0.0.1", () => resolve({ server, state })));
}
