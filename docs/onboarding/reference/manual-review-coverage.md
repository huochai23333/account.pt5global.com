# 逐文件审查覆盖快照

由 learning:refresh 按当前模块路径和有效人工摘要生成；check:learning 拒绝过期覆盖表。职责审查与运行验收分别记录。

| 模块 | 已审 | 待审 | 受阻 | 合计 |
| --- | ---: | ---: | ---: | ---: |
| [工作台路由与导航](../modules/workspace.md) | 47 | 0 | 0 | 47 |
| [认证与权限](../modules/auth.md) | 67 | 0 | 0 | 67 |
| [个人中心、账号切换与媒体](../modules/profile.md) | 53 | 0 | 0 | 53 |
| [首页与布局](../modules/home.md) | 39 | 0 | 0 | 39 |
| [共享控件、主题与动效](../modules/design-system.md) | 51 | 0 | 0 | 51 |
| [中英文文案](../modules/localization.md) | 10 | 0 | 0 | 10 |
| [帮助与公开内容](../modules/public-content.md) | 9 | 0 | 0 | 9 |
| [共享读取、恢复与格式工具](../modules/shared-utilities.md) | 24 | 0 | 0 | 24 |
| [汇率与金额换算](../modules/exchange-rates.md) | 47 | 0 | 0 | 47 |
| [线索大厅](../modules/sales-leads.md) | 32 | 0 | 0 | 32 |
| [批发客户、人员与推荐关系](../modules/wholesale-people.md) | 32 | 0 | 0 | 32 |
| [批发订单与费用](../modules/wholesale-orders.md) | 68 | 0 | 0 | 68 |
| [库存订单与专属信贷](../modules/inventory.md) | 29 | 0 | 0 | 29 |
| [物流同步与档案](../modules/logistics.md) | 20 | 0 | 0 | 20 |
| [结汇收款发布与分配](../modules/settlements.md) | 19 | 0 | 0 | 19 |
| [批发提成与推荐佣金](../modules/wholesale-commission.md) | 12 | 0 | 0 | 12 |
| [批发业务参数](../modules/business-settings.md) | 12 | 0 | 0 | 12 |
| [批发 VIP](../modules/vip.md) | 23 | 0 | 0 | 23 |
| [公司费用与运营报销](../modules/expenses.md) | 36 | 0 | 0 | 36 |
| [我的文档与资料文件夹](../modules/documents.md) | 61 | 0 | 0 | 61 |
| [公司模板与云端草稿](../modules/templates.md) | 77 | 0 | 0 | 77 |
| [系统邮件与外部连接](../modules/mail.md) | 117 | 0 | 0 | 117 |
| [工作台 AI 助手](../modules/assistant.md) | 19 | 0 | 0 | 19 |
| [审核中心](../modules/reviews.md) | 11 | 0 | 0 | 11 |
| [公告](../modules/announcements.md) | 12 | 0 | 0 | 12 |
| [账号、人员档案与私有备注](../modules/accounts.md) | 41 | 0 | 0 | 41 |
| [旅游订单与服务费用](../modules/tourism-orders.md) | 61 | 0 | 0 | 61 |
| [任务、团队与旅游协作资产](../modules/tourism-collaboration.md) | 124 | 0 | 0 | 124 |
| [业务操作凭证与共享后台运行](../modules/operations.md) | 20 | 0 | 0 | 20 |
| [开发配置与本地启动](../modules/tooling.md) | 11 | 0 | 0 | 11 |
| [测试、合同与维护脚本](../modules/verification.md) | 743 | 0 | 2 | 745 |
| [数据库迁移与回滚资料](../modules/database-history.md) | 245 | 0 | 0 | 245 |
| **总计** | 2172 | 0 | 2 | 2174 |

逐文件理由见 [manual-review.json](../manual-review.json)。过期或不完整审查计为待审，受限入口只登记。完整门槛为 npm run check:learning:complete。

更新步骤见[逐文件职责审查](../how-to/source-review.md)，业务与环境结果见[改造报告](../implementation-report.md)。
