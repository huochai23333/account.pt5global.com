# 怎样维护邮件测试与模拟服务

先分清三层：页面操作走真实本地应用；数据库与 Storage 的凭证独立读取；Gmail、飞书、扫描和 AI 由模拟服务响应。单独验证模拟协议，只能证明假服务符合用例约定，不能算页面、供应商或数据库业务通过。

数据库原入口的准备、相对包含与实际服务/浏览器角色见[邮件工作区SQL实操](../../../../PT5-dropshipping-supabase/docs/onboarding/mail-workspace-sql.md)。原入口调度规则、会话和收件三段，共享事务并独立核对最终记录；不读取受限认证助手、不执行注册/推荐重复验证。会话分页与回复报表由[另一份原SQL](../../../../PT5-dropshipping-supabase/supabase/tests/mail_thread_pagination_and_report_metrics.sql)维护，不把本入口的工作区名称当成所有邮件功能覆盖。

## 从哪个文件开始

| 修改内容 | 入口与职责 |
| --- | --- |
| 草稿、地址错误和正文超限 | [mail.spec.ts](../../../tests/e2e/mail.spec.ts)，保留原四个场景。 |
| 入口与岗位拒绝 | [mail-permissions](../../../tests/e2e/mail-permissions.spec.ts)，原八个岗位场景。 |
| 发信、AI 建议、安全附件、首次发件建档、SENT 核对 | [mail-outbound](../../../tests/e2e/mail-outbound.spec.ts)。供应商返回编号后，还须核对已发送标记和后台凭证。 |
| 本人与管理员发件设置 | [mail-sender-settings](../../../tests/e2e/mail-sender-settings.spec.ts)，核对归属、版本和刷新。 |
| 隔离、恢复、删除与零影响 | [mail-quarantine](../../../tests/e2e/mail-quarantine.spec.ts)，保留部分失败和无正文审计断言。 |
| 已联系来信与陌生来信 | [mail-inbound](../../../tests/e2e/mail-inbound.spec.ts)，[后台事件辅助](../../../tests/e2e/helpers/mail-inbound-task.ts)创建专属事件、触发任务并核对终态。 |
| 核心输入框、转交与分析 | [mail-workspace-actions](../../../tests/e2e/mail-workspace-actions.spec.ts)。 |
| 分页与次要资料失败 | [mail-numbered-pages](../../../tests/e2e/mail-numbered-pages.spec.ts)、[mail-secondary-data](../../../tests/e2e/mail-secondary-data.spec.ts)。 |

原主文件 568 行的 21 段声明（展开角色循环为 27 个场景）移至七个文件。场景 AST、原登录函数正文保持；这项对照不包含夹具生命周期。原历史文件集合继续保留，不把六个新文件伪装成历史原件。

## 准备与回收的边界

[mail-test](../../../tests/e2e/helpers/mail-test.ts)使用 Playwright 的自动夹具：先核对专用夹具声明与两个本地地址，再启动模拟服务、准备本例数据、执行用例，最后关闭所有模拟连接。所有固定数据入口都要求显式提供 `PT5_E2E_FIXTURE_MODE=disposable`、`NEXT_PUBLIC_SUPABASE_URL` 和 `PLAYWRIGHT_BASE_URL`；自动夹具还会核对当前 Playwright baseURL。声明及地址通过还不足以证明真实隔离，必须实际使用可重建的完整实例。原账号与管理员入口限制仍生效。

原邮件准备现在拆为[连接、清理、邮箱、人员、消息和场景模块](mail-fixture-data.md)，入口只调度顺序。清空整表和两个整表故障辅助不能在共享实例执行。数据职责审查、纯 SDK 传输检查和真实清理分别记录；自动夹具的 finally 不代替数据库、Storage 与完整实例回收验收。固定账号、全局规则和完整迁移测试的隔离前提相同。

模拟边界只绑定 `127.0.0.1`。默认仍为 4110；纯协议检查传 0 使用系统分配的临时端口，避免占用现有服务。邮箱模拟状态是当前串行用例的共享内存，不能并行启动多个邮箱场景；原配置固定一个 worker。快照和入站参数均克隆，断言修改不会改变服务内部数据。

## 模拟服务怎样分工

