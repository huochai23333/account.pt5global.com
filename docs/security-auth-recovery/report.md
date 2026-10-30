# 依赖安全与登录断线恢复验收报告

## 交付状态

本地代码已实施，完整及生产依赖审计均为 **0 告警**。本轮整体验收状态为 `partial_failed`：受现有认证／管理员辅助入口准入限制，真实角色登录、独立认证／数据库记录读回和工作台刷新验收仍未执行。本报告及 `validation.json` 保存本地验收完成、上传前的状态快照；当时 GitHub、Supabase Cloud 和 Hostinger 均未写入或发布，后续上传与部署须分别核验。

本次修复的是 `PT5-dropshipping-web`，对应 `account.pt5global.com`。用户后来提供的 `account.pt5china.com` 网络拦截截图另作只读排查；China 仓库没有修改。

## 依赖处理与证据

Hostinger 页面原始扫描显示时间为 `2026-10-29 06:00`，共 48 行（严重 4、高 14、中等 27、低 3），已经逐行保存到 [原始清单](hostinger-before.tsv)。[逐项处置对照](advisory-comparison.json) 中 29 行对应升级，19 行对应依赖移除；每行线上状态仍是 `pending_deployment`，不得把本地修复当成 Hostinger 已清除告警。

| 依赖／工具 | 本地处置 |
| --- | --- |
| Next.js／eslint-config-next | `16.3.4` → `16.4.3`，保持版本一致 |
| sharp | 覆盖版本 `0.35.4` → `0.35.5`，实际本机图片转换通过 |
| postcss | 覆盖版本 `8.5.25` → `8.5.32` |
| nodemailer | `10.0.10` → `10.3.1`，实际邮件构建与收件人集合检查通过 |
| sanitize-html | `2.17.7` → `2.18.1`，实际现有邮件清洗函数检查通过 |
| brace-expansion／zod | 保持上游允许范围，更新锁文件至已修复版本 |
| shadcn CLI 及相关间接依赖 | 移除项目依赖；状态变体样式等价保存为本地源文件 |
| Supabase SDK／React | 保持 `2.100.1`／`0.10.0` 和 `19.2.4`，Supabase 版本改为精确固定 |

本地原始审计为 17 个受影响包组，不能与 Hostinger 的 48 行直接等同；保留 [升级前报告](audit-before.json)、[升级后完整报告](audit-after.json) 和 [升级后生产报告](audit-production-after.json)。另按升级前各公告的版本范围遍历最终锁文件，确认没有仍落在这些已知受影响范围的安装版本。

shadcn 样式与 npm 官方 `shadcn@4.1.0` 发布包中的 `dist/tailwind.css` 对比，仅新增来源注释，规范化换行后的规则完全相同；SHA-256 和下载来源见 [等价性证据](style-equivalence.json)，MIT 许可保存在 [许可文件](shadcn-LICENSE.md)。未执行跨主版本降级或忽略告警。

