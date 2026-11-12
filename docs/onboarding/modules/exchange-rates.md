# 汇率与金额换算

当前范围：共享。

## 业务与阅读顺序

在全局汇率页查报价与历史。管理员可人工维护当天报价、同步指定币种、补历史和预览重新核算。

数据流：汇率页 → 人工报价写入或 Edge 同步 → 核对币种、业务日期与报价凭证 → 订单及收款按相应业务日换算。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

管理员维护，获授权内部岗位只读；客户不进入全局汇率页。

完成依据：人工报价核对同一编号、本次提交和独立读回；同步逐项核对目标、计数和运行状态，历史补充还核对日末报价；没有目标时记为跳过。

## 常见维护

沿[汇率报价与同步链路](../explanation/exchange-rate-flow.md)定位入口。区分原始买入价、银行每百单位牌价和公司成交价。

验证入口：npm run test:learning:browser -- exchange-rate-manual；npm run test:learning:browser -- exchange-rate-sync-receipt；npm run test:company-exchange-rate；后端 nowapi-quotes 与 exchange-rate-current-run 测试；全局规则 SQL 仅在隔离实例执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`execute_exchange_rate_recalculation`、`get_recalculation_exchange_rate_gaps`、`get_required_exchange_rate_gaps`、`preview_exchange_rate_recalculation`、`save_boc_exchange_rate`。

