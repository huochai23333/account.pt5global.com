# 邮件会话怎样读取、更新和转交

管理员与业务员从工作台进入邮件。管理员可以查看共享列表，业务员只读取当前分给自己的会话。列表提供状态、时间、引用编号和未读提示。正文和附件按打开的会话另外查询。

原端到端场景、自动准备/回收及 Gmail、AI、飞书的本地模拟职责见[邮件测试维护](mail-test-boundaries.md)。独立模拟检查和页面、数据库、供应商验收分别记录。

| 常见维护 | 从哪里开始 |
| --- | --- |
| 首屏数据或角色 | [工作台页面](../../../app/%28workspace%29/%5Bworkspace%5D/mail/page.tsx)调用[身份守卫](../../../lib/mail/mail-identity.ts)和[首屏读取](../../../lib/mail/mail-page-data.ts)。人员名单、统计、隔离区和规则可以独立加载。 |
| 列表、正文与权限 | [会话读取服务](../../../lib/mail/mail-service.ts)读取当前页与总数，打开详情前由[会话权限服务](../../../lib/mail/mail-thread-access.ts)核对当前负责人和隔离状态。 |
| 快速切换与草稿恢复 | [详情 Hook](../../../components/dashboard/mail/use-mail-thread-opening.ts)统一打开和恢复请求。打开另一封、选择新邮件或更改列表时取消前一次详情。刷新时先请求原会话，明确失去访问权限则清除对应的回复备份。 |
| 已读提示 | 详情只从本次正文挑选入库位置最大的来信。事务在同一会话上核对权限和消息归属，已读位置只向前推进。回执仍有未读时，页面保留提示。 |
| 回复建议与分析 | [生成 Hook](../../../components/dashboard/mail/use-mail-ai-actions.ts)核对开始时的会话和正文编辑版本。[服务端流](../../../lib/mail/mail-ai-stream.ts)先确认额度与账本，正文完整后才发送成功事件。切换会话或继续编辑会保留当前草稿。 |
| 修改状态和转交 | [页面操作 Hook](../../../components/dashboard/mail/use-mail-thread-mutations.ts)发送页面读到的版本。 [写入服务](../../../lib/mail/mail-thread-mutations.ts)调用原数据库事务，独立查询会话状态、版本以及转交审计。 |
| 旧负责人已打开邮件 | [权限复查 Hook](../../../components/dashboard/mail/use-mail-thread-access.ts)每五秒复查可见收件箱中打开的会话，页面重新可见时也会查。[同一详情路由](../../../app/api/mail/threads/%5BthreadId%5D/route.ts)的 `HEAD` 只检查身份和归属。确认失去访问权限时收起详情、列表项和该封回复草稿；临时故障由下次检查重试。 |
| 拒绝错误回执或断线 | 页面比对编号、目标和新版本。断线后刷新并重新打开会话，核对最新结果。数据库用预期版本拒绝并发覆盖。 |
| 公司邮箱连接和飞书授权 | [授权地址模块](../../../lib/mail/mail-oauth-provider-urls.ts)构建供应商入口。 [一次性授权事务](../../../lib/mail/mail-oauth-transactions.ts)绑定发起人、供应商和有效期。回调领取状态后才请求供应商。 |
| Gmail 通知接收 | [Gmail 推送入口](../../../app/api/mail/webhooks/gmail/route.ts)调用[推送服务](../../../lib/mail/mail-google-push.ts)验签并登记通知。重复通知要匹配原事件凭证，收件同步在后续任务执行。 |
| 收件规则和隔离区 | [规则服务](../../../lib/mail/mail-intake-rules-service.ts)保存规则并为后台提供启用项。[隔离服务](../../../lib/mail/mail-quarantine-service.ts)负责列表、归属和批量移入。[恢复服务](../../../lib/mail/mail-quarantine-restore.ts)复查已联系名单和负责人。批量回执需逐条匹配原会话及其下一版本。 |
| 发件人设置 | [人员目录](../../../lib/mail/mail-agent-directory.ts)区分可管理的发件人和可分配的业务员。[建档服务](../../../lib/mail/mail-agent-provisioning.ts)生成别名和引用前缀，[配置服务](../../../lib/mail/mail-agent-profile-service.ts)按本人或管理员权限读取并按版本保存。 |
| Gmail API 请求 | [访问凭据和 Watch](../../../lib/mail/mail-google-credentials.ts)、[收件读取](../../../lib/mail/mail-google-inbound.ts)、[发件与对账](../../../lib/mail/mail-google-outbound.ts)分别维护，共用 [Gmail 请求入口](../../../lib/mail/mail-google-api.ts)。发送后必须在 Gmail 读回同一编号的已发送标记。 |
| 收件游标过期与 Watch 续订 | [收件 worker](../../../lib/mail/mail-inbound-worker.ts)按启用时间和上次同步时间确定回补范围，读完所有分页再处理来信。[后台维护](../../../lib/mail/mail-maintenance.ts)续订时只更新有效期，待处理历史仍由原游标继续。 |

