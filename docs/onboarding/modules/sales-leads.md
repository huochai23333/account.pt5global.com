# 线索大厅

当前范围：启用。

## 业务与阅读顺序

让管理员与业务员查看、领取、跟进和转化线索。

数据流：批发工作台 → SalesLeadsClient 组装列表与弹窗 → 分离的列表、线索操作、客户草稿和同步流程 → 数据库与导入函数。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

有效管理员和业务员按数据库规则访问。认领额度、分配、跟进历史和转化归属由当前登录身份及数据库函数裁定；同步入口另核验管理员或计划任务。

完成依据：按线索编号读回领取周期、负责人、联系记录及退回后的结束原因；导入按操作编号核对终态和文件计数。

## 常见维护

从[线索数据流](../explanation/sales-lead-flow.md)定位列表、弹窗、写入凭证、转化客户与后台导入。展示筛选与数据库归属规则分开维护。

验证入口：npm run test:learning:browser -- sales-lead-receipts；后端 sales_lead_sync_source 测试；原受限角色套件和隔离数据库测试单独登记。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`claim_sales_lead_sync`、`convert_sales_lead_to_customer`、`current_user_can_manage_sales_lead_sync`、`finish_sales_lead_sync`、`get_sales_lead_detail`、`get_sales_lead_page`、`import_sales_lead_batch`、`record_sales_lead_import_failure`、`renew_sales_lead_sync`、`request_sales_lead_sync`。