源码中直接引用的数据表/存储桶：`boc_quote_verifications`、`exchange_rate`、`exchange_rate_recalculation_items`、`exchange_rate_recalculation_runs`、`exchange_rate_sync_pairs`、`exchange_rate_sync_settings`、`internal_job_request_secrets`、`user_profiles`、`user_roles_data`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: scripts/company-exchange-rate.test.mjs](../../../scripts/company-exchange-rate.test.mjs)
- [web: scripts/exchange-rate-sync-results.test.mjs](../../../scripts/exchange-rate-sync-results.test.mjs)
- [web: scripts/learning/exchange-rate-local-source.test.mjs](../../../scripts/learning/exchange-rate-local-source.test.mjs)
- [web: scripts/learning/exchange-rate-quote-fixture.test.mjs](../../../scripts/learning/exchange-rate-quote-fixture.test.mjs)
- [web: scripts/learning/exchange-rate-sync-cli.test.mjs](../../../scripts/learning/exchange-rate-sync-cli.test.mjs)
- [web: tests/e2e/exchange-rate-boc.spec.ts](../../../tests/e2e/exchange-rate-boc.spec.ts)
- [web: tests/e2e/exchange-rate-history.spec.ts](../../../tests/e2e/exchange-rate-history.spec.ts)
- [web: tests/e2e/exchange-rate-visibility.spec.ts](../../../tests/e2e/exchange-rate-visibility.spec.ts)
- [web: tests/e2e/helpers/current-exchange-rate-fixture.ts](../../../tests/e2e/helpers/current-exchange-rate-fixture.ts)
- [web: tests/learning/exchange-rate-manual.spec.ts](../../../tests/learning/exchange-rate-manual.spec.ts)
- [web: tests/learning/exchange-rate-sync-receipt.spec.ts](../../../tests/learning/exchange-rate-sync-receipt.spec.ts)
- [supabase: scripts/exchange-rate-current-run.test.mjs](../../../../PT5-dropshipping-supabase/scripts/exchange-rate-current-run.test.mjs)
- [supabase: supabase/tests/boc_exchange_rate_historical_backfill.sql](../../../../PT5-dropshipping-supabase/supabase/tests/boc_exchange_rate_historical_backfill.sql)
- [supabase: supabase/tests/boc_exchange_rate_recalculation.sql](../../../../PT5-dropshipping-supabase/supabase/tests/boc_exchange_rate_recalculation.sql)
- [supabase: supabase/tests/exchange_rate_visibility.sql](../../../../PT5-dropshipping-supabase/supabase/tests/exchange_rate_visibility.sql)
- [supabase: supabase/tests/verified_settlement_exchange_rate_repair.sql](../../../../PT5-dropshipping-supabase/supabase/tests/verified_settlement_exchange_rate_repair.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/(workspace)/[workspace]/settings/page.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/settings/page.tsx) | 已审保留：转发全局汇率页面与元数据入口 |
| [components/dashboard/exchange-rates/exchange-rate-form.ts](../../../components/dashboard/exchange-rates/exchange-rate-form.ts) | 已审拆分：初始化人工录入表单；将输入转换成写入参数 |
| [components/dashboard/exchange-rates/exchange-rate-history-fetch-dialog.tsx](../../../components/dashboard/exchange-rates/exchange-rate-history-fetch-dialog.tsx) | 已审保留：展示日期及币种输入；展示请求范围估计；呈现完成和缺失明细 |
| [components/dashboard/exchange-rates/exchange-rate-recalculation-items.tsx](../../../components/dashboard/exchange-rates/exchange-rate-recalculation-items.tsx) | 已审保留：展示订单金额变动；展示引用报价与佣金快照；展示已知失败原因 |
| [components/dashboard/exchange-rates/exchange-rate-recalculation-section.tsx](../../../components/dashboard/exchange-rates/exchange-rate-recalculation-section.tsx) | 已审保留：组织核算按钮和状态；渲染批次与明细凭证 |
| [components/dashboard/exchange-rates/exchange-rate-sync-section.tsx](../../../components/dashboard/exchange-rates/exchange-rate-sync-section.tsx) | 已审拆分：展示自动获取开关；展示自动获取币种；展示当天报价表单与回执 |
| [components/dashboard/exchange-rates/exchange-rates-client.tsx](../../../components/dashboard/exchange-rates/exchange-rates-client.tsx) | 已审保留：组装汇率页面与对话框 |
| [components/dashboard/exchange-rates/exchange-rates-form-dialog.tsx](../../../components/dashboard/exchange-rates/exchange-rates-form-dialog.tsx) | 已审保留：展示人工汇率表单；组合报价日期与具体时间 |
| [components/dashboard/exchange-rates/exchange-rates-history-section.tsx](../../../components/dashboard/exchange-rates/exchange-rates-history-section.tsx) | 已审保留：组装筛选与分页；展示桌面历史表；展示手机历史卡片 |
| [components/dashboard/exchange-rates/exchange-rates-latest-card.tsx](../../../components/dashboard/exchange-rates/exchange-rates-latest-card.tsx) | 已审保留：呈现最新原始价和成交价 |
| [components/dashboard/exchange-rates/exchange-rates-page-client.tsx](../../../components/dashboard/exchange-rates/exchange-rates-page-client.tsx) | 已审保留：呈现全局页头和权限状态；按服务器模式组合汇率区块 |
| [components/dashboard/exchange-rates/exchange-rates-sections.tsx](../../../components/dashboard/exchange-rates/exchange-rates-sections.tsx) | 已审保留：渲染汇率页头；渲染最新价网格及空状态 |
| [components/dashboard/exchange-rates/exchange-rates-utils.ts](../../../components/dashboard/exchange-rates/exchange-rates-utils.ts) | 已审拆分：准备双语提示及错误映射；格式化日期、时间和数值；计算历史选择的日期范围 |
| [components/dashboard/exchange-rates/use-exchange-rate-current-fetch.ts](../../../components/dashboard/exchange-rates/use-exchange-rate-current-fetch.ts) | 已审拆分：管理当天表单币种；提交当天获取；发布结果并刷新目录 |
| [components/dashboard/exchange-rates/use-exchange-rate-history-fetch.ts](../../../components/dashboard/exchange-rates/use-exchange-rate-history-fetch.ts) | 已审拆分：管理历史补充表单；校验范围并提交；按实际结果刷新和反馈 |
| [components/dashboard/exchange-rates/use-exchange-rate-manual-editor.ts](../../../components/dashboard/exchange-rates/use-exchange-rate-manual-editor.ts) | 已审拆分：管理人工表单及目标；阻止同帧重复并提交保存；确认并删除原记录 |
| [components/dashboard/exchange-rates/use-exchange-rate-recalculation.ts](../../../components/dashboard/exchange-rates/use-exchange-rate-recalculation.ts) | 已审保留：刷新核算状态；发起预览或执行；中断后读取已有凭证 |
| [components/dashboard/exchange-rates/use-exchange-rate-sync-settings.ts](../../../components/dashboard/exchange-rates/use-exchange-rate-sync-settings.ts) | 已审拆分：读取自动获取配置；保存自动开关；维护自动获取币种 |
| [components/dashboard/exchange-rates/use-exchange-rates-view-model.ts](../../../components/dashboard/exchange-rates/use-exchange-rates-view-model.ts) | 已审拆分：管理页面读取和刷新；计算筛选与分页；组合三个编辑入口 |
| [lib/company-exchange-rate.ts](../../../lib/company-exchange-rate.ts) | 已审保留：十进制舍入乘法；从原始汇率计算公司价 |
| [lib/exchange-rate-display.ts](../../../lib/exchange-rate-display.ts) | 已审保留：规范日期与币种显示键；按业务日及报价时间排序并分组；查找指定日期的人民币兑换记录 |
| [lib/exchange-rate-errors.ts](../../../lib/exchange-rate-errors.ts) | 已审保留：读取 Edge 返回的用户错误说明 |
| [lib/exchange-rate-manual-mutations.ts](../../../lib/exchange-rate-manual-mutations.ts) | 已审拆分：构造人工报价写入字段；创建、更新或删除原记录；独立读回本次报价 |
| [lib/exchange-rate-mutations.ts](../../../lib/exchange-rate-mutations.ts) | 已审拆分：保存自动获取配置；触发当天获取并校验；触发历史补充并校验 |
| [lib/exchange-rate-permissions.ts](../../../lib/exchange-rate-permissions.ts) | 已审拆分：读取当前身份；判断查看与管理范围 |
| [lib/exchange-rate-queries.ts](../../../lib/exchange-rate-queries.ts) | 已审保留：取得页面权限与初始数据；读取历史和当天报价；读取管理员同步配置 |
| [lib/exchange-rate-recalculation-failures.ts](../../../lib/exchange-rate-recalculation-failures.ts) | 已审保留：映射核算失败原因 |
| [lib/exchange-rate-recalculation.ts](../../../lib/exchange-rate-recalculation.ts) | 已审保留：读取运行和报价核对条件；请求并读回预览；执行并交叉核对终态 |
| [lib/exchange-rate-receipts.ts](../../../lib/exchange-rate-receipts.ts) | 已审拆分：分段读取权威报价；核对预期价格、日期、来源及日末标记 |
| [lib/exchange-rate-sync-results.ts](../../../lib/exchange-rate-sync-results.ts) | 已审拆分：解码当天批次；解码历史批次；校验计数与运行状态一致性 |
| [lib/exchange-rate-types.ts](../../../lib/exchange-rate-types.ts) | 已审保留：定义汇率、同步和页面字段合同 |
| [lib/exchange-rates-page.ts](../../../lib/exchange-rates-page.ts) | 已审保留：根据当前身份组装汇率页初值 |
| [lib/exchange-rates.ts](../../../lib/exchange-rates.ts) | 已审保留：组织汇率领域导出 |

