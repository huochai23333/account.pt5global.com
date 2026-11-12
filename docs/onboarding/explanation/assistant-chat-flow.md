# 工作台助手请求与运行凭证

从工作台首页右下角打开 PT5 助手。`AiAssistantClient` 管理面板开合，`useAiAssistantChat` 管理本次页面的对话，`ai-assistant-request.ts` 读取流或结汇确认卡。收起面板保留当前对话，刷新会回到欢迎语。已写入的运行记录仍可按请求编号核对。

## 普通问答

1. `POST /api/assistant/chat` 从服务端确认账号状态，再由 `chat-input.ts` 限制正文体积与历史长度。
2. `chat-generation.ts` 使用用户身份调用 `acquire_api_request_quota`，再通过 `create_service_operation_run` 登记运行。相同的请求编号触发确认中响应，不再调用模型。
3. `assistant-prompt.ts` 和 `assistant-workspace-context.ts` 根据实际角色与导航配置准备提示。普通问答发往 DeepSeek，内容包含问题、可读历史和导航说明。结汇卡曾显示的客户、金额和备注可能作为可读历史进入问答，内部客户编号和确认编号留在应用里。
4. `deepseek-client.ts` 接收供应商流。正文非空且收到 `[DONE]` 后，调用方先用 `finish_operation_attempt_checked` 记录 `succeeded` 和 `completed`、`contentLength`，浏览器才有完成事件。断流或超时写入 `failed`，页面清除未完成的回答。浏览器断开时继续完成相应账本写入，随后通过 `release_api_request_quota` 释放配额。已经开始持久化的完整回答继续走原结算。

独立排查以 `private.operation_runs` 的 `operation_key = 'ai-assistant-generation'`、`idempotency_key`、`status`、`result_proof` 和关联的 `private.operation_attempts` 为准；并发配额见 `private.api_request_quota_events.released_at`。这是运行凭证，刷新后的欢迎语属于页面会话。

供应商用 `data: [DONE]` 结束增量流。项目当前默认模型名 `deepseek-v4-flash` 由供应商临时转到 V4.1 Flash。实际供应商可用性仍待验收。[DeepSeek 流协议](https://api-docs.deepseek.com/api/create-chat-completion/) · [DeepSeek 模型变更](https://api-docs.deepseek.com/updates/)

## 结汇指令

`chat-settlement-response.ts` 解析明确指令并校验管理员或财务角色。`find_wholesale_settlement_customer_matches` 查找客户，只准备结构化确认卡。用户明确点击发布时，`POST /api/assistant/settlement-release` 再次校验身份和动作，由 `create_wholesale_settlement_release` 创建记录。核对结汇发布编号及收款内容。问答的运行凭证与实际收款发布分开。

[原助手结汇套件](../../../tests/e2e/ai-assistant-settlement-release.spec.ts)分三组。财务发布正式和临时收款，原日期与币种解析及业务员权限检查，管理员从客户页面创建两条歧义别名再删除。先按[原测试准入](../../real-e2e-blockers.md)准备独占项目、活跃管理员/财务/业务员和当前业务参数。客户、收款、订单、报价、任务、客户档案和 AI 配额的测试范围须为空。前两组由夹具准备一条带 Alpha Shop 别名的客户。

正式确认 12.34 USD 和临时确认 708.27 USD 都用回包的收款编号和卡片原请求号核对数据库。取消卡片没有发布请求。503 只拦截指定卡片，恢复后的发布沿用原请求号。页面刷新再次核对原收款，独立确认版本未变。歧义组还核对创建和删除的客户、档案、根目录。每组查看任务与配额完整快照。

助手结汇入口复用下方临时探针。探针同时比较实际 Web 服务端所用的 Supabase 地址和本次专属网关地址。结汇用例占用本机 4110，对意外模型调用返回固定 503 并计数。准备好同一 Web 服务后设置 `PLAYWRIGHT_SKIP_WEB_SERVER=1`，运行 `npm run test:e2e -- tests/e2e/ai-assistant-settlement-release.spec.ts --workers=1`。定向凭证回归为 `node --test scripts/learning/assistant-settlement-fixture.test.mjs`。原页面和定向验证结果见[助手结汇验证报告](../reference/verification-2026-11-11-assistant-settlement.md)。

## 本地验证

`npm run test:assistant-stream` 覆盖流终态、分片、空正文以及中断时账本回写与配额释放的顺序。`npm run test:learning:browser -- assistant-chat-stream` 是本地混合集成，使用真实页面、Auth、应用服务端与数据库，供应商边界替换为本机 HTTP 流。

运行浏览器用例前，确认本项目只有一个开发服务，计划任务已暂停，外部请求队列为空。复用已经设置 `DEEPSEEK_BASE_URL=http://127.0.0.1:4110` 与专用假令牌 `DEEPSEEK_API_KEY=pt5-learning-assistant` 的服务。如需更换该进程的环境，先停止它，再按本地启动手册启动一个服务。端口 4110 由测试监听。临时创建 `app/api/learning-mail-ai-probe/route.ts` 验证当前运行进程的配置，探针只返回布尔值。

```ts
export function GET(request: Request) {
  const url = new URL(request.url);
  if (process.env.NODE_ENV !== "development" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    return new Response(null, { status: 404 });
  }

  // 只确认专用本机地址和练习令牌，从响应中无法读出配置值。
  const localMock = process.env.DEEPSEEK_BASE_URL === "http://127.0.0.1:4110" &&
    process.env.DEEPSEEK_API_KEY === "pt5-learning-assistant";
  const expectedApi = url.searchParams.get("expectedApi");
  if (!expectedApi) return Response.json({ localMock });
  let sameProject = false;
  try {
    const expected = new URL(expectedApi);
    const actual = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    sameProject = ["localhost", "127.0.0.1", "[::1]"].includes(expected.hostname) &&
      expected.protocol === "http:" && !!expected.port && !expected.username &&
      !expected.password && expected.pathname === "/" && !expected.search &&
      !expected.hash && actual.href === expected.href;
  } catch {
    // 无效地址只返回 false。
  }
  return Response.json({ localMock, sameProject });
}
```

```powershell
$env:PT5_LEARNING_ASSISTANT_MOCK = '1'
npm run test:learning:browser -- assistant-chat-stream
```

退出测试后移除上述临时探针和本终端的 `PT5_LEARNING_ASSISTANT_MOCK`。专属测试账号及账本由夹具清理。日志中的运行编号与截图可保留作为本地验收证据。