状态更新的凭证是 `mail_threads` 的会话编号、目标状态和递增版本。转交要同时核对当前负责人，以及 `mail_assignment_events` 中的操作者、新负责人和相同版本。已读、出站发送、隔离和副本删除都有独立的业务凭证。

使用 `npm run test:learning:browser -- mail-thread-workflow`。测试用两条合成会话核对未读筛选、旧请求重放、建议与草稿归属及后续转交。三份合成账号分别从管理员、旧负责人和新负责人的页面核对转交。默认仅在浏览器模拟生成结果和一次权限复查故障，其他会话业务使用真实本地服务。共享流读取器可用 `npm run test:assistant-stream` 验证。[后端数据库手册](../../../../PT5-dropshipping-supabase/docs/onboarding/database.md)

使用 `npm run test:learning:browser -- mail-oauth-failure` 验证 OAuth 令牌交换失败与重复回调。本机模拟地址需要为 `http://127.0.0.1:4110/google-oauth`，端口 4110 由该测试临时使用。测试只创建专属授权状态，独立核对共享邮箱凭证和 Watch 记录保持一致。

完整授权成功需要邮箱启用、加密访问及离线凭据、收发权限和有效 Watch 同时成立。当前候选另在可重建专属实例完成 8 个实际页面场景，包含重复回调、保存失败、回程中断及业务员拒绝，独立核对版本后再刷新页面。四张中英文、桌面与手机截图可逐项复查。[当前授权链证据](../reference/verification-2026-11-11-mail-oauth-browser.md)

使用 `npm run test:learning:browser -- mail-quarantine-flow` 验证隔离与恢复。测试准备两封专属会话，一封有已联系凭证，一封没有。两封都可以从工作台隔离，只有已联系的会话能恢复。收件规则面板可以打开查看，规则维护的写入测试需在可重建隔离实例执行。

使用 `npm run test:learning:browser -- mail-sender-profile` 从业务员页面保存专属发件人资料，按账号及版本独立查回，并核对管理员页面读到同一份资料。使用 `npm run test:mail-outbound-reconciliation` 验证发送回执丢失后只查询原邮件。该测试运行实际 Gmail 适配代码，供应商请求和数据库使用测试边界。

使用 `npm run test:mail-inbound-recovery` 验证历史过期、多页回补、重复令牌、归档重试和 Watch 续订。回补证据查看原游标、事件终态和处理记录。测试模拟供应商、数据库和单封归档依赖，另一次隔离 Docker 验证记录在[收件回补报告](../reference/verification-2026-11-06-mail-recovery.md)。

推送先由官方库核对签名、受众和时效，再要求服务账号匹配且已验证声明明确为布尔值 `true`。供应商消息编号去重后，入站 worker 处理到终态。入站路由与负责人选择器共用在职业务员名单，再与启用的邮件设置求交。管理员的发件设置只承担原发件用途。推送身份回归执行 `npm run test:mail-google-push`，岗位边界随 `npm run test:mail-intake` 验证。[实际 Webhook、队列与页面凭证](../reference/verification-2026-11-11-google-push.md)

Watch 续订还需要核对凭据刷新后的实际密文与版本、订阅期限和旧收件游标。当前维护函数已用真实 HTTP、SDK、PostgREST 与专属数据库执行 6 个场景，覆盖到期、重复执行、无效期限、无效游标、来源失败与恢复。完整队列及定时调度须另行执行。[续订接线证据](../reference/verification-2026-11-11-mail-watch.md)

处理完成后，worker 用事件编号与领取次数调用收件结算事务。数据库按数值保留较大的 Gmail 游标，并在同一事务写入回补审计和事件终态。若提交成功后响应丢失，同一领取可读回原终态。供应商请求和单封归档发生在这个短事务之前。[并发结算验证](../reference/verification-2026-11-06-mail-atomic.md)

数据库的每日额度、邮件身份/隔离、规则和回执历史，见[线索额度与邮件数据库](../../../../PT5-dropshipping-supabase/docs/onboarding/lead-mail-history.md)。

当前规则/会话/收件数据库合同使用[邮件工作区SQL实操](../../../../PT5-dropshipping-supabase/docs/onboarding/mail-workspace-sql.md)：实际服务角色下核对审计编号、负责人和完整版本、恢复路由及真实领取次数；浏览器角色执行则拒绝。领取到processing只说明取得处理权，不等于来信处理或通知送达。

订单内部列、账号列权/行权与收件原子事务的演进见[订单、账号与邮件边界](../../../../PT5-dropshipping-supabase/docs/onboarding/order-mail-boundary-history.md)，其中区分早期游标与当前编号页。
