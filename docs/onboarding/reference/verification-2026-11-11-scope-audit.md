# 当前入口与未完成边界核销

本页保留该次只读核查时的2172份源码与后台缺口快照。后续[三个后台入口验证](verification-2026-11-11-cleanup-workers.md)已补齐下表最后三项的实际运行，并修复清理重试遗漏；新增迁移与回归同批审完，最新数量和状态以[当前验收](verification-2026-11-11-current-candidate.md#当前完成度与结束条件)为准。

本次只读核查用于纠正汇总中的过期或过宽表述，继续沿用原计划；源码总量、待审文件、业务场景分别统计。源码仍为2172，有效已审2170、普通待审0、原受限2。本批没有新增生产源码、测试文件或业务写入。

## 邮件确认不是所有SDK验证码类型

当前`app/auth/confirm/route.ts`只接受`email`和`recovery`。恢复类型已有[16种实际页面组合](verification-2026-11-11-password-maintenance.md)；注册邮件确认保留在用户暂缓的注册范围。其余SDK类型不构成当前网站新增待验功能。

本次直接请求实际Next.js入口，`magiclink`、`email_change`、`sms`、`invite`、`signup`和`unknown`各一次，均按现行代码在创建Auth客户端前307转到`/login`。没有发送或验证真实邮件令牌。Auth用户与会话的完整行／xmin摘要前后相同。这里只证明不支持类型的早期跳转，不把注册投递或登录流程记为通过。

## 中行官网和完整核验缺口

本机以正常TLS读取[中行官网牌价页](https://www.boc.cn/sourcedb/whpj/)，HTTP200，2026-11-11T11:42:00.843Z取得29,842字节。原响应SHA-256为`522e585d2a6f60655f056e63f0b91705594e1bc38860f76eb404685b0da2c011`；仅保留两行必要数据及摘要，没有复制整站内容。

| 现汇买入价，单位为100外币兑换人民币 | 官网原始值 | 页面发布时间 |
| --- | --- | --- |
| EUR | 740.23 | 2026/11/11 19:39:57 |
| USD | 665.9 | 2026/11/11 19:39:57 |

这些是官网返回的参考牌价。正式重算门槛仍要求USD／EUR各自的`current`和`historical`四类记录，供应商和中行的**同一发布时间**、原始报价、历史完整性必须对应。当前四类合格记录仍为0。

检查的Web本地配置与当前Edge容器环境均没有`NOWAPI_APP_KEY`／`NOWAPI_SIGN`，输出只保存存在性，不保存配置值。官网读取已取得独立来源证据；供应商对照和完整历史仍未完成。没有调用真实供应商、补造核验行或把`history_complete`设为真。当前报价与核验表摘要前后一致。

## 后台入口的有限清单

运行账本当前登记11种启用任务，其中6种配置独立worker，其余5种由Web或媒体入口直接执行。任务类型数与待审文件数分开。当前两仓库共有8个Deno真实入口：

| 入口 | 当前证据及仍缺范围 |
| --- | --- |
| `exchange-rate-sync` | [原CLI本地完整接线](verification-2026-11-11-rate-cli.md)，真实Auth／网关／Edge／数据库，报价供应商模拟；真实银行对照仍缺 |
| `sales-lead-sync` | [原小时／分钟自然调度](verification-2026-11-11-auto-dispatch.md)，含60／300秒重试与独立终态 |
| `user-media-mutate` | [实际媒体教程](verification-2026-11-11-media-tutorial.md)，页面上传、版本／Storage SHA、删除和刷新 |
| `user-media-image-review` | 同一教程执行真实worker，提供商禁用时转人工，运行终态和管理员通过各有凭证 |
| `wholesale-logistics-sync` | [本地混合集成](../implementation-report.md#邮件与物流的本地混合集成)，真实Deno、SDK、重试和SQL，来源HTTP模拟 |
| `document-library-cleanup` | 编译和纯清理引擎有证据，当前实际HTTP入口到Storage／登记终态仍需补齐 |
| `user-media-cleanup` | 编译及已有媒体变更用例不覆盖这一独立清理入口，实际worker终态仍需补齐 |
| `logistics-archive-export` | 来源HTTP模拟覆盖主项目同步；来源仓库实际导出入口、SDK和源表查询闭环仍需独立核对 |

后面三项是本次从“其他后台入口”中定位出的具体缺口，继续处理。该表不替代原完整套件，也不把一种入口通过扩大成所有定时规则通过。已完成的[订单评估自然到期](verification-2026-11-11-assessment-automatic.md)和[附件](verification-2026-11-11-attachment-interruption.md)、[VIP](verification-2026-11-11-vip-access.md)另有凭证，不重复累计。

## 当前完成判定

原完整源码门槛和原完整回归仍受两份辅助入口限制；已通过的独立学习套件保持自己的范围。库存归属／空值、注册／推荐重复验证仍按用户要求暂缓。其他业务岗位及缺失状态继续按对应原指南核对，不能用旧段落里的“其他”无限追加测试要求。

首次只读脚本将实际单数表`exchange_rate`误写为复数，查询在任何HTTP动作之前失败，未产生写入；核对当前目录后修正，原失败日志保留。复核运行退出0，日志`2026-11-11T11-41-52-716Z-2fb64cb6-2914-4b3c-b817-cbe46f188546`。用户、会话、报价、核验行及任务状态摘要相同，主项目调度`off`、活动任务0、队列0、运行269。原环境、Web服务和其他容器均未变。

当前学习检查与最终日志摘要见`output/learning-scope-audit-20261111/final-verification.json`。整体保持`partial_failed`，没有上传、部署、Cloud写入、付款或真实邮件发送。
