# 批发业务员提成与客户推荐佣金

从 `/[workspace]/wholesale/commission` 进入。地址的 `board` 记录所选标签。客户只可进入客户推荐佣金。业务员提成由服务端按岗位及数据范围读取，管理员可把待结算提成标记为已结算。

| 维护任务 | 阅读入口 |
| --- | --- |
| 增减标签权限或调整默认标签 | [服务端可用标签](../../../lib/wholesale-commission-boards.ts)和[地址选择 Hook](../../../components/dashboard/wholesale/use-wholesale-commission-board.ts)。服务端允许的标签决定读取范围。 |
| 修改提成列表、筛选或文字 | [页面](../../../components/dashboard/wholesale/wholesale-commission-page.tsx)挂载两个独立区块。[提成视图模型](../../../components/dashboard/wholesale/use-wholesale-incentive-view-model.ts)管理筛选和汇总，[提成记录](../../../components/dashboard/wholesale/wholesale-commission-records.tsx)呈现桌面表格和手机卡片。 |
| 维护结算确认 | [结算服务](../../../lib/wholesale-commission-settlement.ts)按记录编号及待结算状态更新，再按编号独立核对结算状态与本次时间。 |
| 调整推荐佣金的读取或展示 | [查询调度](../../../lib/wholesale-commission-page.ts)独立收集两个标签的读取结果。[推荐佣金服务](../../../lib/wholesale-referral-commissions.ts)分页读取并归一化数据库返回的字段，[推荐区块](../../../components/dashboard/wholesale/wholesale-referral-commission-section.tsx)负责筛选、分页和呈现。 |

批发提成从数据库订单与参数快照计算。页面说明展示当前规则，单笔仍用创建时锁定的版本。推荐佣金按推荐关系和月份汇总。中行当日报价缺失时，数据库拒绝给出金额，推荐佣金标签提示重新加载，业务员提成可独立打开。

[参数版本历史指南](../../../../PT5-dropshipping-supabase/docs/onboarding/template-parameter-history.md)说明发布、预约取消、写入时刻与订单固定版本的关系。改当前规则不会把旧订单改成新版本；修改旧订单金额时仍按原版本重算。

客户分类按客户在上海时间2026-10-08零点之前或之后创建确定。existing按非负毛利，new按服务费；未全额收款时提成基数为0。日常修改保留已结算提成整行。原历史迁移曾明确重算全部提成并保留结算凭证，这与日常改比例不同，详见[分类与费用](../../../../PT5-dropshipping-supabase/docs/onboarding/template-parameter-history.md#客户分类提成与展示费用)。

提成按钮的共用执行器拦截首帧连击。另一个管理员已结算、旧页面重试或记录取消时，更新影响零行，原结算时间保留。断线后成功读回本次时间才显示已结算。读回也失败时，先刷新并核对记录状态。此操作登记提成状态，页面上的最终凭证是原提成编号及结算时间。

- `npm run test:learning:browser -- wholesale-commission-settlement`。使用专属管理员与客户，从页面操作，独立核对提成编号、状态和时间，再刷新检查。
- [后端佣金与费用测试](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_customer_commission_and_fees.sql)。涉及固定账号和规则快照，使用隔离实例。

[原合并页测试维护](commission-merge-tests.md)说明10个原场景、岗位金额查询、UUID订单、完整行版本、真实函数故障恢复与限定清理。12项离线专项和专属PG证据分开记录，原Auth页面仍未执行；没有增加旧地址兼容处理。