| 文件 | 意图 |
| --- | --- |
| [loopback-http-boundary](../../../tests/test-support/loopback-http-boundary.ts) | 等待监听成功，拒绝端口冲突；接住异步处理错误，回收刻意悬挂的连接。JSON 编解码与错误回包统一维护。 |
| [mail-boundary-mock-server](../../../tests/e2e/helpers/mail-boundary-mock-server.ts) | 分派 Gmail，提供扫描、AI 流与飞书通知假响应。 |
| [mail-gmail-boundary](../../../tests/e2e/helpers/mail-gmail-boundary.ts) | 发信凭证、入站 MIME 与附件读取。`BROKEN RECEIPT` 会保留供应商编号但不返回 SENT。 |
| [mail-boundary-state](../../../tests/e2e/helpers/mail-boundary-state.ts) | 保存、克隆、重置本例的模拟记录。启动失败不会清空已运行服务的记录。 |
| [mail-oauth-boundary](../../../tests/e2e/helpers/mail-oauth-boundary.ts) / [mail-feishu-boundary](../../../tests/e2e/helpers/mail-feishu-boundary.ts) | 保留原令牌、身份、权限、watch 和超时分支；不请求真实供应商。 |

旧 async request 回调遇到损坏 JSON 会产生未处理拒绝。现在对象格式错误返回固定 400，其他处理错误返回固定 500；已经开始写出的响应直接断开连接。错误内容不回显输入、令牌或内部异常。超时模式仍故意不结束请求，由调用方的等待期限和夹具回收验证失败路径。

## 公司邮箱与飞书授权原用例

[公司邮箱](../../../tests/e2e/mail-oauth.spec.ts)负责授权、失败及回程中断场景；[飞书](../../../tests/e2e/mail-feishu-oauth.spec.ts)负责管理员/业务员绑定和重复回调。合计十段测试声明、循环展开十八场景。维护时先沿页面按钮追到真实 start/callback 路由，再看 `mail_oauth_transactions`、邮箱凭据/Watch 或 `mail_feishu_bindings` 的独立读回。

两套入口在启动模拟服务前，要求 `PT5_E2E_FIXTURE_MODE=disposable`、`PLAYWRIGHT_BASE_URL`、`NEXT_PUBLIC_SUPABASE_URL`、`PT5_E2E_DATABASE_PROJECT`、`PT5_E2E_DATABASE_CONTAINER`。Playwright 的实际 baseURL 也必须一致。共享主项目不能通过：准入会检查专属数据库和网关的项目标签、运行状态、API 端口、共同网络，以及调度关闭、启用任务零、外部请求队列零。这里核对的是声明的 API/数据库，不能证明受限管理员客户端或运行中 Web 的实际配置；原认证入口限制继续生效。

凭据或绑定版本比较先拒绝查询错误、空行及空版本。修改邮箱状态和授权过期时间均要求命中指定记录，再发独立请求读回；过期时间比较毫秒值，允许 Postgres 的 `+00:00` 与 JavaScript 的 `Z` 表示同一时刻。返回地址列表先断言非空，避免空数组的 `every` 误过。截图使用 `testInfo.outputPath`，不会让不同用例复用固定图片路径。

两个 `*-save-fault.ts` 只负责专属实例的触发器故障注入，不再为 SQL 创建不用的 Auth 客户端。实际 Docker 目标来自准入结果，安装/删除与元数据核对在同一事务中；SQL 锁及执行均有超时。模拟服务未启动时，收尾不访问不存在的对象；已经启动的服务关闭失败仍向外抛出。

本轮的 SDK 合成传输、元数据准入、实际模块拒绝和隔离 SQL 内核验证分开记录。SQL 内核验证在已物理确认的无网络结构副本中替换准入边界后执行真实 Docker SQL，证明触发器生效和失败原子恢复；它没有运行完整辅助函数的 API 接线或十八个原页面场景。准确数量、失败反例与日志见[原授权测试与故障注入](../reference/verification-2026-11-06-mail-oauth.md#2026-11-10原授权测试与故障注入)。

## 独立模拟与策略检查

`npm run test:learning` 包含 11 个独立模拟检查，覆盖损坏输入后继续服务、Gmail/SENT、附件与克隆、AI/飞书、端口冲突、内部异常、断流、请求中断、OAuth 分支和超时回收。它们只加载明确白名单中的纯模拟源码，不加载账号、数据库管理入口或原 Playwright 环境。

`npm run test:e2e-fixture-policy` 验证声明和 URL 准入规则。它不创建隔离实例，也不运行原邮件套件。本轮原套件保持未执行；已通过的纯检查不得替代页面发起、独立数据库/Storage 核对和刷新证据。

实现参考 [Playwright 夹具生命周期](https://playwright.dev/docs/test-fixtures)及 [Node 24 HTTP 关闭连接](https://nodejs.org/docs/latest-v24.x/api/http.html#servercloseallconnections)。阅读的是 Node 24 在线文档，实际执行版本为 24.17.0；所用关闭方法早已提供，本地检查另验证端口可重新绑定。
