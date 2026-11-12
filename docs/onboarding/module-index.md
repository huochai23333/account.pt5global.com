# 功能与源码地图

每一行对应一个模块，点击名称查看阅读顺序、权限、完成凭证和完整源码表。

| 模块 | 当前范围 | Web 文件 | 后端文件 |
| --- | --- | ---: | ---: |
| [工作台路由与导航](modules/workspace.md) | 共享 | 47 | 0 |
| [认证与权限](modules/auth.md) | 共享 | 66 | 1 |
| [个人中心、账号切换与媒体](modules/profile.md) | 共享 | 40 | 13 |
| [首页与布局](modules/home.md) | 共享 | 39 | 0 |
| [共享控件、主题与动效](modules/design-system.md) | 共享 | 51 | 0 |
| [中英文文案](modules/localization.md) | 共享 | 10 | 0 |
| [帮助与公开内容](modules/public-content.md) | 共享 | 9 | 0 |
| [共享读取、恢复与格式工具](modules/shared-utilities.md) | 共享 | 24 | 0 |
| [汇率与金额换算](modules/exchange-rates.md) | 共享 | 33 | 14 |
| [线索大厅](modules/sales-leads.md) | 启用 | 27 | 5 |
| [批发客户、人员与推荐关系](modules/wholesale-people.md) | 启用 | 32 | 0 |
| [批发订单与费用](modules/wholesale-orders.md) | 启用 | 68 | 0 |
| [库存订单与专属信贷](modules/inventory.md) | 启用 | 29 | 0 |
| [物流同步与档案](modules/logistics.md) | 启用 | 10 | 10 |
| [结汇收款发布与分配](modules/settlements.md) | 启用 | 19 | 0 |
| [批发提成与推荐佣金](modules/wholesale-commission.md) | 启用 | 12 | 0 |
| [批发业务参数](modules/business-settings.md) | 启用 | 12 | 0 |
| [批发 VIP](modules/vip.md) | 启用 | 23 | 0 |
| [公司费用与运营报销](modules/expenses.md) | 共享 | 36 | 0 |
| [我的文档与资料文件夹](modules/documents.md) | 共享 | 60 | 1 |
| [公司模板与云端草稿](modules/templates.md) | 共享 | 75 | 2 |
| [系统邮件与外部连接](modules/mail.md) | 共享 | 117 | 0 |
| [工作台 AI 助手](modules/assistant.md) | 共享 | 19 | 0 |
| [审核中心](modules/reviews.md) | 共享 | 11 | 0 |
| [公告](modules/announcements.md) | 共享 | 12 | 0 |
| [账号、人员档案与私有备注](modules/accounts.md) | 共享 | 41 | 0 |
| [旅游订单与服务费用](modules/tourism-orders.md) | 当前业务停用 | 61 | 0 |
| [任务、团队与旅游协作资产](modules/tourism-collaboration.md) | 按当前业务清单限制 | 124 | 0 |
| [业务操作凭证与共享后台运行](modules/operations.md) | 共享 | 17 | 3 |
| [开发配置与本地启动](modules/tooling.md) | 开发 | 6 | 5 |
| [测试、合同与维护脚本](modules/verification.md) | 开发 | 525 | 220 |
| [数据库迁移与回滚资料](modules/database-history.md) | 历史源文件 | 0 | 245 |

机器清单：[module-map.json](module-map.json)。静态结构扫描：[source-review.json](source-review.json)。[逐文件审查覆盖](reference/manual-review-coverage.md)。

源码扫描未读取环境文件、种子账号或两份受限测试辅助文件。扫描结果不能代替人工业务判断、真实页面和数据库终态验证。
