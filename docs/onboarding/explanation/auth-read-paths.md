# 认证代码应怎样阅读

项目保留浏览器直连 Supabase。请求层只控制认证请求的等待与取消；不会把业务写入改成自动重试。

## 从表单到工作台

登录页准备文案并检查已有会话。`login-form.tsx` 展示字段；`use-login-form-view-model.ts` 管理输入、账号切换提示和消息键；`use-login-recovery.ts` 连接 React 生命周期、Auth 事件和导航。真正有界流程在 `lib/login-recovery.ts`。

一次密码提交只发一次。响应丢失时读取已有会话，不能盲目重发密码。Auth 会话只是候选：`login-context.ts` 再核验真实用户、目标账号、数据库岗位/状态、业务范围，并在导航前确认会话没有换人。已建立身份但后续未完成时保留 `partial_failed`，页面提供继续核对。

`auth-request-transport.ts` 组合操作、调用者和超时的取消信号，并读取认证响应正文以覆盖正文停住的情况。取消等待不能证明服务端没执行；迟到任务仍订阅拒绝，避免未处理异常。恢复协调器用代次和卸载状态拒绝旧流程继续导航。

## 三类“当前权限”不能混淆

| 文件 | 实际用途 | 读取失败 |
| --- | --- | --- |
| `lib/current-app-access-context.ts` | 严格读取当前数据库岗位与状态 | 向上抛出，不能猜测岗位 |
| `lib/current-session-access-context.ts` | 浏览器交互的按客户端缓存读取 | 返回 null，编排层保留现有 claims/app_metadata 分支 |
| `lib/auth-session-client.ts` | 浏览器恢复时选择导航岗位 | 数据库优先，保留现有 claims 分支 |

严格工作台准入沿 `server-auth.ts → verified-session-context.ts → current-app-access-context.ts`；业务列表另由 `verified-workspace-business.ts` 核验。两个文件虽然都有 `getCurrentAppAccessContext` 导出，适用边界不同。新增安全接口不要根据函数名随意选一个。

`current-session-cache.ts` 用 WeakMap 隔离不同客户端。Auth 事件和显式重置让旧身份版本失效，迟到的会话、用户、声明和数据库岗位不能回填，也不能清除新版本的请求。首次订阅通知由首轮主动读取核实。`current-session-auth.ts` 合并重复 Auth 读取，`current-session-context.ts` 在等待数据库岗位后再核对版本，防止组合出两个身份的结果。

JWT 载荷解码只是读取 JSON，不验证签名。`auth-claims.ts`、`auth-metadata.ts` 只规范化字段，岗位只从服务端管理的 app_metadata 提取。用户可编辑的 user_metadata 可保存显示资料，不能授予岗位。

## 客户端工厂与 Cookie

`supabase.ts` 提供公开连接配置和浏览器单例；`supabase-server.ts` 按当前服务端请求 Cookie 创建客户端，React cache 只在同次渲染中复用，不能改成跨用户单例。`supabase-proxy.ts` 写回刷新后的 Cookie 和防缓存响应头；临时网络失败保留会话，严格页面守卫继续核验。

`supabase-admin-server.ts` 使用服务密钥，不持久保存浏览器会话。它可以绕过 RLS，调用链必须先核验当前用户与操作范围；不能导入 Client，也不能因为得到管理员客户端就默认允许操作。

## 注册与改密

注册的实际步骤来自 `register-flow.ts`，单一已启用业务会跳过业务选择。步骤展示不按英文名称排序。`use-register-wizard.ts` 管理状态、校验调度与提交协调，字段展示在各 `register-step-*`；邀请码实际查询及错误映射在 `register-form-validation.ts`。最终注册会重新核对邀请码与业务，并要求 Auth 返回用户编号及匹配邮箱。

原 [注册向导测试](../../../tests/e2e/registration-wizard.spec.ts) 的五例分别检查资料返回后保留、无效邀请码反馈、批发/停用旅游邀请分流、390px 减少动画和显式英文选择。没有点击「立即注册」，所以不证明账号创建、注册触发器、推荐绑定、邮件投递或重复提交安全。空邀请码在浏览器内得到 optional 上下文；非空值由 `get_signup_invite_context` 读取数据库的 `referral_code`、实际岗位和业务启用配置，不按邀请码前缀判断。

