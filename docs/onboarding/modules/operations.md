# 业务操作凭证与共享后台运行

当前范围：共享。

## 业务与阅读顺序

维护共享后台运行、幂等写入和 Storage 凭证。管理员历史页保留在停用的旅游栏目。

数据流：操作入口 → 运行编号和尝试号 → 后台落终态 → 当前会话按原运行编号读回 → 页面反馈。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

运行查询仅允许启用的请求人或管理员，写入尝试由有权服务执行。历史页还受旅游业务启用守卫限制。

完成依据：运行编号、终态、完成时间和预期计数相符；具体写入还需行版本、对象或外部凭证。

## 常见维护

沿[操作凭证与运行账本](../explanation/operation-run-flow.md)定位读写入口；新增写入口同步登记 operation-contracts。

验证入口：npm run check:operation-contracts；npm run test:operation-receipts；npm run test:learning:browser -- operation-run-receipts workspace-notice；后端 verified_operation_runs.test.sql 按隔离准入执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`create_service_operation_run`、`finish_operation_attempt_checked`、`get_operation_run`、`heartbeat_operation_attempt_checked`、`start_operation_attempt_checked`。

源码中直接引用的数据表/存储桶：`user_profile_change_requests`、`user_profiles`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: scripts/learning/operation-contract-manifest.test.mjs](../../../scripts/learning/operation-contract-manifest.test.mjs)
- [web: scripts/learning/settlement-repair-receipts.test.mjs](../../../scripts/learning/settlement-repair-receipts.test.mjs)
- [web: scripts/operation-runs.test.mjs](../../../scripts/operation-runs.test.mjs)
- [web: scripts/storage-operation-receipts.test.mjs](../../../scripts/storage-operation-receipts.test.mjs)
- [web: scripts/verified-action-outcome.test.mjs](../../../scripts/verified-action-outcome.test.mjs)
- [web: tests/e2e/helpers/document-file-receipts.ts](../../../tests/e2e/helpers/document-file-receipts.ts)
- [web: tests/e2e/helpers/inventory-order-page-receipts.ts](../../../tests/e2e/helpers/inventory-order-page-receipts.ts)
- [web: tests/e2e/settlement-rate-repair-receipts.spec.ts](../../../tests/e2e/settlement-rate-repair-receipts.spec.ts)
- [web: tests/learning/operation-run-receipts.spec.ts](../../../tests/learning/operation-run-receipts.spec.ts)
- [web: tests/test-support/settlement-repair-receipts.ts](../../../tests/test-support/settlement-repair-receipts.ts)
- [supabase: supabase/tests/mail-workspace/delivery-receipts.sql](../../../../PT5-dropshipping-supabase/supabase/tests/mail-workspace/delivery-receipts.sql)
- [supabase: supabase/tests/verified_operation_runs.test.sql](../../../../PT5-dropshipping-supabase/supabase/tests/verified_operation_runs.test.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [components/dashboard/admin-operation-records/admin-operation-records-client.tsx](../../../components/dashboard/admin-operation-records/admin-operation-records-client.tsx) | 已审拆分：组装历史页的权限分支；连接筛选和分页控件 |
| [components/dashboard/admin-operation-records/admin-operation-records-display.ts](../../../components/dashboard/admin-operation-records/admin-operation-records-display.ts) | 已审保留：格式化上海时间与身份；映射岗位和账号状态；匹配可搜索的历史字段 |
| [components/dashboard/admin-operation-records/admin-operation-records-row.tsx](../../../components/dashboard/admin-operation-records/admin-operation-records-row.tsx) | 已审拆分：展示单条记录的时间与参与者；展示名称、城市和权限变化 |
| [components/dashboard/admin-operation-records/admin-operation-records-sections.tsx](../../../components/dashboard/admin-operation-records/admin-operation-records-sections.tsx) | 已审拆分：展示标题与权限提示；展示筛选控件；组装空状态与分页列表 |
| [components/dashboard/admin-operation-records/use-admin-operation-records-view-model.ts](../../../components/dashboard/admin-operation-records/use-admin-operation-records-view-model.ts) | 已审拆分：建立双语标签；管理筛选与分页重置；匹配可见记录 |
| [components/dashboard/dashboard-operational-summary.tsx](../../../components/dashboard/dashboard-operational-summary.tsx) | 已审保留：展示首要指标；展示来源或时间说明；展示辅助指标 |
| [lib/admin-operation-records-contract.ts](../../../lib/admin-operation-records-contract.ts) | 已审拆分：定义操作记录和筛选合同 |
| [lib/admin-operation-records-mapping.ts](../../../lib/admin-operation-records-mapping.ts) | 已审拆分：转换账号日志快照；转换资料审核记录与参与者 |
| [lib/admin-operation-records.ts](../../../lib/admin-operation-records.ts) | 已审拆分：检查管理员权限；读取资料审核及身份；合并两类历史并排序 |
| [lib/mutation-receipts.ts](../../../lib/mutation-receipts.ts) | 已审保留：核对写入回执的对象与编号形状 |
| [lib/operation-runs.ts](../../../lib/operation-runs.ts) | 已审拆分：解析受理和运行回执；按原编号读取与等待；校验完整成功终态 |
| [lib/server-operation-runs.ts](../../../lib/server-operation-runs.ts) | 已审保留：操作创建与去重；尝试终态确认 |
| [lib/storage-operation-object-presence.ts](../../../lib/storage-operation-object-presence.ts) | 已审拆分：按准确路径核对 Storage 对象 |
| [lib/storage-operation-receipt-validation.ts](../../../lib/storage-operation-receipt-validation.ts) | 已审保留：校验 Storage 上传与删除响应；逐项核对对象存在和缺失；核对数据库登记父记录与路径 |
| [lib/storage-operation-receipts.ts](../../../lib/storage-operation-receipts.ts) | 已审保留：串联对象删除与前后两次读回 |
| [lib/upload-file-size-limits.ts](../../../lib/upload-file-size-limits.ts) | 已审保留：判定文件类型；读取类型大小限制；判断是否超过边界 |
| [lib/verified-action-outcome.ts](../../../lib/verified-action-outcome.ts) | 已审保留：区分写入失败和写入后刷新失败 |

### Supabase

| 文件 | 阅读重点 |
| --- | --- |
| [supabase/functions/_shared/document-cleanup.ts](../../../../PT5-dropshipping-supabase/supabase/functions/_shared/document-cleanup.ts) | 已审保留：按已领取编号处理对象；核对原操作的终态与逐项计数 |
| [supabase/functions/_shared/operation-run.ts](../../../../PT5-dropshipping-supabase/supabase/functions/_shared/operation-run.ts) | 已审保留：开始运行与识别幂等重放；保存运行结果；续期当前尝试 |
| [supabase/functions/_shared/storage-operation-receipts.ts](../../../../PT5-dropshipping-supabase/supabase/functions/_shared/storage-operation-receipts.ts) | 已审拆分：精确对象存在性读取；删除前后凭证断言 |
