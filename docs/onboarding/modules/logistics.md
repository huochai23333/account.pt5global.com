# 物流同步与档案

当前范围：启用。

## 业务与阅读顺序

同步来源物流档案，分页查询并维护获授权的归属信息。

数据流：物流来源读取 → wholesale-logistics-sync 分页提交与检查点 → 主库永久档案 → 工作台分页；店铺归属用订单下单时间匹配生效区间。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

管理员、业务员和财务通过批发授权访问物流。后台另核验内部任务令牌，来源接口使用独立令牌。

完成依据：同步核对运行编号、持久检查点、提交页数和归档包裹。调整店铺归属核对实际区间，拆分还核对新旧编号及相邻边界。

## 常见维护

见[物流数据流](../explanation/wholesale-logistics-flow.md)。分开修改来源适配、主库分页和历史归属；分页预期独立于被测查询。

验证入口：npm run test:learning:browser -- wholesale-logistics-assignment-split；npm run test:contracts -- logistics-paging-oracle；后端 logistics_retry.test.mjs 及隔离 SQL；原浏览器套件按准入执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`assign_wholesale_logistics_stores`、`change_wholesale_logistics_store_assignment`、`claim_wholesale_logistics_sync`、`commit_wholesale_logistics_page`、`current_user_can_view_wholesale_logistics`、`end_wholesale_logistics_store_assignment`、`get_wholesale_logistics_page`、`get_wholesale_logistics_store_options`、`get_wholesale_referral_waybill_monthly_counts`、`heartbeat_operation_attempt_checked`、`release_wholesale_logistics_sync`、`renew_wholesale_logistics_sync`。