`SALETEST1`、`PROMO001` 是既有专属种子数据约定，不是可硬编码的业务规则；以后运行前须确认专属隔离实例已准备对应归属、有效期和使用次数。语言助手设置的是 `bs-locale` Cookie，此例未显式切换浏览器语言，标题已改为「英文选择生效」。中文/英文、桌面/手机没有形成完整交叉矩阵，也没有覆盖离线、空数据或权限终态。原受限助手仍禁止加载，注册/推荐重复业务验证按用户要求跳过，五例保持 `not_run`。[源码核对与限定验证记录](../reference/verification-2026-11-06-classification-access-e2e-review.md#2026-11-10推荐目录与注册向导原源码)

找回页区分普通请求和经过验证的恢复会话。地址参数 `type=recovery` 不代表已验证。`app/auth/confirm/route.ts` 完成 OTP 验证；本地 Auth 的恢复证明绑定 session_id 并使用 HttpOnly Cookie。表单状态在 `use-forgot-password-view-model.ts`，更新密码后还读取空会话凭证。

邮件请求被 Auth 接受不等于已投递。独立学习套件 `auth-password-maintenance` 已从账号页发信，经本机 Mailpit、真实恢复 OTP 确认与改密，独立核对 Auth 用户版本，再用无 Cookie 的新上下文确认旧密码拒绝、新密码登录与刷新。四类流程各覆盖双语／双宽度，共16组合；真实供应商投递、其他 OTP 与原受限套件分别验收。注销由主动 POST 清理认证 Cookie；GET 只去确认页，避免预加载触发退出。

改密成功需要权威用户回执、退出及空会话凭证，原成功合同保持。回执丢失或后续退出失败时，密码可能已写入；Hook 显示结果未确认，指导在无痕窗口核对新密码，不自动再次写入。弱密码、相同密码、限流或明确会话拒绝继续使用原反馈。维护本机邮件时同时检查 Auth 外部根地址、四项邮件验证路径和模板实际内容，不能只看健康接口。[改密验收与失败证据](../reference/verification-2026-11-11-password-maintenance.md)

## 怎样阅读原找回与闲置恢复测试

[forgot-password](../../../tests/e2e/forgot-password.spec.ts)包含七个原场景：受控邮件请求等待/接受/冷却、转发主机头安全跳转、限流即时反馈、真实恢复链接打开表单、失效令牌、普通会话不能伪装恢复、普通已登录访问返回工作台。请求接受和429场景明确拦截Auth请求，不证明真实投递。转发头场景不修改NEXT_PUBLIC_SITE_URL，两个公开入口使用maxRedirects=0，只核对本地响应，不访问正式站点；非法配置由`npm run test:public-site-origin`纯策略检查。

生成恢复链接会为固定账号生成令牌，即使没保存新密码也不能当作只读。该项在取得管理员客户端之前调用[专属PostgreSQL目标核验](../../../tests/test-support/disposable-fixture.ts)：要求disposable、专属项目及匹配容器、API实际网关映射、同一网络、运行状态及off/0/0。只校验声明的目标，不代替受限管理员助手的实际客户端接线审查；原受限入口仍未解除，不能因为准入函数的合成测试通过就运行原套件或声称真实Auth通过。

[stale-navigation-recovery](../../../tests/e2e/stale-navigation-recovery.spec.ts)保留正常客户端切换、桌面闲置整页加载、390px手机闲置整页加载三例。实现从[闲置Hook](../../../lib/use-stale-focus-recovery.ts)记录pointerdown/keydown之前的活动时间，经[导航Hook](../../../components/dashboard/use-admin-shell-navigation.ts)决定是否window.location.assign。默认180000毫秒，测试仅把当前页面Date.now推进181000毫秒，不改服务端/数据库时间；每个测试的新上下文隔离时间替身。这不是实际锁屏、BFCache、网络断开或所有恢复事件的验收。

两份原源码共十个声明均保留；唯一标题修正区分转发头与配置变更，恢复令牌场景只增加准入。原Auth助手仍受限，七个找回和三个导航场景not_run，源码审查/合成边界与真实页面分别记录。[本批证据](../reference/verification-2026-11-06-classification-access-e2e-review.md#2026-11-10找回密码与闲置导航原源码)

## 验证入口

运行 `npm run test:login-recovery`、`npm run test:operation-receipts`、`npm run test:admin-auth-sync` 及适用静态检查。会话缓存竞态用例随 `npm run test:learning` 执行。公开恢复测试覆盖双语、双宽度和离线恢复；独立学习浏览器套件通过真实表单登录。原受限认证辅助入口及其依赖套件仍保持未执行。

缓存竞态的[真实浏览器边界](../reference/verification-2026-11-11-session-late-browser.md)另覆盖退出取消和跨标签切换后的旧权限200响应。原四类Promise竞态仍由隔离用例直接核对。改密的连击、回执丢失、关页和退出失败已有上述16组合；注册确认继续暂缓，原受限入口仍未执行。[会话缓存验证](../reference/verification-2026-11-06-session-cache-race.md)

## 邮件确认入口接受哪些类型

当前`app/auth/confirm/route.ts`只接受`email`与`recovery`，恢复类型固定进入改密表单。SDK定义中的magiclink、email_change、sms等没有因此自动成为当前网站功能。六种不支持类型已由实际Next入口核对为跳转登录，代码在创建Auth客户端前结束；Auth用户和会话摘要未变。[只读入口核查](../reference/verification-2026-11-11-scope-audit.md#邮件确认不是所有sdk验证码类型)

注册邮件的实际投递和确认仍属于暂缓的注册流程，本次没有通过上述跳转检查将它算成已验收。