### Supabase

| 文件 | 阅读重点 |
| --- | --- |
| [supabase/functions/exchange-rate-sync/current-sync-run.ts](../../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/current-sync-run.ts) | 已审拆分：读取计划配置；组合当天、昨日和必要缺口；汇总并记录运行凭证 |
| [supabase/functions/exchange-rate-sync/current-sync.ts](../../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/current-sync.ts) | 已审保留：处理指定币种的当日报价；构造单个报价凭证 |
| [supabase/functions/exchange-rate-sync/historical-sync.ts](../../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/historical-sync.ts) | 已审保留：逐日查询或复用报价；记录成功、跳过和失败明细 |
| [supabase/functions/exchange-rate-sync/history-sync-run.ts](../../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/history-sync-run.ts) | 已审拆分：处理选定范围历史补充；处理核算缺口补充 |
| [supabase/functions/exchange-rate-sync/index.ts](../../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/index.ts) | 已审拆分：核验请求与触发权限；登记运行并分派；记录异常终态 |
| [supabase/functions/exchange-rate-sync/nowapi-quotes.ts](../../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/nowapi-quotes.ts) | 已审保留：解析当日和历史报价；校验字段、列表完整性和时间 |
| [supabase/functions/exchange-rate-sync/providers.ts](../../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/providers.ts) | 已审保留：调用供应商接口；处理人民币固定值 |
| [supabase/functions/exchange-rate-sync/recalculation-rate-sync.ts](../../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/recalculation-rate-sync.ts) | 已审保留：读取核算缺口；限时按日期补充并统计 |
| [supabase/functions/exchange-rate-sync/request-auth.ts](../../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/request-auth.ts) | 已审保留：核验内部任务令牌；核验当前管理员身份 |
| [supabase/functions/exchange-rate-sync/required-rate-gaps.ts](../../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/required-rate-gaps.ts) | 已审保留：读取并按币种合并缺口；限时处理及重新读取剩余缺口 |
| [supabase/functions/exchange-rate-sync/settlement-repair-sync.ts](../../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/settlement-repair-sync.ts) | 已审拆分：校验并处理收款补缺负载；按原日期独立核对最终报价 |
| [supabase/functions/exchange-rate-sync/shared.ts](../../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/shared.ts) | 已审保留：提供 HTTP 和读取参数工具；规范业务日期与币种；校验历史范围 |
| [supabase/functions/exchange-rate-sync/storage.ts](../../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/storage.ts) | 已审保留：保存并核对报价编号；把历史保存结果映射成明细 |
| [supabase/functions/exchange-rate-sync/types.ts](../../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/types.ts) | 已审保留：定义 SyncTrigger、SyncRequestBody 等7项同模块类型合同 |
