# 系统邮件与外部连接

当前范围：共享。

## 业务与阅读顺序

在共享邮箱中收发、分配和跟进邮件，连接 Gmail 与飞书。

数据流：页面 → requireMailIdentity → createOutboundMessage → mail_outbound_jobs → worker/content → 提供商 SENT 核对 → persistence 归档；来信事件 → 解析/已联系名单/路由 → commit_mail_inbound → 通知。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

服务密钥和加密正文仅在服务端；发件人、会话负责人及管理员权限逐次核验。

完成依据：会话状态和发件人设置核对编号、目标和下一版本。转交及隔离另有审计行。发送核对提供商消息编号、任务终态和数据库归档。

## 常见维护

通过[邮件会话链路](../explanation/mail-thread-flow.md)定位权限、列表和状态写入。人员配置、内容解析、发送、归档及后台调度各有维护入口。

验证入口：npm run test:learning:browser -- mail-thread-workflow mail-sender-profile mail-quarantine-flow mail-oauth-failure。npm run test:mail-intake。npm run test:mail-security。npm run test:mail-outbound-reconciliation。npm run test:mail-inbound-recovery。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`assign_mail_thread`、`claim_mail_inbound_events`、`claim_mail_notifications`、`claim_mail_outbound_jobs`、`commit_mail_inbound`、`create_mail_intake_rule`、`delete_mail_intake_rule`、`get_mail_average_first_reply_minutes`、`get_mail_report_metrics`、`get_mail_unread_thread_ids`、`mark_mail_thread_read`、`quarantine_mail_threads`、`query_mail_thread_page`、`record_mail_ignored_inbound`、`record_mail_intake_rule_hit`、`record_mail_rejected_inbound`、`restore_mail_thread`、`save_mail_shared_mailbox`、`settle_mail_inbound_event`、`update_mail_intake_rule`、`update_mail_thread_state`。