源码中直接引用的数据表/存储桶：`internal_job_request_secrets`、`wholesale_customers`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: scripts/learning/sales-lead-conversion-fixture.test.mjs](../../../scripts/learning/sales-lead-conversion-fixture.test.mjs)
- [web: tests/e2e/helpers/sales-lead-conversion-fixture.ts](../../../tests/e2e/helpers/sales-lead-conversion-fixture.ts)
- [web: tests/e2e/helpers/sales-lead-conversion.ts](../../../tests/e2e/helpers/sales-lead-conversion.ts)
- [web: tests/e2e/sales-lead-admin-claim.spec.ts](../../../tests/e2e/sales-lead-admin-claim.spec.ts)
- [web: tests/e2e/sales-lead-conversion.spec.ts](../../../tests/e2e/sales-lead-conversion.spec.ts)
- [web: tests/e2e/sales-lead-daily-limit.spec.ts](../../../tests/e2e/sales-lead-daily-limit.spec.ts)
- [web: tests/e2e/sales-lead-details.spec.ts](../../../tests/e2e/sales-lead-details.spec.ts)
- [web: tests/e2e/sales-lead-views.spec.ts](../../../tests/e2e/sales-lead-views.spec.ts)
- [web: tests/e2e/sales-leads.spec.ts](../../../tests/e2e/sales-leads.spec.ts)
- [web: tests/learning/sales-lead-receipts.spec.ts](../../../tests/learning/sales-lead-receipts.spec.ts)
- [web: tests/test-support/sales-lead-conversion-cleanup-sql.ts](../../../tests/test-support/sales-lead-conversion-cleanup-sql.ts)
- [web: tests/test-support/sales-lead-conversion-proof.ts](../../../tests/test-support/sales-lead-conversion-proof.ts)
- [web: tests/test-support/sales-lead-conversion-store.ts](../../../tests/test-support/sales-lead-conversion-store.ts)
- [supabase: supabase/tests/sales_lead_admin_claim.sql](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_admin_claim.sql)
- [supabase: supabase/tests/sales_lead_conversion.sql](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_conversion.sql)
- [supabase: supabase/tests/sales_lead_conversion_concurrency.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_conversion_concurrency.mjs)
- [supabase: supabase/tests/sales_lead_conversion_migration_guard.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_conversion_migration_guard.mjs)
- [supabase: supabase/tests/sales_lead_customer_profile.sql](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_customer_profile.sql)
- [supabase: supabase/tests/sales_lead_daily_limit.sql](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_daily_limit.sql)
- [supabase: supabase/tests/sales_lead_directory_identity.sql](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_directory_identity.sql)
- [supabase: supabase/tests/sales_lead_hall.sql](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_hall.sql)
- [supabase: supabase/tests/sales_lead_sync_source.test.mjs](../../../../PT5-dropshipping-supabase/supabase/tests/sales_lead_sync_source.test.mjs)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [components/dashboard/sales-leads/sales-lead-action-dialog.tsx](../../../components/dashboard/sales-leads/sales-lead-action-dialog.tsx) | 已审拆分：操作草稿；操作表单展示 |
| [components/dashboard/sales-leads/sales-lead-cards.tsx](../../../components/dashboard/sales-leads/sales-lead-cards.tsx) | 已审保留：线索卡片与操作入口 |
| [components/dashboard/sales-leads/sales-lead-contact-info.tsx](../../../components/dashboard/sales-leads/sales-lead-contact-info.tsx) | 已审保留：联系方式字段组 |
| [components/dashboard/sales-leads/sales-lead-customer-dialog.tsx](../../../components/dashboard/sales-leads/sales-lead-customer-dialog.tsx) | 已审保留：客户草稿；转化表单 |
| [components/dashboard/sales-leads/sales-lead-customer-draft.ts](../../../components/dashboard/sales-leads/sales-lead-customer-draft.ts) | 已审保留：从线索映射客户草稿 |
| [components/dashboard/sales-leads/sales-lead-detail-dialog.tsx](../../../components/dashboard/sales-leads/sales-lead-detail-dialog.tsx) | 已审拆分：详情组装；操作入口 |
| [components/dashboard/sales-leads/sales-lead-history-section.tsx](../../../components/dashboard/sales-leads/sales-lead-history-section.tsx) | 已审保留：联系及领取周期历史 |
| [components/dashboard/sales-leads/sales-lead-list-row.tsx](../../../components/dashboard/sales-leads/sales-lead-list-row.tsx) | 已审保留：响应式摘要；公开资料展开；行操作入口 |
| [components/dashboard/sales-leads/sales-lead-list.tsx](../../../components/dashboard/sales-leads/sales-lead-list.tsx) | 已审保留：线索表格布局 |
| [components/dashboard/sales-leads/sales-lead-progress-section.tsx](../../../components/dashboard/sales-leads/sales-lead-progress-section.tsx) | 已审保留：当前进度与归属展示 |
| [components/dashboard/sales-leads/sales-lead-public-info.tsx](../../../components/dashboard/sales-leads/sales-lead-public-info.tsx) | 已审保留：公开资料分区展示 |
| [components/dashboard/sales-leads/sales-lead-rules.tsx](../../../components/dashboard/sales-leads/sales-lead-rules.tsx) | 已审保留：规则文案呈现 |
| [components/dashboard/sales-leads/sales-lead-value.tsx](../../../components/dashboard/sales-leads/sales-lead-value.tsx) | 已审保留：联系链接转换；普通文本显示 |
| [components/dashboard/sales-leads/sales-leads-client.tsx](../../../components/dashboard/sales-leads/sales-leads-client.tsx) | 已审拆分：组装线索页面；调度转化后刷新 |
| [components/dashboard/sales-leads/sales-leads-display.ts](../../../components/dashboard/sales-leads/sales-leads-display.ts) | 已审拆分：日期和倒计时格式；网页链接识别 |
| [components/dashboard/sales-leads/sales-leads-results-section.tsx](../../../components/dashboard/sales-leads/sales-leads-results-section.tsx) | 已审拆分：列表状态；筛选区和分页组装 |
| [components/dashboard/sales-leads/sales-leads-sync-status.tsx](../../../components/dashboard/sales-leads/sales-leads-sync-status.tsx) | 已审保留：导入反馈展示 |
| [components/dashboard/sales-leads/sales-leads-toolbar.tsx](../../../components/dashboard/sales-leads/sales-leads-toolbar.tsx) | 已审保留：筛选和视图切换控件 |
| [components/dashboard/sales-leads/use-sales-lead-actions.ts](../../../components/dashboard/sales-leads/use-sales-lead-actions.ts) | 已审保留：详情与线索操作状态；同页请求互斥 |
| [components/dashboard/sales-leads/use-sales-lead-customer.ts](../../../components/dashboard/sales-leads/use-sales-lead-customer.ts) | 已审拆分：客户转化弹窗生命周期 |
| [components/dashboard/sales-leads/use-sales-leads-display.ts](../../../components/dashboard/sales-leads/use-sales-leads-display.ts) | 已审保留：本地视图偏好；展示时间和看板标签 |
| [components/dashboard/sales-leads/use-sales-leads-list.ts](../../../components/dashboard/sales-leads/use-sales-leads-list.ts) | 已审保留：线索看板读取与筛选 |
| [components/dashboard/sales-leads/use-sales-leads-page.ts](../../../components/dashboard/sales-leads/use-sales-leads-page.ts) | 已审拆分：组合页面状态；导入运行跟踪 |
| [lib/sales-lead-customer.ts](../../../lib/sales-lead-customer.ts) | 已审拆分：客户转化请求；独立读回 |
| [lib/sales-lead-write.ts](../../../lib/sales-lead-write.ts) | 已审保留：线索写入及终态凭证；发起来源同步 |
| [lib/sales-leads-types.ts](../../../lib/sales-leads-types.ts) | 已审保留：定义 SalesLeadBoard、SalesLeadStatus 等11项同模块类型合同 |
| [lib/sales-leads.ts](../../../lib/sales-leads.ts) | 已审拆分：线索查询；业务错误码适配 |

### Supabase

| 文件 | 阅读重点 |
| --- | --- |
| [supabase/functions/sales-lead-sync/import-daily-files.ts](../../../../PT5-dropshipping-supabase/supabase/functions/sales-lead-sync/import-daily-files.ts) | 已审保留：逐文件导入；批次凭证和续租 |
| [supabase/functions/sales-lead-sync/index.ts](../../../../PT5-dropshipping-supabase/supabase/functions/sales-lead-sync/index.ts) | 已审拆分：HTTP 和配置入口；同步租约；运行终态 |
| [supabase/functions/sales-lead-sync/request-auth.ts](../../../../PT5-dropshipping-supabase/supabase/functions/sales-lead-sync/request-auth.ts) | 已审保留：计划任务鉴权；管理员鉴权 |
| [supabase/functions/sales-lead-sync/source.ts](../../../../PT5-dropshipping-supabase/supabase/functions/sales-lead-sync/source.ts) | 已审保留：每日目录与配对；文件获取；正文校验 |
| [supabase/functions/sales-lead-sync/types.ts](../../../../PT5-dropshipping-supabase/supabase/functions/sales-lead-sync/types.ts) | 已审保留：定义 SalesLeadSourceItem、SalesLeadSourceDocument 等3项同模块类型合同 |
