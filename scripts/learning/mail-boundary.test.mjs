import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { request } from "node:http";
import test from "node:test";

// 只允许这一组纯模拟模块相互解析；不加载账号、数据库管理入口或 Playwright 环境。
const files = [
  "tests/test-support/loopback-http-boundary.ts",
  "tests/e2e/helpers/mail-boundary-mock-server.ts",
  "tests/e2e/helpers/mail-boundary-state.ts",
  "tests/e2e/helpers/mail-gmail-boundary.ts",
  "tests/e2e/helpers/mail-oauth-boundary.ts",
  "tests/e2e/helpers/mail-feishu-boundary.ts",
];
const allowed = new Set(
  files.map((file) => new URL("../../" + file, import.meta.url).href),
);
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (allowed.has(context.parentURL) && specifier.startsWith(".")) {
      const target = new URL(specifier + ".ts", context.parentURL).href;
      assert(allowed.has(target), "模拟检查不得跨入未审查的入口");
      return nextResolve(target, context);
    }
    return nextResolve(specifier, context);
  },
});
let http, mail, state, oauth, feishu;
try {
  [http, mail, state, oauth, feishu] = await Promise.all([
    import("../../tests/test-support/loopback-http-boundary.ts"),
    import("../../tests/e2e/helpers/mail-boundary-mock-server.ts"),
    import("../../tests/e2e/helpers/mail-boundary-state.ts"),
    import("../../tests/e2e/helpers/mail-oauth-boundary.ts"),
    import("../../tests/e2e/helpers/mail-feishu-boundary.ts"),
  ]);
} finally {
  hook.deregister();
}

function origin(server) {
  return "http://127.0.0.1:" + server.address().port;
}

async function json(server, pathname, body) {
  const response = await fetch(
    origin(server) + pathname,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  assert.equal(response.status, 200);
  return response.json();
}

async function withMail(run) {
  const server = await mail.startMailBoundaryMockServer(0);
  try {
    await run(server);
  } finally {
    await http.closeLoopbackBoundary(server);
  }
}

test("损坏 JSON 和非对象返回 400，服务继续处理后续请求", () =>
  withMail(async (server) => {
    for (const body of ["{private-value", "null", "[]"]) {
      const response = await fetch(
        origin(server) + "/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        },
      );
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: "invalid-json" });
    }
    assert.deepEqual(state.getMailBoundaryState().sent, []);
    assert.deepEqual(await json(server, "/scan"), {
      clean: true,
      engine: "local-regression",
    });
  }));

test("Gmail 编号和 SENT 凭证分别核对，丢失标签不能算已发送", () =>
  withMail(async (server) => {
    for (const [raw, verified] of [
      ["Hello", true],
      ["BROKEN RECEIPT", false],
    ]) {
      const sent = await json(server, "/gmail/v1/users/me/messages/send", {
        raw: Buffer.from(raw).toString("base64url"),
        threadId: "own-thread",
      });
      const receipt = await json(
        server,
        "/gmail/v1/users/me/messages/" + sent.id,
      );
      assert.equal(receipt.threadId, "own-thread");
      assert.deepEqual(receipt.labelIds, verified ? ["SENT"] : []);
    }
    const snapshot = state.getMailBoundaryState();
    assert.deepEqual(
      snapshot.sent.map((row) => row.verifiedInSent),
      [true, false],
    );
    snapshot.sent.length = 0;
    assert.equal(state.getMailBoundaryState().sent.length, 2);
  }));

test("来信和附件按编号读取，克隆输入且只统计成功下载", () =>
  withMail(async (server) => {
    const message = {
      id: "inbound/one",
      threadId: "inbound-thread",
      from: "a@example.test",
      to: "b@example.test",
      subject: "Test",
      text: "Hello",
      attachment: {
        id: "attachment/one",
        filename: "fixture.txt",
        contentType: "text/plain",
        content: "测试附件",
      },
    };
    assert.equal(state.queueMailBoundaryInbound(message), "101");
    message.text = "changed";
    const history = await json(server, "/gmail/v1/users/me/history");
    assert.equal(history.historyId, "101");
    const base =
      "/gmail/v1/users/me/messages/" + encodeURIComponent(message.id);
    const inbound = await json(server, base);
    assert.equal(
      Buffer.from(inbound.payload.parts[0].body.data, "base64url").toString(),
      "Hello",
    );
    const attachment = await json(
      server,
      base + "/attachments/" + encodeURIComponent(message.attachment.id),
    );
    assert.equal(
      Buffer.from(attachment.data, "base64url").toString(),
      "测试附件",
    );
    assert.equal(attachment.size, Buffer.byteLength("测试附件"));
    assert.equal(
      (await fetch(origin(server) + base + "/attachments/missing")).status,
      404,
    );
    assert.equal(state.getMailBoundaryState().attachmentFetches, 1);
  }));

test("AI 流和飞书消息仅返回模拟凭证，未知路径结束为 404", () =>
  withMail(async (server) => {
    for (const [prompt, expected] of [
      ["运营分析", "本期询盘稳定"],
      ["draft", "prepare a quotation"],
    ]) {
      const response = await fetch(origin(server) + "/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [{ content: prompt }] }),
      });
      assert.equal(response.headers.get("content-type"), "text/event-stream");
      const events = await response.text();
      assert(events.includes(expected));
      assert(events.endsWith("data: [DONE]\n\n"));
    }
    const token = await json(
      server,
      "/open-apis/auth/v3/tenant_access_token/internal",
      {},
    );
    assert.equal(token.code, 0);
    const message = await json(server, "/open-apis/im/v1/messages", {});
    assert.deepEqual(state.getMailBoundaryState().feishuMessageIds, [
      message.data.message_id,
    ]);
    assert.equal((await fetch(origin(server) + "/missing")).status, 404);
  }));

