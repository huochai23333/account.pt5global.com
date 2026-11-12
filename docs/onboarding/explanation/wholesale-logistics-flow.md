# 物流档案、店铺归属与断点恢复

工作台的「物流」打开 `/[workspace]/wholesale/logistics`。归档按包裹保存。店铺归属有生效区间，订单按自己的下单时间匹配业务员和客户。

阅读旧迁移时，先看[旧物流关联与分页指南](../../../../PT5-dropshipping-supabase/docs/onboarding/logistics-link-history.md)：旧费用/状态模型在后续迁移中删除，当前页面使用下面的永久归档链路。

[永久归档历史阅读](../../../../PT5-dropshipping-supabase/docs/onboarding/logistics-archive-history.md)按归档、店铺区间和同步租约分段，并区分最初游标分页与当前编号分页。

| 我想维护什么 | 从哪里开始 |
| --- | --- |
| 页面和列表 | [页面协调](../../../components/dashboard/wholesale/wholesale-logistics-section.tsx)组装筛选、列表和设置。[页面 Hook](../../../components/dashboard/wholesale/use-wholesale-logistics-page.ts)协调筛选、查询和反馈。[查询服务](../../../lib/wholesale-logistics-page.ts)向主库获取一页记录和整组筛选后的汇总。 |
| 店铺归属 | [设置弹窗](../../../components/dashboard/wholesale/wholesale-logistics-assignment-dialog.tsx)把原区间、目标业务员、客户及可选日期交给[写入服务](../../../components/dashboard/wholesale/wholesale-logistics-mutations.ts)。[归属历史](../../../components/dashboard/wholesale/wholesale-logistics-assignment-history.tsx)显示区间。 |
| 自动更新 | 页面读取主库归档后请求一次增量更新。[主系统函数](../../../../PT5-dropshipping-supabase/supabase/functions/wholesale-logistics-sync/index.ts)鉴权并启动运行。[分页执行器](../../../../PT5-dropshipping-supabase/supabase/functions/wholesale-logistics-sync/sync-runner.ts)续租、读取和逐页提交。 |
| 来源接口 | [来源适配参考](../../../../PT5-dropshipping-supabase/logistics-supabase/README.md)解释订单、状态和运费的三路游标，以及主系统和来源项目的边界。 |

管理员、业务员和财务按当前批发授权访问。业务员初始筛选为本人，归属写入按数据库角色和业务授权校验。后台调度用内部令牌识别，来源读取用另一项集成凭证。

## 两种归属调整

调整整个区间会保留原编号。选择生效日期时，数据库将原区间截到这个时刻，再建立一个新编号。旧区间结束等于新区间开始，订单下单时间恰好等于这个时刻时归入新区间。浏览器按实际编号查询区间、客户和业务员；拆分还复查旧区间。读回不确定时提示刷新核对。实际写入由现有数据库函数执行。

## 同步从哪里恢复

来源端按订单 ID、状态更新时间与 ID、运费更新时间与 ID 分别分页。主库事务一起提交档案和检查点。部分失败时，已提交页留在主库，后续运行从检查点续办。完成时核对运行编号、终态、页数、计数和包裹。页面刷新失败仍可保留既有归档。

## 验证

- `npm run test:learning:browser -- wholesale-logistics-assignment-split` 从页面验证店铺归属调整、读回中断及刷新。
- `npm run test:contracts -- logistics-paging-oracle` 使用独立清单核对分页合同。
- 后端运行 `node --test supabase/tests/logistics_retry.test.mjs`。带固定规则和角色的 SQL 仅在隔离实例执行。同步与调度的本地模拟证据见[整体报告](../implementation-report.md#邮件与物流的本地混合集成)。

[原物流页面测试维护](logistics-page-tests.md)说明独占店铺、归属完整行版本、55条独立清单、额外角色页面收尾及上下文同步拦截。原八页面与后台同步用例分别验收，真实SQL/Chrome专项不能代替原Auth产品页面通过。
