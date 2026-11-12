# 手工发布结汇收款恢复验证

2026-11-05。本批走 Web 关键写入门槛，使用现有本机 Web、Auth、PostgREST 和数据库。浏览器使用 [Playwright 网络路由](https://playwright.dev/docs/network)丢弃实际提交后的响应，并暂时阻断独立读回。两端均使用人民币专属夹具。

## 复现和修复

旧页面首次提交已经写入，响应丢失后按原内容重试，数据库出现两条各 100.25 元的收款，请求编号均为空。原失败日志位于 `output/test-runs/2026-11-05T12-47-30-928Z-2727b0b5-170b-4c5a-983a-52aa2fe94b0d`，独立查询结果和夹具清理附件保留。

发布前先生成请求编号。恢复期间同一表单意图复用该编号，按发布人、编号及收款内容读回。改动金额会保留原待确认状态，不发第二个写请求。核对按钮只查询；独立确认后，用户可按同样金额和客户另发一笔。待确认时，标签页只暂存请求编号和内容摘要。关闭标签页、切换设备及浏览器禁用会话存储后的刷新恢复不在本批验证范围。

## 最终凭证

| 页面与岗位 | 原收款编号 | 发布恢复 | 下一次独立发布 |
| --- | --- | --- | --- |
| 中文 1440px 管理员 | `b2f78fbb-a140-4633-bdca-4969af9267d0` | 首帧连击仅发送一次。改金额被拦截。恢复原金额重试沿用 `6bfa7421-b105-4606-a86d-97f1c8b74add`。 | `df90106f-fef9-4be1-bdb1-cc4146bcca89` |
| 英文 390px 财务 | `e9e51e2c-b1c8-41b5-a27d-3cbaab4e0a00` | 首帧连击仅发送一次。刷新后点「Check previous publication」，仅查询 `ee41ee4c-f1c5-4e79-89a3-9fd4d8723975`。 | `bfd84a99-4969-49f1-b7f9-5ed8fa187e43` |

两端恢复后原行完整保持，金额 100.25 CNY，状态 `pending`。刷新后按客户名查询仍显示原行。随后另发一笔取得新编号，再刷新显示且仅显示这两笔夹具收款。两端清理后，专属收款、账号、布局和资料请求均为零。

手机截图首次核对发现，提示位于滚动区域上方，发布后没有进入视口。表单现在将反馈区滚入视口。最终测试要求提示与核对按钮至少 95% 进入视口并核对无页面横向溢出，截图人工核对通过。发布和清空两组共 4 例，完整日志为 `output/test-runs/2026-11-05T12-58-26-978Z-fadda2ae-e9db-463e-a259-d2d1c9f70f11`。截图、发布请求编号、独立读回和清理回执位于 `output/learning-browser-settlement-publication-verified`。

已有后端 `wholesale_settlement_releases.sql` 在隔离迁移重放中退出 0，记录位于后端 `output/learning-2026-11-05-inventory-credit-replay/sql/final-results.json`。本批复用现有请求编号、权限和数据库签名。复查共享本机的活动计划任务和待发外部请求均为 0。

## 质量门槛

使用 npm 11.16.0，原回归流程在认证端到端套件之前的 27 个步骤和 doctor 全部通过，包含 lint、类型、文案、学习地图、操作契约、回执、Edge 入口和生产构建。逐项完整日志目录与退出码见 `output/learning-browser-settlement-publication-verified/quality-gate.json`。原测试的静态审计核对 118 个入口，其中 115 个仍触及受限辅助文件，读取受限文件数为 0，日志 `2026-11-05T13-03-38-106Z-9e936d46-febe-4e60-80c0-133ffc85dc82`。其余 3 个原入口实际运行，14 例通过，日志 `2026-11-05T13-04-06-342Z-a191c887-952e-4962-8283-b53a064932b4`。

`check:learning:complete` 报告 1,021 条未完成记录，其中 1,019 待审、2 受阻。结汇模块 19 / 19 份文件具有效审查摘要，完整项目保持 `partial_failed`。测试保持单个已有 Web 服务，构建后重新请求本机登录页返回 200。保留原始失败、最终截图、质量门槛日志和一张移动端修复前截图。已清理两份中间浏览器输出。

## 职责变化

下表使用本机 Git HEAD 和当前文件比较，包含此前同文件的本地改动。

| 文件 | 行数 | 当前职责 |
| --- | --- | --- |
| `use-wholesale-settlement-release-actions.ts` | 194 → 172 | 调度取消、分配、清空和缺汇率恢复，委托发布 |
| `wholesale-settlement-release-client.tsx` | 41 → 41 | 组装页面、操作对象及岗位能力 |
| `wholesale-settlement-release-section.tsx` | 283 → 291 | 组装列表、筛选、汇总与弹窗 |
| `wholesale-settlement-release-dialogs.tsx` | 158 → 195 | 发布表单输入、核对反馈和弹窗交互 |
| `use-wholesale-settlement-release-publication.ts` | 新增 111 | 标签页暂存、共享防连击执行器、发布与只读核对调度 |
| `wholesale-settlement-release-publication.ts` | 新增 102 | 收款摘要、写入与权威收款读回 |

维护链路、数据来源和定向命令见[结汇收款数据流](../explanation/wholesale-settlement-release-flow.md)。