源码中直接引用的数据表/存储桶：`mail_agent_profiles`、`mail_assignment_events`、`mail_attachments`、`mail_audit_events`、`mail_feishu_bindings`、`mail_inbound_events`、`mail_inbound_rejection_receipts`、`mail_intake_rules`、`mail_messages`、`mail_notifications`、`mail_oauth_transactions`、`mail_outbound_jobs`、`mail_outbound_recipients`、`mail_shared_mailbox_credentials`、`mail_shared_mailbox_watches`、`mail_shared_mailboxes`、`mail_threads`、`mail_uploads`、`user_profiles`、`user_roles`、`user_roles_data`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: scripts/learning/mail-boundary.test.mjs](../../../scripts/learning/mail-boundary.test.mjs)
- [web: scripts/learning/mail-fixture-data.test.mjs](../../../scripts/learning/mail-fixture-data.test.mjs)
- [web: scripts/learning/mail-fixture-records.test.mjs](../../../scripts/learning/mail-fixture-records.test.mjs)
- [web: scripts/mail-google-push.test.cjs](../../../scripts/mail-google-push.test.cjs)
- [web: scripts/mail-inbound-recovery.test.cjs](../../../scripts/mail-inbound-recovery.test.cjs)
- [web: scripts/mail-intake.test.mjs](../../../scripts/mail-intake.test.mjs)
- [web: scripts/mail-outbound-reconciliation.test.cjs](../../../scripts/mail-outbound-reconciliation.test.cjs)
- [web: scripts/mail-routing-members.test.cjs](../../../scripts/mail-routing-members.test.cjs)
- [web: scripts/mail-security.test.mjs](../../../scripts/mail-security.test.mjs)
- [web: tests/e2e/helpers/mail-boundary-mock-server.ts](../../../tests/e2e/helpers/mail-boundary-mock-server.ts)
- [web: tests/e2e/helpers/mail-boundary-state.ts](../../../tests/e2e/helpers/mail-boundary-state.ts)
- [web: tests/e2e/helpers/mail-feishu-boundary.ts](../../../tests/e2e/helpers/mail-feishu-boundary.ts)
- [web: tests/e2e/helpers/mail-feishu-save-fault.ts](../../../tests/e2e/helpers/mail-feishu-save-fault.ts)
- [web: tests/e2e/helpers/mail-fixture-admin.ts](../../../tests/e2e/helpers/mail-fixture-admin.ts)
- [web: tests/e2e/helpers/mail-fixture-agents.ts](../../../tests/e2e/helpers/mail-fixture-agents.ts)
- [web: tests/e2e/helpers/mail-fixture-identity.ts](../../../tests/e2e/helpers/mail-fixture-identity.ts)
- [web: tests/e2e/helpers/mail-fixture-mailbox.ts](../../../tests/e2e/helpers/mail-fixture-mailbox.ts)
- [web: tests/e2e/helpers/mail-fixture-messages.ts](../../../tests/e2e/helpers/mail-fixture-messages.ts)
- [web: tests/e2e/helpers/mail-fixture-records.ts](../../../tests/e2e/helpers/mail-fixture-records.ts)
- [web: tests/e2e/helpers/mail-fixture-reset.ts](../../../tests/e2e/helpers/mail-fixture-reset.ts)
- [web: tests/e2e/helpers/mail-fixture-scenarios.ts](../../../tests/e2e/helpers/mail-fixture-scenarios.ts)
- [web: tests/e2e/helpers/mail-fixtures.ts](../../../tests/e2e/helpers/mail-fixtures.ts)
- [web: tests/e2e/helpers/mail-gmail-boundary.ts](../../../tests/e2e/helpers/mail-gmail-boundary.ts)
- [web: tests/e2e/helpers/mail-inbound-task.ts](../../../tests/e2e/helpers/mail-inbound-task.ts)
- [web: tests/e2e/helpers/mail-oauth-boundary.ts](../../../tests/e2e/helpers/mail-oauth-boundary.ts)
- [web: tests/e2e/helpers/mail-oauth-save-fault.ts](../../../tests/e2e/helpers/mail-oauth-save-fault.ts)
- [web: tests/e2e/helpers/mail-test.ts](../../../tests/e2e/helpers/mail-test.ts)
- [web: tests/e2e/mail-feishu-oauth.spec.ts](../../../tests/e2e/mail-feishu-oauth.spec.ts)
- [web: tests/e2e/mail-inbound.spec.ts](../../../tests/e2e/mail-inbound.spec.ts)
- [web: tests/e2e/mail-layout.spec.ts](../../../tests/e2e/mail-layout.spec.ts)
- [web: tests/e2e/mail-numbered-pages.spec.ts](../../../tests/e2e/mail-numbered-pages.spec.ts)
- [web: tests/e2e/mail-oauth.spec.ts](../../../tests/e2e/mail-oauth.spec.ts)
- [web: tests/e2e/mail-outbound.spec.ts](../../../tests/e2e/mail-outbound.spec.ts)
- [web: tests/e2e/mail-permissions.spec.ts](../../../tests/e2e/mail-permissions.spec.ts)
- [web: tests/e2e/mail-quarantine.spec.ts](../../../tests/e2e/mail-quarantine.spec.ts)
- [web: tests/e2e/mail-recipient-maintenance.spec.ts](../../../tests/e2e/mail-recipient-maintenance.spec.ts)
- [web: tests/e2e/mail-secondary-data.spec.ts](../../../tests/e2e/mail-secondary-data.spec.ts)
- [web: tests/e2e/mail-sender-settings.spec.ts](../../../tests/e2e/mail-sender-settings.spec.ts)
- [web: tests/e2e/mail-workspace-actions.spec.ts](../../../tests/e2e/mail-workspace-actions.spec.ts)
- [web: tests/e2e/mail.spec.ts](../../../tests/e2e/mail.spec.ts)
- [web: tests/learning/auth-mail-fixture.mjs](../../../tests/learning/auth-mail-fixture.mjs)
- [web: tests/learning/mail-oauth-failure.spec.ts](../../../tests/learning/mail-oauth-failure.spec.ts)
- [web: tests/learning/mail-quarantine-flow.spec.ts](../../../tests/learning/mail-quarantine-flow.spec.ts)
- [web: tests/learning/mail-reply-draft-verification.ts](../../../tests/learning/mail-reply-draft-verification.ts)
- [web: tests/learning/mail-sender-profile.spec.ts](../../../tests/learning/mail-sender-profile.spec.ts)
- [web: tests/learning/mail-thread-workflow.spec.ts](../../../tests/learning/mail-thread-workflow.spec.ts)
- [web: tests/learning/mail-transfer-verification.ts](../../../tests/learning/mail-transfer-verification.ts)
- [web: tests/test-support/mail-fixture-store.mjs](../../../tests/test-support/mail-fixture-store.mjs)
- [supabase: supabase/tests/mail_inbound_atomic_recovery.sql](../../../../PT5-dropshipping-supabase/supabase/tests/mail_inbound_atomic_recovery.sql)
- [supabase: supabase/tests/mail_inbound_event_settlement.sql](../../../../PT5-dropshipping-supabase/supabase/tests/mail_inbound_event_settlement.sql)
- [supabase: supabase/tests/mail_thread_pagination_and_report_metrics.sql](../../../../PT5-dropshipping-supabase/supabase/tests/mail_thread_pagination_and_report_metrics.sql)
- [supabase: supabase/tests/mail_workspace.sql](../../../../PT5-dropshipping-supabase/supabase/tests/mail_workspace.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/(workspace)/[workspace]/mail/page.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/mail/page.tsx) | 已审保留：角色路由与首屏组装 |
| [app/api/mail/_shared.ts](../../../app/api/mail/_shared.ts) | 已审保留：带身份的请求解析；统一错误响应 |
| [app/api/mail/agents/route.ts](../../../app/api/mail/agents/route.ts) | 已审保留：发件资料接口分流 |
| [app/api/mail/ai/reply/route.ts](../../../app/api/mail/ai/reply/route.ts) | 已审拆分：回复生成请求调度 |
| [app/api/mail/ai/report/route.ts](../../../app/api/mail/ai/report/route.ts) | 已审拆分：管理员分析报告入口 |
| [app/api/mail/assignable-agents/route.ts](../../../app/api/mail/assignable-agents/route.ts) | 已审保留：可转交人员摘要 |
| [app/api/mail/attachments/[attachmentId]/route.ts](../../../app/api/mail/attachments/%5BattachmentId%5D/route.ts) | 已审保留：授权附件下载响应 |
| [app/api/mail/attachments/route.ts](../../../app/api/mail/attachments/route.ts) | 已审保留：邮件附件上传请求校验 |
| [app/api/mail/feishu-connect/route.ts](../../../app/api/mail/feishu-connect/route.ts) | 已审保留：准备飞书授权入口 |
| [app/api/mail/intake-rules/route.ts](../../../app/api/mail/intake-rules/route.ts) | 已审保留：把读取和维护请求分发给收件规则服务 |
| [app/api/mail/mailbox-connect/route.ts](../../../app/api/mail/mailbox-connect/route.ts) | 已审保留：准备 Gmail 公司邮箱授权入口 |
| [app/api/mail/metrics/route.ts](../../../app/api/mail/metrics/route.ts) | 已审保留：管理员运行统计入口 |
| [app/api/mail/oauth/feishu/callback/route.ts](../../../app/api/mail/oauth/feishu/callback/route.ts) | 已审保留：校对并领取飞书授权；请求身份并确认绑定；返回角色邮件页 |
| [app/api/mail/oauth/feishu/start/route.ts](../../../app/api/mail/oauth/feishu/start/route.ts) | 已审保留：登记飞书一次性授权事务；生成供应商跳转 |
| [app/api/mail/oauth/google/callback/route.ts](../../../app/api/mail/oauth/google/callback/route.ts) | 已审保留：核对并领取 OAuth 授权；调度 Gmail 连接和 Watch 保存；验收凭证与分类回跳 |
| [app/api/mail/oauth/google/start/route.ts](../../../app/api/mail/oauth/google/start/route.ts) | 已审保留：登记 Gmail 一次性授权事务；生成 PKCE 跳转 |
| [app/api/mail/outbound/[jobId]/route.ts](../../../app/api/mail/outbound/%5BjobId%5D/route.ts) | 已审保留：按任务编号读取发送状态 |
| [app/api/mail/outbound/route.ts](../../../app/api/mail/outbound/route.ts) | 已审保留：查询发送请求状态；接收发件任务并触发一次处理 |
| [app/api/mail/quarantine/[threadId]/route.ts](../../../app/api/mail/quarantine/%5BthreadId%5D/route.ts) | 已审保留：隔离详情；恢复请求调度 |
| [app/api/mail/quarantine/route.ts](../../../app/api/mail/quarantine/route.ts) | 已审保留：隔离列表；批量隔离入口 |
| [app/api/mail/tasks/process/route.ts](../../../app/api/mail/tasks/process/route.ts) | 已审保留：认证后台触发请求；调度邮件后台任务 |
| [app/api/mail/tasks/recipient-maintenance/route.ts](../../../app/api/mail/tasks/recipient-maintenance/route.ts) | 已审保留：校对后台身份和请求；区分历史收件人预览与确认删除 |
| [app/api/mail/threads/[threadId]/assign/route.ts](../../../app/api/mail/threads/%5BthreadId%5D/assign/route.ts) | 已审拆分：转交请求解析与分派 |
| [app/api/mail/threads/[threadId]/read/route.ts](../../../app/api/mail/threads/%5BthreadId%5D/read/route.ts) | 已审拆分：已读位置请求调度 |
| [app/api/mail/threads/[threadId]/route.ts](../../../app/api/mail/threads/%5BthreadId%5D/route.ts) | 已审拆分：分发同一路由的详情、轻量复查和删除请求 |
| [app/api/mail/threads/[threadId]/state/route.ts](../../../app/api/mail/threads/%5BthreadId%5D/state/route.ts) | 已审拆分：会话状态请求白名单 |
| [app/api/mail/threads/route.ts](../../../app/api/mail/threads/route.ts) | 已审保留：会话列表筛选入口 |
| [app/api/mail/webhooks/gmail/route.ts](../../../app/api/mail/webhooks/gmail/route.ts) | 已审拆分：接收并验证 Gmail 通知；按已登记的事件调度处理 |
| [app/api/mail/workspace/route.ts](../../../app/api/mail/workspace/route.ts) | 已审保留：邮箱概要接口 |
| [components/dashboard/mail/mail-admin-panel.tsx](../../../components/dashboard/mail/mail-admin-panel.tsx) | 已审保留：邮箱与指标展示；分析报告表单；发件人员设置组装 |
| [components/dashboard/mail/mail-agent-profile-card.tsx](../../../components/dashboard/mail/mail-agent-profile-card.tsx) | 已审保留：呈现发件资料字段和即时预览；将编辑和保存意图交给工作台 |
| [components/dashboard/mail/mail-client-request.ts](../../../components/dashboard/mail/mail-client-request.ts) | 已审保留：隔离区 JSON 请求适配 |
| [components/dashboard/mail/mail-composer.tsx](../../../components/dashboard/mail/mail-composer.tsx) | 已审保留：撰写输入展示；附件与发送动作呈现 |
| [components/dashboard/mail/mail-connection-notice.tsx](../../../components/dashboard/mail/mail-connection-notice.tsx) | 已审保留：邮箱授权回跳提示 |
| [components/dashboard/mail/mail-display.ts](../../../components/dashboard/mail/mail-display.ts) | 已审拆分：邮件时间展示 |
| [components/dashboard/mail/mail-draft-storage.ts](../../../components/dashboard/mail/mail-draft-storage.ts) | 已审保留：当前标签页草稿读写 |
| [components/dashboard/mail/mail-feishu-notice.tsx](../../../components/dashboard/mail/mail-feishu-notice.tsx) | 已审保留：飞书连接失败提示 |
| [components/dashboard/mail/mail-feishu-status.tsx](../../../components/dashboard/mail/mail-feishu-status.tsx) | 已审保留：飞书绑定入口与显示 |
| [components/dashboard/mail/mail-intake-rules-panel.tsx](../../../components/dashboard/mail/mail-intake-rules-panel.tsx) | 已审保留：呈现新规则表单；呈现现有规则与编辑回调 |
| [components/dashboard/mail/mail-own-settings-panel.tsx](../../../components/dashboard/mail/mail-own-settings-panel.tsx) | 已审保留：组装业务员自己的发件设置卡片 |
| [components/dashboard/mail/mail-quarantine-panel.tsx](../../../components/dashboard/mail/mail-quarantine-panel.tsx) | 已审保留：呈现隔离列表及分页；呈现所选会话和动作入口 |
| [components/dashboard/mail/mail-send-flow.ts](../../../components/dashboard/mail/mail-send-flow.ts) | 已审保留：发件意图恢复与入队；等待发送终态 |
| [components/dashboard/mail/mail-send-intent.ts](../../../components/dashboard/mail/mail-send-intent.ts) | 已审保留：发件意图指纹与恢复存储 |
| [components/dashboard/mail/mail-thread-detail.tsx](../../../components/dashboard/mail/mail-thread-detail.tsx) | 已审拆分：会话与操作区；正文和附件展示；发信表单组装 |
| [components/dashboard/mail/mail-thread-list.tsx](../../../components/dashboard/mail/mail-thread-list.tsx) | 已审保留：状态筛选与批量入口；会话行展示；分页控制 |
| [components/dashboard/mail/mail-workspace-client.tsx](../../../components/dashboard/mail/mail-workspace-client.tsx) | 已审保留：组合工作台标签与面板；调度视图和局部交互 |
| [components/dashboard/mail/mail-workspace-request.ts](../../../components/dashboard/mail/mail-workspace-request.ts) | 已审保留：邮件请求错误边界 |
| [components/dashboard/mail/mail-workspace-tabs.tsx](../../../components/dashboard/mail/mail-workspace-tabs.tsx) | 已审保留：邮件工作台页签展示 |
| [components/dashboard/mail/use-mail-ai-actions.ts](../../../components/dashboard/mail/use-mail-ai-actions.ts) | 已审拆分：分析和建议请求；回复草稿版本核对 |
| [components/dashboard/mail/use-mail-draft-guard.ts](../../../components/dashboard/mail/use-mail-draft-guard.ts) | 已审保留：草稿离开确认 |
| [components/dashboard/mail/use-mail-intake-rules.ts](../../../components/dashboard/mail/use-mail-intake-rules.ts) | 已审拆分：读取和暂存收件规则；提交规则增删改并核对回执 |
| [components/dashboard/mail/use-mail-intake.ts](../../../components/dashboard/mail/use-mail-intake.ts) | 已审拆分：维护隔离页和详情状态；维护收件列表的批量勾选；调度隔离、恢复及删除 |
| [components/dashboard/mail/use-mail-secondary-data.ts](../../../components/dashboard/mail/use-mail-secondary-data.ts) | 已审保留：次要资料并发加载；独立重试状态 |
| [components/dashboard/mail/use-mail-thread-access.ts](../../../components/dashboard/mail/use-mail-thread-access.ts) | 已审拆分：前台会话权限复查；请求生命周期与失效回调 |
| [components/dashboard/mail/use-mail-thread-mutations.ts](../../../components/dashboard/mail/use-mail-thread-mutations.ts) | 已审拆分：提交当前会话状态和转交；校对写入回执并更新显示 |
| [components/dashboard/mail/use-mail-thread-opening.ts](../../../components/dashboard/mail/use-mail-thread-opening.ts) | 已审拆分：管理详情选择和取消；在同一会话记录已读并核对回执 |
| [components/dashboard/mail/use-mail-workspace-composer.ts](../../../components/dashboard/mail/use-mail-workspace-composer.ts) | 已审拆分：回复编辑与备份；附件上传并绑定当前视图；发送与恢复原任务 |
| [components/dashboard/mail/use-mail-workspace-services.ts](../../../components/dashboard/mail/use-mail-workspace-services.ts) | 已审拆分：发件人设置；外部账号连接 |
| [components/dashboard/mail/use-mail-workspace.ts](../../../components/dashboard/mail/use-mail-workspace.ts) | 已审拆分：组装工作台领域状态和 Hooks；协调摘要、列表和当前详情；发起管理员副本删除并刷新 |
| [lib/mail/mail-admin-deletion.ts](../../../lib/mail/mail-admin-deletion.ts) | 已审保留：清理系统副本的附件；记录删除审计并核对会话删除 |
| [lib/mail/mail-admin-reporting.ts](../../../lib/mail/mail-admin-reporting.ts) | 已审保留：管理员运行指标；日期报告上下文 |
| [lib/mail/mail-agent-directory.ts](../../../lib/mail/mail-agent-directory.ts) | 已审拆分：读取在职管理员与业务员；提供可分配业务员名单 |
| [lib/mail/mail-agent-identifiers.ts](../../../lib/mail/mail-agent-identifiers.ts) | 已审保留：构造稳定的发件别名和引用前缀；生成确定性的冲突后缀 |
| [lib/mail/mail-agent-profile-service.ts](../../../lib/mail/mail-agent-profile-service.ts) | 已审拆分：读取管理员发件配置列表；读取指定成员或本人的配置；按预期版本保存并核对回执 |
| [lib/mail/mail-agent-provisioning.ts](../../../lib/mail/mail-agent-provisioning.ts) | 已审拆分：为新成员生成不冲突的标识；确认首次发件资料建档 |
| [lib/mail/mail-ai-stream.ts](../../../lib/mail/mail-ai-stream.ts) | 已审拆分：申请和释放生成额度；协调供应商流及终态账本 |
| [lib/mail/mail-attachment-service.ts](../../../lib/mail/mail-attachment-service.ts) | 已审拆分：附件上传和扫描；授权下载 |
| [lib/mail/mail-confirmed-rejection.ts](../../../lib/mail/mail-confirmed-rejection.ts) | 已审保留：确定性邮件拒绝类型 |
| [lib/mail/mail-connection-feedback.ts](../../../lib/mail/mail-connection-feedback.ts) | 已审保留：定义 Gmail 连接结果与固定原因 |
| [lib/mail/mail-connection-navigation.ts](../../../lib/mail/mail-connection-navigation.ts) | 已审保留：生成固定邮箱页回跳；维护短时成功凭证 Cookie |
| [lib/mail/mail-connection-page-data.ts](../../../lib/mail/mail-connection-page-data.ts) | 已审保留：将 URL 查询转换为经验证的反馈 |
| [lib/mail/mail-connection-receipt.ts](../../../lib/mail/mail-connection-receipt.ts) | 已审保留：签发短时邮箱连接凭证；核对签名及当前邮箱终态 |
| [lib/mail/mail-env.ts](../../../lib/mail/mail-env.ts) | 已审保留：统一读取邮件服务配置 |
| [lib/mail/mail-feishu-feedback.ts](../../../lib/mail/mail-feishu-feedback.ts) | 已审保留：定义飞书失败结果与固定原因 |
| [lib/mail/mail-feishu-navigation.ts](../../../lib/mail/mail-feishu-navigation.ts) | 已审保留：生成飞书回跳失败响应 |
| [lib/mail/mail-feishu-provider.ts](../../../lib/mail/mail-feishu-provider.ts) | 已审保留：交换飞书授权码并查询人员身份；持久化绑定凭证 |
| [lib/mail/mail-google-api.ts](../../../lib/mail/mail-google-api.ts) | 已审拆分：发送共用 Gmail 请求并解释 HTTP 失败 |
| [lib/mail/mail-google-connection.ts](../../../lib/mail/mail-google-connection.ts) | 已审保留：交换授权码并核对邮箱和范围；启动 Gmail Watch 并验证游标；保存加密邮箱和 Watch 凭证 |
| [lib/mail/mail-google-credentials.ts](../../../lib/mail/mail-google-credentials.ts) | 已审拆分：读取、刷新并核对共享邮箱凭据；续订 Gmail Watch |
| [lib/mail/mail-google-inbound.ts](../../../lib/mail/mail-google-inbound.ts) | 已审拆分：按编号读取邮件与附件；读取历史变更或按时间查找消息 |
| [lib/mail/mail-google-outbound.ts](../../../lib/mail/mail-google-outbound.ts) | 已审拆分：构造发件请求；按 RFC 编号对账并验证 SENT |
| [lib/mail/mail-google-push.ts](../../../lib/mail/mail-google-push.ts) | 已审拆分：核对 Google 推送身份并解析通知；保存通知及验证重复事件 |
| [lib/mail/mail-identity.ts](../../../lib/mail/mail-identity.ts) | 已审保留：邮件身份与管理员权限 |
| [lib/mail/mail-inbound-errors.ts](../../../lib/mail/mail-inbound-errors.ts) | 已审保留：不可重试的来信输入异常 |
| [lib/mail/mail-inbound-message.ts](../../../lib/mail/mail-inbound-message.ts) | 已审保留：接收判定与分配；附件暂存及扫描；原子归档和结果核对 |
| [lib/mail/mail-inbound-parser.ts](../../../lib/mail/mail-inbound-parser.ts) | 已审保留：信封与正文解析；附件读取及限制 |
| [lib/mail/mail-inbound-persistence.ts](../../../lib/mail/mail-inbound-persistence.ts) | 已审保留：暂存附件引用核对与清理 |
| [lib/mail/mail-inbound-worker.ts](../../../lib/mail/mail-inbound-worker.ts) | 已审拆分：领取及重试入站事件；供应商同步位置；逐封入站协作 |
| [lib/mail/mail-intake-rules-service.ts](../../../lib/mail/mail-intake-rules-service.ts) | 已审拆分：读取启用规则供来信判断；读取与维护管理员规则；记录命中回执 |
| [lib/mail/mail-intake.ts](../../../lib/mail/mail-intake.ts) | 已审保留：规范化规则输入；决定是否隔离来信 |
| [lib/mail/mail-maintenance.ts](../../../lib/mail/mail-maintenance.ts) | 已审拆分：恢复超期后台锁；续订 Gmail 通知并保存结果；清理过期附件对象和登记 |
| [lib/mail/mail-notification-worker.ts](../../../lib/mail/mail-notification-worker.ts) | 已审保留：领取通知并读取接收对象；请求飞书并确认送达凭证；保存失败重试或人工处理状态 |
| [lib/mail/mail-oauth-provider-urls.ts](../../../lib/mail/mail-oauth-provider-urls.ts) | 已审拆分：构造 Google 和飞书的授权地址 |
| [lib/mail/mail-oauth-transactions.ts](../../../lib/mail/mail-oauth-transactions.ts) | 已审拆分：生成 Google PKCE 配对；登记并单次领取授权事务 |
| [lib/mail/mail-outbound-content.ts](../../../lib/mail/mail-outbound-content.ts) | 已审保留：发件上下文和附件读取；MIME 与稳定标识构建 |
| [lib/mail/mail-outbound-persistence.ts](../../../lib/mail/mail-outbound-persistence.ts) | 已审保留：会话与已发消息归档；附件与收件索引归档；发送最终凭证保存 |
| [lib/mail/mail-outbound-service.ts](../../../lib/mail/mail-outbound-service.ts) | 已审拆分：发件意图验证与任务创建；出站状态读取与恢复 |
| [lib/mail/mail-outbound-types.ts](../../../lib/mail/mail-outbound-types.ts) | 已审保留：定义 JobRow、Context 等3项同模块类型合同 |
| [lib/mail/mail-outbound-worker.ts](../../../lib/mail/mail-outbound-worker.ts) | 已审保留：单封发送及按 Message-ID 对账；批量领取与串行处理；失败终态保存 |
| [lib/mail/mail-page-data.ts](../../../lib/mail/mail-page-data.ts) | 已审保留：首屏数据编排 |
| [lib/mail/mail-quarantine-receipt.ts](../../../lib/mail/mail-quarantine-receipt.ts) | 已审拆分：逐个校对批量隔离回执 |
| [lib/mail/mail-quarantine-restore.ts](../../../lib/mail/mail-quarantine-restore.ts) | 已审拆分：验证可恢复会话和来信；重建负责人及引用依据；提交恢复并返回凭证 |
| [lib/mail/mail-quarantine-service.ts](../../../lib/mail/mail-quarantine-service.ts) | 已审拆分：按权限分页读取隔离区；校验批量目标和版本；执行隔离并确认完整回执 |
| [lib/mail/mail-recipient-addresses.ts](../../../lib/mail/mail-recipient-addresses.ts) | 已审保留：解析邮件头的邮箱地址；规范化出站收件人顺序与去重 |
| [lib/mail/mail-recipient-maintenance.ts](../../../lib/mail/mail-recipient-maintenance.ts) | 已审保留：回填历史成功收件人索引；预览陌生会话的精确集合；核对预览并删除限定副本 |
| [lib/mail/mail-recipient-service.ts](../../../lib/mail/mail-recipient-service.ts) | 已审保留：保存已验证出站收件人；读取发件人的已联系记录及当前负责人；保存陌生来信忽略凭证 |
| [lib/mail/mail-reply-context.ts](../../../lib/mail/mail-reply-context.ts) | 已审拆分：授权会话生成上下文 |
| [lib/mail/mail-return-url.ts](../../../lib/mail/mail-return-url.ts) | 已审保留：确定授权完成后唯一角色入口 |
| [lib/mail/mail-routing-service.ts](../../../lib/mail/mail-routing-service.ts) | 已审拆分：路由可用成员读取；新邮件引用编号生成 |
| [lib/mail/mail-routing.ts](../../../lib/mail/mail-routing.ts) | 已审保留：解释会话和历史联系人依据；提取别名、引用和姓名提示；决定分配结果及冲突证据 |
| [lib/mail/mail-security.ts](../../../lib/mail/mail-security.ts) | 已审保留：生成随机数和摘要；加密并验证邮件密文；生成盲索引与展示脱敏 |
| [lib/mail/mail-service.ts](../../../lib/mail/mail-service.ts) | 已审拆分：工作台摘要；列表分页；会话详情查询 |
| [lib/mail/mail-storage.ts](../../../lib/mail/mail-storage.ts) | 已审保留：净化附件文件名；管理私有附件对象的上传、读取和删除；查询附件扫描结果 |
| [lib/mail/mail-thread-access.ts](../../../lib/mail/mail-thread-access.ts) | 已审拆分：限定服务身份的会话访问范围；区分明确缺行与暂时失败 |
| [lib/mail/mail-thread-mutations.ts](../../../lib/mail/mail-thread-mutations.ts) | 已审拆分：记录已读；事务转交与审计；修改会话状态 |
| [lib/mail/mail-types.ts](../../../lib/mail/mail-types.ts) | 已审拆分：定义 MailIdentity、MailSenderRole 等18项同模块类型合同 |
| [lib/mail/mail-worker.ts](../../../lib/mail/mail-worker.ts) | 已审保留：邮件后台阶段编排 |
