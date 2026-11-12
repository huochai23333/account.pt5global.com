# 认证与权限

当前范围：共享。

## 业务与阅读顺序

处理登录、恢复会话、注册、找回密码及服务端身份核验。

数据流：认证表单 → 输入 view-model → use-login-recovery → LoginRecoveryCoordinator → Auth.getUser/当前数据库岗位状态/已验证业务 → 导航 → server-auth 再次准入。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

Auth 验证身份，数据库验证岗位和状态；用户可编辑的 metadata 不能作为授权依据。

完成依据：真实 Auth 身份、数据库权限与刷新后的工作台一致；失败保留可恢复状态。

## 常见维护

先读 explanation/auth-read-paths.md；严格 current-app-access-context 与浏览器缓存 current-session-access-context 适用边界不同。网络恢复修改 login-recovery；界面不猜测角色，也不从用户可编辑 metadata 授权。

验证入口：npm run test:login-recovery；npm run test:admin-auth-sync；auth、auth-network 用例；npm run test:learning:browser -- auth-password-maintenance（仅本机Mailpit与专属账号）。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`get_current_app_access_context`、`get_signup_invite_context`、`validate_signup_referral_code`。

源码中直接引用的数据表/存储桶：本模块未发现字面量 from 调用。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: scripts/auth-operation-receipts.test.mjs](../../../scripts/auth-operation-receipts.test.mjs)
- [web: scripts/learning/auth-sync-test-completion.test.mjs](../../../scripts/learning/auth-sync-test-completion.test.mjs)
- [web: scripts/learning/current-session-cache.test.mjs](../../../scripts/learning/current-session-cache.test.mjs)
- [web: scripts/login-recovery.test.cjs](../../../scripts/login-recovery.test.cjs)
- [web: tests/e2e/admin-auth-sync-recovery.spec.ts](../../../tests/e2e/admin-auth-sync-recovery.spec.ts)
- [web: tests/e2e/auth-motion.spec.ts](../../../tests/e2e/auth-motion.spec.ts)
- [web: tests/e2e/auth-network.spec.ts](../../../tests/e2e/auth-network.spec.ts)
- [web: tests/e2e/auth.spec.ts](../../../tests/e2e/auth.spec.ts)
- [web: tests/e2e/forgot-password.spec.ts](../../../tests/e2e/forgot-password.spec.ts)
- [web: tests/e2e/helpers/auth.ts](../../../tests/e2e/helpers/auth.ts)
- [web: tests/e2e/helpers/design-system-auth.ts](../../../tests/e2e/helpers/design-system-auth.ts)
- [web: tests/e2e/helpers/local-supabase-admin.ts](../../../tests/e2e/helpers/local-supabase-admin.ts)
- [web: tests/e2e/helpers/local-supabase.ts](../../../tests/e2e/helpers/local-supabase.ts)
- [web: tests/learning/auth-password-diagnostics.ts](../../../tests/learning/auth-password-diagnostics.ts)
- [web: tests/learning/auth-password-maintenance.spec.ts](../../../tests/learning/auth-password-maintenance.spec.ts)
- [web: tests/learning/register-progress.spec.ts](../../../tests/learning/register-progress.spec.ts)
- [web: tests/public/login-recovery.spec.ts](../../../tests/public/login-recovery.spec.ts)
- [web: tests/unit/admin-auth-sync-race.mjs](../../../tests/unit/admin-auth-sync-race.mjs)
- [web: tests/unit/admin-auth-sync-recovery.mjs](../../../tests/unit/admin-auth-sync-recovery.mjs)
- [supabase: supabase/tests/admin_auth_metadata_reconciliation.sql](../../../../PT5-dropshipping-supabase/supabase/tests/admin_auth_metadata_reconciliation.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/(auth)/forgot-password/page.tsx](../../../app/%28auth%29/forgot-password/page.tsx) | 已审保留：找回与恢复入口调度；恢复页面组装 |
| [app/(auth)/layout.tsx](../../../app/%28auth%29/layout.tsx) | 已审保留：公开认证区样式边界 |
| [app/(auth)/login/page.tsx](../../../app/%28auth%29/login/page.tsx) | 已审保留：登录页文案与表单组装 |
| [app/(auth)/page.tsx](../../../app/%28auth%29/page.tsx) | 已审保留：当前首页登录组装 |
| [app/(auth)/register/page.tsx](../../../app/%28auth%29/register/page.tsx) | 已审保留：注册页组装；邀请码参数规范化 |
| [app/(auth)/template.tsx](../../../app/%28auth%29/template.tsx) | 已审保留：认证区动效边界 |
| [app/auth/confirm/route.ts](../../../app/auth/confirm/route.ts) | 已审保留：邮件 OTP 确认调度；恢复会话证明与安全跳转 |
| [app/auth/sign-out/confirm/page.tsx](../../../app/auth/sign-out/confirm/page.tsx) | 已审保留：退出确认页面 |
| [app/auth/sign-out/route.ts](../../../app/auth/sign-out/route.ts) | 已审保留：主动退出 Cookie 清理；站内跳转规范化 |
| [components/auth/auth-error-messages.ts](../../../components/auth/auth-error-messages.ts) | 已审拆分：认证错误规范化；认证失败分类 |
| [components/auth/auth-field.tsx](../../../components/auth/auth-field.tsx) | 已审保留：认证输入框展示 |
| [components/auth/auth-form-panel.tsx](../../../components/auth/auth-form-panel.tsx) | 已审保留：认证表单区公共结构展示 |
| [components/auth/auth-hero-panel.tsx](../../../components/auth/auth-hero-panel.tsx) | 已审保留：桌面认证品牌与装饰展示 |
| [components/auth/auth-loading-shell.tsx](../../../components/auth/auth-loading-shell.tsx) | 已审保留：认证流程加载骨架展示 |
| [components/auth/auth-password-field.tsx](../../../components/auth/auth-password-field.tsx) | 已审保留：密码字段展示与可见性 |
| [components/auth/auth-password-policy.ts](../../../components/auth/auth-password-policy.ts) | 已审保留：密码强度即时提示规则 |
| [components/auth/auth-route-link.tsx](../../../components/auth/auth-route-link.tsx) | 已审保留：认证页面导航交互 |
| [components/auth/auth-shell-types.ts](../../../components/auth/auth-shell-types.ts) | 已审保留：定义 AuthShellMode、AuthNoteContent 等6项同模块类型合同 |
| [components/auth/auth-shell.tsx](../../../components/auth/auth-shell.tsx) | 已审保留：认证公共外壳组装 |
| [components/auth/auth-supplemental-note.tsx](../../../components/auth/auth-supplemental-note.tsx) | 已审保留：手机和平板补充说明展示 |
| [components/auth/forgot-password-form.tsx](../../../components/auth/forgot-password-form.tsx) | 已审保留：找回/改密步骤展示 |
| [components/auth/login-announcement-card.tsx](../../../components/auth/login-announcement-card.tsx) | 已审保留：公开登录公告展示 |
| [components/auth/login-announcement-panel.tsx](../../../components/auth/login-announcement-panel.tsx) | 已审保留：登录公开公告首屏读取与组装 |
| [components/auth/login-feedback.ts](../../../components/auth/login-feedback.ts) | 已审保留：登录恢复状态到消息键映射 |
| [components/auth/login-form.tsx](../../../components/auth/login-form.tsx) | 已审保留：登录字段与恢复反馈展示 |
| [components/auth/register-flow.ts](../../../components/auth/register-flow.ts) | 已审保留：已启用业务的注册步骤规则 |
| [components/auth/register-form-types.ts](../../../components/auth/register-form-types.ts) | 已审保留：定义 SignupBusiness、SignupInviteContext 等3项同模块类型合同 |
| [components/auth/register-form-validation.ts](../../../components/auth/register-form-validation.ts) | 已审保留：邀请码查询及结果规范化；注册错误消息映射；重复邮箱响应识别 |
| [components/auth/register-form.tsx](../../../components/auth/register-form.tsx) | 已审保留：注册步骤组装与切换动效 |
| [components/auth/register-phone-field.tsx](../../../components/auth/register-phone-field.tsx) | 已审保留：国家选项与电话输入展示 |
| [components/auth/register-phone-utils.ts](../../../components/auth/register-phone-utils.ts) | 已审保留：双语国家选项与默认地区；国际电话号码规范化 |
| [components/auth/register-step-actions.tsx](../../../components/auth/register-step-actions.tsx) | 已审保留：注册前后步与提交按钮展示 |
| [components/auth/register-step-business.tsx](../../../components/auth/register-step-business.tsx) | 已审保留：已启用业务选择展示 |
| [components/auth/register-step-invite.tsx](../../../components/auth/register-step-invite.tsx) | 已审保留：邀请码输入步骤展示 |
| [components/auth/register-step-password.tsx](../../../components/auth/register-step-password.tsx) | 已审保留：密码与条款确认步骤展示 |
| [components/auth/register-step-profile.tsx](../../../components/auth/register-step-profile.tsx) | 已审保留：注册资料输入步骤展示 |
| [components/auth/register-wizard-progress.tsx](../../../components/auth/register-wizard-progress.tsx) | 已审保留：实际注册步骤的进度展示 |
| [components/auth/use-forgot-password-view-model.ts](../../../components/auth/use-forgot-password-view-model.ts) | 已审拆分：恢复会话与表单状态；发信与改密协调；页面反馈映射 |
| [components/auth/use-login-form-view-model.ts](../../../components/auth/use-login-form-view-model.ts) | 已审保留：登录输入与切换提示状态；表单反馈与提交调度 |
| [components/auth/use-login-recovery.ts](../../../components/auth/use-login-recovery.ts) | 已审保留：登录恢复器 React 生命周期；Auth/网络事件与导航接合 |
| [components/auth/use-register-wizard.ts](../../../components/auth/use-register-wizard.ts) | 已审保留：注册输入与步骤状态；邀请码和资料校验调度；Auth 注册提交协调 |
| [lib/auth-access-token.ts](../../../lib/auth-access-token.ts) | 已审保留：浏览器令牌载荷解码 |
| [lib/auth-claims.ts](../../../lib/auth-claims.ts) | 已审保留：认证声明字段提取 |
| [lib/auth-failure.ts](../../../lib/auth-failure.ts) | 已审保留：认证故障分类与重试判定 |
| [lib/auth-metadata.ts](../../../lib/auth-metadata.ts) | 已审保留：岗位与状态白名单规范化；服务端 metadata 容器读取 |
| [lib/auth-operation-receipts.ts](../../../lib/auth-operation-receipts.ts) | 已审保留：Auth 请求接受凭证；目标用户身份返回凭证；空会话退出凭证 |
| [lib/auth-request-transport.ts](../../../lib/auth-request-transport.ts) | 已审保留：认证请求有界传输；客户端传输绑定与互斥调用；等待取消与迟到拒绝订阅 |
| [lib/auth-routing.ts](../../../lib/auth-routing.ts) | 已审保留：岗位工作区映射；工作区路径识别 |
| [lib/auth-session-client.ts](../../../lib/auth-session-client.ts) | 已审保留：浏览器会话读取；恢复导航角色读取 |
| [lib/auth-shell-content.ts](../../../lib/auth-shell-content.ts) | 已审保留：认证公开文案组装 |
| [lib/browser-auth-session.ts](../../../lib/browser-auth-session.ts) | 已审保留：主动注销调度；本地认证存储与 Cookie 清理 |
| [lib/current-app-access-context.ts](../../../lib/current-app-access-context.ts) | 已审保留：严格当前数据库权限读取 |
| [lib/current-session-access-context.ts](../../../lib/current-session-access-context.ts) | 已审拆分：读取并规范化当前数据库岗位；复用同代次请求 |
| [lib/current-session-auth.ts](../../../lib/current-session-auth.ts) | 已审拆分：读取会话、用户及声明；合并重复请求；有界处理短时超时 |
| [lib/current-session-cache.ts](../../../lib/current-session-cache.ts) | 已审拆分：按客户端保存快照和请求；跟踪 Auth 事件及显式重置；阻止旧代次发布和清理 |
| [lib/current-session-context.ts](../../../lib/current-session-context.ts) | 已审拆分：区分服务器和浏览器读取；组合身份、声明和数据库岗位 |
| [lib/login-context.ts](../../../lib/login-context.ts) | 已审保留：登录身份与岗位业务一致性核对 |
| [lib/login-recovery.ts](../../../lib/login-recovery.ts) | 已审保留：有界登录恢复状态机；会话与网络事件协调 |
| [lib/password-recovery-session.ts](../../../lib/password-recovery-session.ts) | 已审保留：恢复会话状态核验；绑定 session_id 的恢复证明 |
| [lib/server-auth.ts](../../../lib/server-auth.ts) | 已审保留：服务端身份上下文复用；已登录入口调度；工作区角色/业务准入 |
| [lib/supabase-admin-server.ts](../../../lib/supabase-admin-server.ts) | 已审保留：服务端管理员客户端工厂 |
| [lib/supabase-proxy.ts](../../../lib/supabase-proxy.ts) | 已审保留：请求 Cookie 会话同步；认证入口的严格跳转调度 |
| [lib/supabase-server.ts](../../../lib/supabase-server.ts) | 已审保留：请求内服务端 Supabase 客户端工厂 |
| [lib/supabase.ts](../../../lib/supabase.ts) | 已审保留：公开 Supabase 连接配置；浏览器单例工厂与传输注册 |
| [lib/use-supabase-auth-sync.ts](../../../lib/use-supabase-auth-sync.ts) | 已审保留：Auth 订阅与回调生命周期；可见性等待与卸载取消 |
| [lib/verified-session-context.ts](../../../lib/verified-session-context.ts) | 已审保留：经 Auth 验证的严格身份与数据库权限组合 |

### Supabase

| 文件 | 阅读重点 |
| --- | --- |
| [templates/auth/recovery.html](../../../../PT5-dropshipping-supabase/templates/auth/recovery.html) | 已审拆分：本机恢复邮件正文和确认链接 |