test("端口冲突作为拒绝返回，保留已有服务的模拟凭证", () =>
  withMail(async (server) => {
    await json(server, "/gmail/v1/users/me/messages/send", { raw: "" });
    const before = state.getMailBoundaryState();
    await assert.rejects(
      mail.startMailBoundaryMockServer(server.address().port),
      { code: "EADDRINUSE" },
    );
    assert.deepEqual(state.getMailBoundaryState(), before);
    await json(server, "/scan");
  }));

test("未知处理异常结束为 500，错误内容不回显", async () => {
  const server = await http.startLoopbackBoundary(async () => {
    throw Error("private-provider-secret");
  }, 0);
  try {
    const response = await fetch(origin(server));
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "boundary-request-failed",
    });
  } finally {
    await http.closeLoopbackBoundary(server);
  }
});

test("已开始流式输出再失败时关闭连接，不追加错误 JSON", async () => {
  const server = await http.startLoopbackBoundary((_, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.write("partial");
    throw Error("private-stream-error");
  }, 0);
  try {
    await assert.rejects(async () => {
      const response = await fetch(origin(server));
      await response.text();
    });
  } finally {
    await http.closeLoopbackBoundary(server);
  }
});

test("读取正文时客户端中断，后续请求仍可正常结束", () =>
  withMail(async (server) => {
    await new Promise((resolve, reject) => {
      const socket = request(origin(server) + "/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      socket.on("error", (error) =>
        error.code === "ECONNRESET" ? resolve() : reject(error),
      );
      socket.write("{");
      // finish 不会发生：这里专门模拟尚未提交完整正文就断开连接。
      socket.on("socket", (connection) =>
        connection.once("connect", () => socket.destroy()),
      );
    });
    assert.deepEqual(await json(server, "/scan"), {
      clean: true,
      engine: "local-regression",
    });
  }));

test("Google 授权模拟保持状态、令牌、身份和 watch 失败分支", async () => {
  const { server, state: boundary } = await oauth.startOAuthBoundary(0);
  try {
    const consent = new URL(origin(server) + "/google-oauth/authorize");
    consent.searchParams.set("redirect_uri", "http://localhost:3000/callback");
    consent.searchParams.set("state", "local-test-state");
    const html = await (await fetch(consent)).text();
    assert(
      html.includes("code=local-one-time-code&amp;state=local-test-state"),
    );
    assert.equal((await fetch(origin(server) + "/favicon.ico")).status, 204);
    for (const mode of [
      "ok",
      "tokenFailure",
      "scope",
      "account",
      "watchFailure",
      "saveFailure",
    ]) {
      boundary.mode = mode;
      const token = await json(server, "/google-oauth/token", {});
      assert.equal(Boolean(token.refresh_token), mode !== "tokenFailure");
      assert.equal(token.scope.includes("gmail.modify"), mode !== "scope");
      const profile = await json(server, "/google-oauth/userinfo");
      assert.equal(profile.email === "wrong@example.test", mode === "account");
      assert.equal(
        profile.sub === "conflicting-mailbox-subject",
        mode === "saveFailure",
      );
      const watch = await json(server, "/gmail/v1/users/me/watch", {});
      assert.equal(watch.expiration === "invalid", mode === "watchFailure");
    }
    assert.equal(boundary.tokens, 6);
    assert.equal(boundary.watches, 6);
  } finally {
    await http.closeLoopbackBoundary(server);
  }
});

test("飞书令牌失败与身份响应保持独立计数", async () => {
  const { server, state: boundary } = await feishu.startFeishuBoundary(0);
  try {
    assert.equal(
      (await json(server, "/open-apis/authen/v2/oauth/token", {})).access_token,
      "local-feishu-access",
    );
    boundary.mode = "tokenFailure";
    assert.equal(
      (await json(server, "/open-apis/authen/v2/oauth/token", {}))
        .error_description,
      "private-provider-error",
    );
    boundary.openId = "another-local-id";
    assert.equal(
      (await json(server, "/open-apis/authen/v1/user_info")).data.open_id,
      "another-local-id",
    );
    assert.equal(boundary.tokens, 2);
    assert.equal(boundary.profiles, 1);
    assert.equal((await fetch(origin(server) + "/missing")).status, 404);
  } finally {
    await http.closeLoopbackBoundary(server);
  }
});

test("Google 和飞书超时确实悬挂，回收后端口可以重新绑定", async () => {
  for (const [start, pathname] of [
    [oauth.startOAuthBoundary, "/google-oauth/token"],
    [feishu.startFeishuBoundary, "/open-apis/authen/v2/oauth/token"],
  ]) {
    const { server, state: boundary } = await start(0);
    const port = server.address().port;
    try {
      boundary.mode = "timeout";
      await assert.rejects(
        fetch(origin(server) + pathname, {
          method: "POST",
          signal: AbortSignal.timeout(100),
        }),
        { name: "TimeoutError" },
      );
      assert.equal(boundary.tokens, 1);
    } finally {
      await http.closeLoopbackBoundary(server);
    }
    assert.equal(server.listening, false);
    const replacement = await http.startLoopbackBoundary(
      (_, response) => response.end(),
      port,
    );
    await http.closeLoopbackBoundary(replacement);
  }
});