相关原文：[Next.js 图片安全公告](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw)、[Next.js 16.4.3](https://github.com/vercel/next.js/releases/tag/v16.4.3)、[Nodemailer 10.3.1](https://github.com/nodemailer/nodemailer/releases/tag/v10.3.1)、[deepmerge 维护者问题记录](https://github.com/TehShrike/deepmerge/issues/273)。

## 登录行为与验证

密码提交、初始会话、登录事件和令牌刷新统一进入恢复协调器。密码请求最多等待 15 秒，一次操作总预算为 30 秒，只读核验最多两次、间隔 500 毫秒；实际请求支持取消。密码不会自动重放，旧操作晚到或跨标签切换身份不会继续错误跳转。

候选会话先经过 Auth 服务身份核验，再读取数据库实际账号状态、角色和业务权限，最后复核当前浏览器身份没有切换。读取失败不使用旧元数据或默认业务继续跳转。只有明确会话失效或账号停用才清理；服务端临时认证失败向上返回错误，保留 Cookie。认证已完成但后续失败记为 `partial_failed`，页面提供“检查登录状态”。入口跳转继承 SDK 的防缓存头，防止刷新 Cookie 被缓存。

日志只保存 `pt5.auth`、随机操作编号、时间、阶段、耗时、类别和结果，不记录用户邮箱、密码、令牌、Cookie 或正文。没有新增公开接口、数据库结构或迁移。

| 验证 | 结果 | 证明范围 |
| --- | --- | --- |
| `npm run test:login-recovery` | 42 通过、0 失败、0 跳过 | 真实恢复／传输／权限／代理模块，边界为合成数据 |
| `npm run test:security-dependencies` | 4 通过、0 失败、0 跳过 | 现有清洗函数、实际邮件构建、实际 PNG→WebP 转换 |
| `npm run test:public-login-recovery` | 原 6 项通过 | 真实本地生产构建页面；密码请求在浏览器中止或返回合成错误 |
| 公共页追加 `--grep 共享认证面板` | 4 通过 | 注册／找回密码共用面板，320/1440px，无认证写入 |
| `npm run test:mail-security` | 9 通过 | 邮件加密及标准错误向量 |
| `npm run test:mail-intake` | 12 通过 | 邮件识别、收件人及负责人规则 |
| `npm run test:public-site-origin` | 37 通过 | 公开来源、授权返回与跳转边界 |
| `scripts/auth-operation-receipts.test.mjs` | 3 通过 | 身份／退出回执合同 |
| `npm run test:template-content-sandbox` | 脚本通过 | 合成浏览器存储、Cookie 与模板响应沙箱 |
| lint／TypeScript／i18n／页面结构／操作合同 | 通过 | 操作合同检查 41 项；未把静态检查当成真实认证通过 |
| `npm run build` | 通过 | Next.js 16.4.3 生产构建及类型检查 |
| 两种 npm audit | 各 0 告警 | 本地实际锁文件／依赖树 |

公共页覆盖：连接重置、错误密码、限流、真实 15 秒等待取消、重复密码请求计数、键盘恢复、刷新、中英文及 1440/390/320px；均无页面脚本异常。失败诊断核对不含合成邮箱或密码。初次浏览器检查发现的服务端／浏览器初始反馈不一致已经修正，最终复验无该错误。320px 品牌头允许语言按钮换行，共用注册及找回密码页面也已验证无横向溢出。

受控红绿检查在内存中把服务端临时错误处理改回“空用户”错误行为，相关断言以 `Missing expected rejection` 失败 1 项；未改写实际源文件。随后正常实现的恢复套件 42 项全部通过。这只证明断言能识别该错误，不是数据库业务终态的红绿证明。

可视证据：[桌面反馈](login-zh-1440.png)、[390px 中文](login-zh-390.png)、[320px 中文](login-zh-320.png)、[390px 英文](login-en-390.png)。

仍未验证：三套相关原始认证套件 `auth.spec.ts`、`auth-network.spec.ts`、`account-switcher.spec.ts` 未执行；不能通过替换账号／管理员辅助入口规避 [现有准入限制](../real-e2e-blockers.md)。真实验收仍需从页面使用专用本地角色登录，独立核对用户编号、会话编号、数据库角色／状态／业务权限和工作台正文，并刷新复核。零影响行数、汇率缺失及外部异步投递不属于本次新增写入，本轮未制造对应业务夹具。

## 现场网络证据与 China 站点

用户保存的日志指向 `ehzveltsktfusrhtgzqt.supabase.co/auth/v1/token?grant_type=password` 的 `ERR_CONNECTION_RESET`／`Failed to fetch`。按用户确认的北京时间 `2026-10-30 22:40–23:00`，只读核查相邻窗口 `22:35–23:05` 的云端日志：存在 5 次 `/auth/v1/token` 的 200 响应、79 次 `/auth/v1/user` 的 200 响应和两条登录审计事件。密码与刷新请求不能仅按这个计数区分，且浏览器记录缺少时间戳／请求编号，仍无法确认哪条会话来自当次操作。

后续截图是 ASUS／趋势科技家庭网络防护页，网址为 `account.pt5china.com`，不能与 Global 的依赖扫描混为同一结果。此次只读观察如下：

- [趋势科技官方评级查询](https://global.sitesafety.trendmicro.com/) 输入 `https://account.pt5china.com` 后显示 **Untested / Newly Observed Domain**，与截图中的危险页结论不同；这不能证明网站已安全或断定为误报。
- 本机默认 DNS 当时返回 `13.196.126.154`；Google HTTPS DNS 查询返回 `77.37.76.83`、`92.112.198.38`。本机普通 HTTPS 请求因证书名称不匹配而失败；没有忽略证书校验或绕过拦截页。
- Hostinger 的 China 站点当时显示 **71 项依赖告警**：严重 6、高 26、中等 35、低 4，显示扫描时间 `2026-10-29 06:01`，Next.js 为 `16.2.12`。本次 Global 代码不会清除这些 China 告警。
- China 的 Hostinger 恶意软件扫描页只显示加载占位和“仅扫描文件、不含数据库”的说明，未取得最终扫描结果，不能记为无恶意程序。

后续处理顺序是单独修复 China 依赖、取得托管文件安全检查及证书／域名解析的核验结果，再根据结果使用 [官方分类复核渠道](https://success.trendmicro.com/en-US/solution/KA-0000017)。本轮未提交申诉、未添加放行项，未修改 DNS、VPN、证书或安全防护配置；没有把尚未确定的评级差异写成误报结论。

## 架构、文档与清理

表单模型从 176 行缩为 53 行；恢复 Hook 74 行、协调器 175 行、错误分类 44 行、传输模块 73 行、可信登录上下文 31 行、严格业务读取 21 行。表单 109→117 行，认证面板 93→94 行，服务端入口 126→129 行，代理 150→169 行。各文件职责和完整行数见 [统计](module-sizes.json)，没有新增超过 500 行的核心文件；关键数据流与失效边界均补充中文注释。

README 已更新登录直连、超时／恢复行为、日志、测试准入、审计和本地状态样式维护说明。所有验收源文件和最终证据留在本目录及相应源码目录；专用测试输出、样式校验下载和本轮新建编译缓存的清理结果记录在 [清理记录](cleanup.json)。用户原始证据、原有共享目录和备份保留。