源码中直接引用的数据表/存储桶：`dianxiaomi_orders`、`internal_job_request_secrets`、`logistics_tracking`、`shipping_costs`、`wholesale_logistics_store_assignments`、`wholesale_logistics_sync_state`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: scripts/learning/logistics-assignment-case.test.mjs](../../../scripts/learning/logistics-assignment-case.test.mjs)
- [web: scripts/learning/logistics-source-fixture.test.mjs](../../../scripts/learning/logistics-source-fixture.test.mjs)
- [web: tests/contracts/logistics-paging-oracle.spec.ts](../../../tests/contracts/logistics-paging-oracle.spec.ts)
- [web: tests/e2e/helpers/logistics-assignment-case.ts](../../../tests/e2e/helpers/logistics-assignment-case.ts)
- [web: tests/e2e/helpers/logistics-fixture-time.ts](../../../tests/e2e/helpers/logistics-fixture-time.ts)
- [web: tests/e2e/helpers/logistics-page-assertions.ts](../../../tests/e2e/helpers/logistics-page-assertions.ts)
- [web: tests/e2e/helpers/logistics-paging-oracle.ts](../../../tests/e2e/helpers/logistics-paging-oracle.ts)
- [web: tests/e2e/helpers/logistics-source-fixture.ts](../../../tests/e2e/helpers/logistics-source-fixture.ts)
- [web: tests/e2e/wholesale-logistics-lifecycle.spec.ts](../../../tests/e2e/wholesale-logistics-lifecycle.spec.ts)
- [web: tests/e2e/wholesale-logistics-sync.spec.ts](../../../tests/e2e/wholesale-logistics-sync.spec.ts)
- [web: tests/e2e/wholesale-logistics.spec.ts](../../../tests/e2e/wholesale-logistics.spec.ts)
- [web: tests/learning/wholesale-logistics-assignment-split.spec.ts](../../../tests/learning/wholesale-logistics-assignment-split.spec.ts)
- [web: tests/test-support/logistics-assignment-case.ts](../../../tests/test-support/logistics-assignment-case.ts)
- [web: tests/test-support/logistics-fixture-sql.ts](../../../tests/test-support/logistics-fixture-sql.ts)
- [web: tests/test-support/logistics-fixture-store.ts](../../../tests/test-support/logistics-fixture-store.ts)
- [web: tests/test-support/logistics-source-server.ts](../../../tests/test-support/logistics-source-server.ts)
- [supabase: scripts/local-logistics-sql.test.mjs](../../../../PT5-dropshipping-supabase/scripts/local-logistics-sql.test.mjs)
- [supabase: supabase/tests/logistics_continuation.sql](../../../../PT5-dropshipping-supabase/supabase/tests/logistics_continuation.sql)
- [supabase: supabase/tests/logistics_page_performance_fixture.sql](../../../../PT5-dropshipping-supabase/supabase/tests/logistics_page_performance_fixture.sql)
- [supabase: supabase/tests/logistics_page_performance_observations.sql](../../../../PT5-dropshipping-supabase/supabase/tests/logistics_page_performance_observations.sql)
- [supabase: supabase/tests/logistics_retry.test.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/logistics_retry.test.mjs)
- [supabase: supabase/tests/logistics_rollback_after.sql](../../../../PT5-dropshipping-supabase/supabase/tests/logistics_rollback_after.sql)
- [supabase: supabase/tests/logistics_rollback_before.sql](../../../../PT5-dropshipping-supabase/supabase/tests/logistics_rollback_before.sql)
- [supabase: supabase/tests/logistics_write_resume.sql](../../../../PT5-dropshipping-supabase/supabase/tests/logistics_write_resume.sql)
- [supabase: supabase/tests/wholesale_logistics_archive.sql](../../../../PT5-dropshipping-supabase/supabase/tests/wholesale_logistics_archive.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [components/dashboard/wholesale/use-wholesale-logistics-page.ts](../../../components/dashboard/wholesale/use-wholesale-logistics-page.ts) | 已审保留：管理筛选和分页请求；协调打开页面后的来源更新；调度归属写入与反馈 |
| [components/dashboard/wholesale/wholesale-logistics-assignment-dialog.tsx](../../../components/dashboard/wholesale/wholesale-logistics-assignment-dialog.tsx) | 已审保留：维护归属表单和当前编辑区间；呈现店铺选择、日期和归属历史入口 |
| [components/dashboard/wholesale/wholesale-logistics-assignment-history.tsx](../../../components/dashboard/wholesale/wholesale-logistics-assignment-history.tsx) | 已审保留：呈现历史区间及客户和业务员；调度调整与确认结束 |
| [components/dashboard/wholesale/wholesale-logistics-display.ts](../../../components/dashboard/wholesale/wholesale-logistics-display.ts) | 已审保留：格式化运费、日期及关联名称；从已授权人员选择活跃业务员 |
| [components/dashboard/wholesale/wholesale-logistics-filters.tsx](../../../components/dashboard/wholesale/wholesale-logistics-filters.tsx) | 已审保留：渲染日期、关键词、店铺和运费条件；调度快速日期与全历史精确查询 |
| [components/dashboard/wholesale/wholesale-logistics-mutations.ts](../../../components/dashboard/wholesale/wholesale-logistics-mutations.ts) | 已审保留：提交首次分配、调整与结束归属；核对回执及拆分前后区间 |
| [components/dashboard/wholesale/wholesale-logistics-records.tsx](../../../components/dashboard/wholesale/wholesale-logistics-records.tsx) | 已审保留：呈现桌面表格、手机卡片和空状态；复用单条运费状态展示 |
| [components/dashboard/wholesale/wholesale-logistics-section.tsx](../../../components/dashboard/wholesale/wholesale-logistics-section.tsx) | 已审保留：物流页面组装；设置弹窗开关与交互调度 |
| [components/dashboard/wholesale/wholesale-logistics-summary.tsx](../../../components/dashboard/wholesale/wholesale-logistics-summary.tsx) | 已审保留：展示按币种汇总和更新时间 |
| [lib/wholesale-logistics-page.ts](../../../lib/wholesale-logistics-page.ts) | 已审保留：加载主库归档、归属及汇总；发起同步并核对运行终态；提供物流记录和筛选类型 |

### Supabase

| 文件 | 阅读重点 |
| --- | --- |
| [logistics-supabase/supabase/functions/logistics-archive-export/index.ts](../../../../PT5-dropshipping-supabase/logistics-supabase/supabase/functions/logistics-archive-export/index.ts) | 已审保留：验证来源接口的集成令牌；处理 HTTP 方法和来源归档请求 |
| [logistics-supabase/supabase/functions/logistics-archive-export/source-logistics-queries.ts](../../../../PT5-dropshipping-supabase/logistics-supabase/supabase/functions/logistics-archive-export/source-logistics-queries.ts) | 已审保留：构建来源端服务客户端；按订单、状态和运费游标读取必要字段 |
| [logistics-supabase/supabase/functions/logistics-archive-export/source-logistics-types.ts](../../../../PT5-dropshipping-supabase/logistics-supabase/supabase/functions/logistics-archive-export/source-logistics-types.ts) | 已审保留：定义 DianxiaomiOrderRow、LogisticsTrackingRow 等7项同模块类型合同 |
| [logistics-supabase/supabase/functions/logistics-archive-export/source-logistics.ts](../../../../PT5-dropshipping-supabase/logistics-supabase/supabase/functions/logistics-archive-export/source-logistics.ts) | 已审保留：规范化来源请求及游标；按包裹合并来源字段；组织全量或增量分页 |
| [supabase/functions/wholesale-logistics-sync/archive-import.ts](../../../../PT5-dropshipping-supabase/supabase/functions/wholesale-logistics-sync/archive-import.ts) | 已审保留：来源字段投影；单页原子提交及回执校验 |
| [supabase/functions/wholesale-logistics-sync/index.ts](../../../../PT5-dropshipping-supabase/supabase/functions/wholesale-logistics-sync/index.ts) | 已审保留：核验请求并登记运行；调度来源同步及运行终态 |
| [supabase/functions/wholesale-logistics-sync/request-auth.ts](../../../../PT5-dropshipping-supabase/supabase/functions/wholesale-logistics-sync/request-auth.ts) | 已审保留：验证内部任务令牌；核验登录身份及物流读权限 |
| [supabase/functions/wholesale-logistics-sync/retry.ts](../../../../PT5-dropshipping-supabase/supabase/functions/wholesale-logistics-sync/retry.ts) | 已审保留：分类临时依赖故障和等待提示；按时间预算退避、续租和接续 |
| [supabase/functions/wholesale-logistics-sync/source-api.ts](../../../../PT5-dropshipping-supabase/supabase/functions/wholesale-logistics-sync/source-api.ts) | 已审保留：来源游标校验；来源行规范化；受控分页读取与重试 |
| [supabase/functions/wholesale-logistics-sync/sync-runner.ts](../../../../PT5-dropshipping-supabase/supabase/functions/wholesale-logistics-sync/sync-runner.ts) | 已审保留：租约和操作心跳；分页读取与原子提交调度；检查点释放及最终凭证校验 |
