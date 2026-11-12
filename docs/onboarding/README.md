# 从这里开始维护 PT5

本轮修复已收尾，完成项、验证范围和保留的未完成项见[最终交接](reference/final-handoff-2026-11-11.md)。

这套资料面向已经写过 HTML、JavaScript 或 React 的新人。目标是让你从真实功能出发，能找到代码、理解数据和权限、修改一个小需求，并证明它确实生效。

## 建议阅读顺序

1. 阅读[本地启动](how-to/local-development.md)，确认两个仓库与本地 Docker 服务。
2. 运行 `npm run doctor`，先解决红色错误；黄色提示需要按说明判断。
3. 阅读[架构与数据流](explanation/architecture.md)和[术语表](reference/glossary.md)。
4. 在[功能地图](module-index.md)中找到你要维护的模块。先看入口和完成凭证，再打开源码。
5. 先做[文案、字段与筛选练习](tutorials/first-changes.md)，再读[线索完整链路](tutorials/sales-lead-flow.md)。
6. 涉及数据库和后台任务时，完成[后台与数据库练习](tutorials/backend-and-database.md)。
7. 按[验证手册](how-to/verification.md)保存结果，再阅读[贡献指南](../../CONTRIBUTING.md)。

## 按问题找资料

| 你的问题 | 阅读入口 |
| --- | --- |
| 一个功能的代码在哪里？ | [功能与源码地图](module-index.md) |
| 角色、业务和栏目为什么共用一个页面入口？ | [架构与数据流](explanation/architecture.md) |
| 菜单显示、页面准入和数据库授权在哪里判断？ | [工作台路由与权限链路](explanation/workspace-access.md) |
| 两个同名“当前权限”函数有什么区别？ | [认证读取与恢复链路](explanation/auth-read-paths.md) |
| 个人资料、证件和媒体怎样读取、提交与审核？ | [个人中心数据流](explanation/profile-data-flow.md) |
| 首页的待办、岗位入口和卡片布局分别改哪里？ | [首页数据流](explanation/home-data-flow.md) |
| 为什么接口成功还不一定算完成？ | [权限与业务凭证](explanation/permissions-and-outcomes.md) |
| 报错后应先查哪一层？ | [排查手册](how-to/troubleshooting.md) |
| 数据库规则在哪里？ | [后端学习入口](../../../PT5-dropshipping-supabase/docs/onboarding/README.md) |
| 我需要运行哪些测试？ | [验证手册](how-to/verification.md) |
| 怎样先运行不用登录的订单测试？ | [格式、日期与权限范围](explanation/order-read-contract-tests.md) |
| 线索转客户的测试怎样确认归属与安全清理？ | [转换测试辅助](explanation/sales-lead-conversion-tests.md) |
| 物流同步怎样使用本地来源并恢复测试配置？ | [来源夹具与恢复](explanation/logistics-source-fixture.md) |
| 工作台搜索、日期、导航和动效怎样验收？ | [界面测试维护](explanation/workspace-ui-tests.md) |
| 邮件用例、模拟服务和固定数据分别改哪里？ | [邮件测试维护](explanation/mail-test-boundaries.md)与[数据夹具](explanation/mail-fixture-data.md) |
| 怎样让地图与源码保持一致？ | [维护学习资料](how-to/maintain-learning-map.md) |
| 哪些文件已经逐一审查？ | [职责审查方法与台账](how-to/source-review.md) |

## 学完后应能完成

- 启动一个本地 Web 服务，并确认它连接的是本项目本地 Supabase。
- 从页面入口追到展示、状态、数据读取、写入、数据库权限和最终记录。
- 修改双语文案或一个展示字段，完成桌面/手机及刷新检查。
- 解释一次业务写入的成功凭证，使用独立查询核对结果。
- 说明未执行测试的具体原因，不把静态检查或模拟外部服务写成完整业务验收。

文档分为教程、操作手册、技术索引和原理说明，参考 [Diátaxis](https://diataxis.fr/start-here/)。源码索引自动生成，业务判断和验收记录由维护者核对。
