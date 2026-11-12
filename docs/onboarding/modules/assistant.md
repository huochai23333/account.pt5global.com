# 工作台 AI 助手

当前范围：共享。

## 业务与阅读顺序

从工作台右下角打开助手，询问入口与操作流程。管理员和财务可以准备并确认结汇发布。

数据流：助手面板 → `/api/assistant/chat` 校验账号与输入 → 普通问答取得配额、写运行账本、读取 DeepSeek 流；结汇指令走本地确认和独立发布入口。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

服务端只接受启用账号。结汇确认和发布分别校验管理员或财务身份。模型只取得导航说明和可读对话历史。

完成依据：问答要求非空正文、供应商终止事件、`private.operation_runs` 的成功凭证。结汇发布另核对记录编号和收款内容。

## 常见维护

见[助手请求、断流和业务凭证](../explanation/assistant-chat-flow.md)。调整提示词、供应商协议和结汇指令分别进入对应文件。

验证入口：npm run test:assistant-stream；按本地模拟前提运行 npm run test:learning:browser -- assistant-chat-stream；结汇原套件按准入执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：本模块未发现字面量函数调用，沿服务导入继续追踪。

源码中直接引用的数据表/存储桶：本模块未发现字面量 from 调用。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: scripts/assistant-event-stream.test.mjs](../../../scripts/assistant-event-stream.test.mjs)
- [web: tests/learning/assistant-chat-stream.spec.ts](../../../tests/learning/assistant-chat-stream.spec.ts)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/api/assistant/chat/chat-error-response.ts](../../../app/api/assistant/chat/chat-error-response.ts) | 已审拆分：错误码与 HTTP 状态映射 |
| [app/api/assistant/chat/chat-generation.ts](../../../app/api/assistant/chat/chat-generation.ts) | 已审拆分：取得和释放生成配额；创建和结算运行账本；调度供应商流与请求时限 |
| [app/api/assistant/chat/chat-input.ts](../../../app/api/assistant/chat/chat-input.ts) | 已审拆分：请求体体积限制；对话字段校验与归一 |
| [app/api/assistant/chat/chat-settlement-response.ts](../../../app/api/assistant/chat/chat-settlement-response.ts) | 已审拆分：识别结汇指令并构造确认资料；确认分支的角色门禁 |
| [app/api/assistant/chat/route.ts](../../../app/api/assistant/chat/route.ts) | 已审拆分：校验登录状态和输入；选择站内指令或问答生成 |
| [app/api/assistant/settlement-release/route.ts](../../../app/api/assistant/settlement-release/route.ts) | 已审保留：校验身份与动作；调度结汇发布服务；返回发布编号或明确错误 |
| [components/dashboard/ai-assistant/ai-assistant-client.tsx](../../../components/dashboard/ai-assistant/ai-assistant-client.tsx) | 已审拆分：助手面板开合和 Escape；组合会话 Hook 与面板 |
| [components/dashboard/ai-assistant/ai-assistant-history.ts](../../../components/dashboard/ai-assistant/ai-assistant-history.ts) | 已审保留：生成用户可读对话历史 |
| [components/dashboard/ai-assistant/ai-assistant-panel.tsx](../../../components/dashboard/ai-assistant/ai-assistant-panel.tsx) | 已审拆分：新对话确认和面板关闭；消息列表及滚动反馈；问题输入与提交 |
| [components/dashboard/ai-assistant/ai-assistant-request.ts](../../../components/dashboard/ai-assistant/ai-assistant-request.ts) | 已审拆分：发送与读取聊天请求；映射接口错误为日常语言 |
| [components/dashboard/ai-assistant/ai-assistant-response.ts](../../../components/dashboard/ai-assistant/ai-assistant-response.ts) | 已审拆分：校验结构化响应；构造消息和待确认卡 |
| [components/dashboard/ai-assistant/ai-assistant-ui-types.ts](../../../components/dashboard/ai-assistant/ai-assistant-ui-types.ts) | 已审保留：定义 AiAssistantSettlementReleaseState、AiAssistantUiMessage 等3项同模块类型合同 |
| [components/dashboard/ai-assistant/use-ai-assistant-chat.ts](../../../components/dashboard/ai-assistant/use-ai-assistant-chat.ts) | 已审拆分：管理对话与输入状态；调度普通请求、重复提交和中断；组合结汇确认 Hook |
| [components/dashboard/ai-assistant/use-ai-assistant-copy.ts](../../../components/dashboard/ai-assistant/use-ai-assistant-copy.ts) | 已审拆分：构造助手面板和确认卡双语文案 |
| [lib/ai-assistant/assistant-event-stream.ts](../../../lib/ai-assistant/assistant-event-stream.ts) | 已审保留：客户端流事件与终态校验 |
| [lib/ai-assistant/assistant-prompt.ts](../../../lib/ai-assistant/assistant-prompt.ts) | 已审保留：组织模型消息与系统提示 |
| [lib/ai-assistant/assistant-types.ts](../../../lib/ai-assistant/assistant-types.ts) | 已审保留：定义 AiAssistantMessageRole、AiAssistantChatMessage 等13项同模块类型合同 |
| [lib/ai-assistant/assistant-workspace-context.ts](../../../lib/ai-assistant/assistant-workspace-context.ts) | 已审保留：当前角色入口说明；当前页面匹配；按角色提供业务提示 |
| [lib/ai-assistant/deepseek-client.ts](../../../lib/ai-assistant/deepseek-client.ts) | 已审拆分：供应商请求边界；SSE 与内部事件转换；回调和流收尾 |
